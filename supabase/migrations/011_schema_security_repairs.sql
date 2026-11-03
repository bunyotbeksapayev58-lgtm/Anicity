-- Forward-only repairs for fields already used by the application.
ALTER TABLE public.animes
  ADD COLUMN IF NOT EXISTS release_day text,
  ADD COLUMN IF NOT EXISTS fandub_team text NOT NULL DEFAULT 'Anicity Dub';

ALTER TABLE public.episodes
  ADD COLUMN IF NOT EXISTS quality text NOT NULL DEFAULT '1080p';

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles read" ON public.profiles;
DROP POLICY IF EXISTS "profiles read own or admin" ON public.profiles;
CREATE POLICY "profiles read own or admin" ON public.profiles
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = id OR public.is_admin());

CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  id uuid,
  username text,
  display_name text,
  role text,
  suspended_at timestamptz,
  created_at timestamptz,
  subscription_plan text,
  subscription_expires_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT p.id, p.username, p.display_name, p.role, p.suspended_at, p.created_at,
         CASE WHEN s.id IS NOT NULL THEN 'vip' ELSE 'free' END,
         s.expires_at
  FROM public.profiles p
  LEFT JOIN LATERAL (
    SELECT us.id, us.expires_at
    FROM public.user_subscriptions us
  WHERE us.user_id = p.id AND us.status = 'active' AND us.starts_at <= now()
    ORDER BY us.expires_at DESC
    LIMIT 1
  ) s ON true
  ORDER BY p.created_at DESC
  LIMIT 100;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_create_anime_with_episodes(
  p_anime jsonb,
  p_episodes jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_anime public.animes%ROWTYPE;
  v_episode_count integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_anime) <> 'object' OR jsonb_typeof(coalesce(p_episodes, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'invalid anime or episode payload';
  END IF;
  IF jsonb_array_length(coalesce(p_episodes, '[]'::jsonb)) > 500 THEN
    RAISE EXCEPTION 'at most 500 episodes are allowed';
  END IF;

  INSERT INTO public.animes (
    title, alt_title, description, year, status, age_rating, genres, studio, director,
    poster_url, banner_url, is_featured, is_published, release_day, fandub_team
  )
  VALUES (
    p_anime->>'title', p_anime->>'alt_title', coalesce(p_anime->>'description', ''),
    nullif(p_anime->>'year', '')::integer, coalesce(p_anime->>'status', 'Tugallangan'),
    coalesce(p_anime->>'age_rating', '12+'),
    ARRAY(SELECT jsonb_array_elements_text(coalesce(p_anime->'genres', '[]'::jsonb))),
    p_anime->>'studio', p_anime->>'director', p_anime->>'poster_url', p_anime->>'banner_url',
    coalesce((p_anime->>'is_featured')::boolean, false),
    coalesce((p_anime->>'is_published')::boolean, true),
    p_anime->>'release_day', coalesce(p_anime->>'fandub_team', 'Anicity Dub')
  )
  RETURNING * INTO v_anime;

  v_episode_count := jsonb_array_length(coalesce(p_episodes, '[]'::jsonb));
  IF v_episode_count > 0 THEN
    IF EXISTS (
      SELECT 1 FROM jsonb_to_recordset(p_episodes) AS e(
        season_number integer, number integer, title text, video_url text
      )
      WHERE e.season_number IS NULL OR e.season_number < 1
         OR e.number IS NULL OR e.number < 1
         OR e.video_url IS NULL OR e.video_url !~* '^https?://'
         OR char_length(coalesce(e.title, '')) > 200
    ) THEN
      RAISE EXCEPTION 'invalid episode fields';
    END IF;
    INSERT INTO public.episodes (
      anime_id, season_number, number, title, description, video_url,
      thumbnail_url, is_published, quality
    )
    SELECT v_anime.id, e.season_number, e.number, e.title, e.description, e.video_url,
           e.thumbnail_url, coalesce(e.is_published, true), coalesce(e.quality, '1080p')
    FROM jsonb_to_recordset(p_episodes) AS e(
      season_number integer, number integer, title text, description text, video_url text,
      thumbnail_url text, is_published boolean, quality text
    );
  END IF;

  RETURN jsonb_build_object('id', v_anime.id, 'title', v_anime.title, 'poster_url', v_anime.poster_url);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_replace_anime_episodes(p_anime_id uuid, p_episodes jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_episodes) <> 'array' OR jsonb_array_length(p_episodes) < 1
     OR jsonb_array_length(p_episodes) > 500 THEN
    RAISE EXCEPTION 'episode list must contain between 1 and 500 entries';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.animes WHERE id = p_anime_id) THEN
    RAISE EXCEPTION 'anime not found' USING ERRCODE = 'P0002';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_episodes) AS e(
      season_number integer, number integer, title text, video_url text
    )
    WHERE e.season_number IS NULL OR e.season_number < 1
       OR e.number IS NULL OR e.number < 1
       OR e.video_url IS NULL OR e.video_url !~* '^https?://'
       OR char_length(coalesce(e.title, '')) > 200
  ) THEN
    RAISE EXCEPTION 'invalid episode fields';
  END IF;

  DELETE FROM public.episodes WHERE anime_id = p_anime_id;
  INSERT INTO public.episodes (
    anime_id, season_number, number, title, description, video_url,
    thumbnail_url, is_published, quality
  )
  SELECT p_anime_id, e.season_number, e.number, e.title, e.description, e.video_url,
         e.thumbnail_url, coalesce(e.is_published, true), coalesce(e.quality, '1080p')
  FROM jsonb_to_recordset(p_episodes) AS e(
    season_number integer, number integer, title text, description text, video_url text,
    thumbnail_url text, is_published boolean, quality text
  );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_grant_user_subscription(
  p_user_id uuid, p_plan_id uuid, p_duration_days integer, p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_username text;
  v_plan_name text;
  v_duration integer;
  v_previous_expiry timestamptz;
  v_starts timestamptz;
  v_expires timestamptz;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT username INTO v_username FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'user not found' USING ERRCODE = 'P0002'; END IF;

  IF p_plan_id IS NOT NULL THEN
    SELECT name, duration_days INTO v_plan_name, v_duration
    FROM public.subscription_plans WHERE id = p_plan_id AND is_active = true;
    IF NOT FOUND THEN RAISE EXCEPTION 'active subscription plan not found' USING ERRCODE = 'P0002'; END IF;
  ELSE
    v_duration := p_duration_days;
    v_plan_name := format('%s kunlik VIP', v_duration);
  END IF;
  IF v_duration IS NULL OR v_duration < 1 OR v_duration > 3660 THEN
    RAISE EXCEPTION 'subscription duration must be between 1 and 3660 days';
  END IF;

  SELECT max(expires_at) INTO v_previous_expiry
  FROM public.user_subscriptions
  WHERE user_id = p_user_id AND status = 'active' AND starts_at <= now() AND expires_at > now();
  v_starts := greatest(now(), coalesce(v_previous_expiry, now()));
  v_expires := v_starts + make_interval(days => v_duration);

  INSERT INTO public.user_subscriptions (
    user_id, plan_id, plan_name, status, starts_at, expires_at, grant_type, granted_by, notes
  ) VALUES (
    p_user_id, p_plan_id, v_plan_name, 'active', v_starts, v_expires, 'manual_admin', v_actor,
    left(nullif(trim(p_notes), ''), 1000)
  );
  INSERT INTO public.subscription_audit_logs (
    admin_id, user_id, action, previous_plan, previous_expires_at, new_plan, new_expires_at, reason
  ) VALUES (v_actor, p_user_id, 'grant', NULL, v_previous_expiry, v_plan_name, v_expires,
            left(nullif(trim(p_notes), ''), 1000));
  RETURN jsonb_build_object('username', v_username, 'plan_name', v_plan_name, 'expires_at', v_expires);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_extend_user_subscription(
  p_user_id uuid, p_duration_days integer, p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_sub public.user_subscriptions%ROWTYPE;
  v_username text;
  v_expires timestamptz;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_duration_days IS NULL OR p_duration_days < 1 OR p_duration_days > 3660 THEN
    RAISE EXCEPTION 'extension must be between 1 and 3660 days';
  END IF;
  SELECT username INTO v_username FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'user not found' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO v_sub FROM public.user_subscriptions
  WHERE user_id = p_user_id AND status = 'active' AND starts_at <= now() AND expires_at > now()
  ORDER BY expires_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'active subscription not found' USING ERRCODE = 'P0002'; END IF;

  v_expires := v_sub.expires_at + make_interval(days => p_duration_days);
  UPDATE public.user_subscriptions
  SET expires_at = v_expires, updated_at = now()
  WHERE id = v_sub.id;
  INSERT INTO public.subscription_audit_logs (
    admin_id, user_id, action, previous_plan, previous_expires_at, new_plan, new_expires_at, reason
  ) VALUES (v_actor, p_user_id, 'extend', v_sub.plan_name, v_sub.expires_at,
            v_sub.plan_name, v_expires, left(nullif(trim(p_reason), ''), 1000));
  RETURN jsonb_build_object('username', v_username, 'plan_name', v_sub.plan_name, 'expires_at', v_expires);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_revoke_user_subscription(p_user_id uuid, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_username text;
  v_previous public.user_subscriptions%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT username INTO v_username FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'user not found' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO v_previous FROM public.user_subscriptions
  WHERE user_id = p_user_id AND status = 'active'
  ORDER BY expires_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'active subscription not found' USING ERRCODE = 'P0002'; END IF;
  UPDATE public.user_subscriptions
  SET status = 'cancelled', updated_at = now()
  WHERE user_id = p_user_id AND status = 'active';
  INSERT INTO public.subscription_audit_logs (
    admin_id, user_id, action, previous_plan, previous_expires_at, new_plan, new_expires_at, reason
  ) VALUES (v_actor, p_user_id, 'revoke', v_previous.plan_name, v_previous.expires_at,
            'free', NULL, left(nullif(trim(p_reason), ''), 1000));
  RETURN jsonb_build_object('username', v_username);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_toggle_user_vip(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_active boolean;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.user_subscriptions
    WHERE user_id = p_user_id AND status = 'active' AND starts_at <= now() AND expires_at > now()
  ) INTO v_active;
  IF v_active THEN
    RETURN public.admin_revoke_user_subscription(p_user_id, 'Admin tomonidan bekor qilindi');
  END IF;
  RETURN public.admin_grant_user_subscription(p_user_id, NULL, 30, 'Admin tomonidan taqdim etildi');
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_create_anime_with_episodes(jsonb, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_replace_anime_episodes(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_grant_user_subscription(uuid, uuid, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_extend_user_subscription(uuid, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_revoke_user_subscription(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_toggle_user_vip(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_anime_with_episodes(jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_replace_anime_episodes(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant_user_subscription(uuid, uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_extend_user_subscription(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_user_subscription(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_toggle_user_vip(uuid) TO authenticated;
