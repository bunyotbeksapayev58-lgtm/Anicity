-- Forward-only admin pagination, serialized subscription grants and atomic anime PATCH.

-- Drop the old no-argument signature so PostgREST has exactly one matching RPC.
DROP FUNCTION IF EXISTS public.admin_list_users();
CREATE FUNCTION public.admin_list_users(
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50,
  p_search text DEFAULT NULL,
  p_status text DEFAULT 'all'
)
RETURNS TABLE (
  id uuid,
  username text,
  display_name text,
  role text,
  suspended_at timestamptz,
  created_at timestamptz,
  subscription_plan text,
  subscription_expires_at timestamptz,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_total_count bigint;
  v_page integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_page IS NULL OR p_page < 1 THEN RAISE EXCEPTION 'page must be at least 1'; END IF;
  IF p_page_size IS NULL OR p_page_size < 1 OR p_page_size > 100 THEN
    RAISE EXCEPTION 'page size must be between 1 and 100';
  END IF;
  IF coalesce(p_status, 'all') NOT IN ('all', 'vip', 'free', 'expired') THEN
    RAISE EXCEPTION 'invalid user status filter';
  END IF;
  IF length(coalesce(p_search, '')) > 100 THEN RAISE EXCEPTION 'search text is too long'; END IF;

  SELECT count(*) INTO v_total_count
  FROM public.profiles p
  LEFT JOIN LATERAL (
    SELECT us.id, us.expires_at
    FROM public.user_subscriptions us
    WHERE us.user_id = p.id AND us.status = 'active' AND us.starts_at <= now()
    ORDER BY us.expires_at DESC
    LIMIT 1
  ) s ON true
  WHERE (nullif(trim(p_search), '') IS NULL
         OR p.username ILIKE '%' || trim(p_search) || '%'
         OR p.display_name ILIKE '%' || trim(p_search) || '%'
         OR p.id::text ILIKE '%' || trim(p_search) || '%')
    AND (coalesce(p_status, 'all') = 'all'
         OR (p_status = 'vip' AND s.id IS NOT NULL AND s.expires_at > now())
         OR (p_status = 'expired' AND s.id IS NOT NULL AND s.expires_at <= now())
         OR (p_status = 'free' AND (s.id IS NULL OR s.expires_at <= now())));
  v_page := least(p_page, greatest(ceil(v_total_count::numeric / p_page_size)::integer, 1));

  RETURN QUERY
  SELECT p.id, p.username, p.display_name, p.role, p.suspended_at, p.created_at,
         CASE WHEN s.id IS NOT NULL THEN 'vip' ELSE 'free' END,
         s.expires_at, v_total_count
  FROM public.profiles p
  LEFT JOIN LATERAL (
    SELECT us.id, us.expires_at
    FROM public.user_subscriptions us
    WHERE us.user_id = p.id AND us.status = 'active' AND us.starts_at <= now()
    ORDER BY us.expires_at DESC
    LIMIT 1
  ) s ON true
  WHERE (nullif(trim(p_search), '') IS NULL
         OR p.username ILIKE '%' || trim(p_search) || '%'
         OR p.display_name ILIKE '%' || trim(p_search) || '%'
         OR p.id::text ILIKE '%' || trim(p_search) || '%')
    AND (coalesce(p_status, 'all') = 'all'
         OR (p_status = 'vip' AND s.id IS NOT NULL AND s.expires_at > now())
         OR (p_status = 'expired' AND s.id IS NOT NULL AND s.expires_at <= now())
         OR (p_status = 'free' AND (s.id IS NULL OR s.expires_at <= now())))
  ORDER BY p.created_at DESC, p.id
  LIMIT p_page_size OFFSET (v_page - 1) * p_page_size;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_users(integer, integer, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users(integer, integer, text, text) TO authenticated;

-- Replace the grant implementation without changing existing subscription rows.
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
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'user id is required'; END IF;
  SELECT username INTO v_username FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'user not found' USING ERRCODE = 'P0002'; END IF;

  -- A per-user transaction lock prevents concurrent grants from selecting the same expiry.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
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
  WHERE user_id = p_user_id AND status = 'active' AND expires_at > now();
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

REVOKE ALL ON FUNCTION public.admin_grant_user_subscription(uuid, uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_grant_user_subscription(uuid, uuid, integer, text) TO authenticated;

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
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF p_duration_days IS NULL OR p_duration_days < 1 OR p_duration_days > 3660 THEN
    RAISE EXCEPTION 'extension must be between 1 and 3660 days';
  END IF;
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'user id is required'; END IF;
  SELECT username INTO v_username FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'user not found' USING ERRCODE = 'P0002'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  SELECT * INTO v_sub FROM public.user_subscriptions
  WHERE user_id = p_user_id AND status = 'active' AND expires_at > now()
  ORDER BY expires_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'active subscription not found' USING ERRCODE = 'P0002'; END IF;

  v_expires := v_sub.expires_at + make_interval(days => p_duration_days);
  UPDATE public.user_subscriptions SET expires_at = v_expires, updated_at = now() WHERE id = v_sub.id;
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
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'user id is required'; END IF;
  SELECT username INTO v_username FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'user not found' USING ERRCODE = 'P0002'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  SELECT * INTO v_previous FROM public.user_subscriptions
  WHERE user_id = p_user_id AND status = 'active'
  ORDER BY expires_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'active subscription not found' USING ERRCODE = 'P0002'; END IF;
  UPDATE public.user_subscriptions SET status = 'cancelled', updated_at = now()
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
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'user id is required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  SELECT EXISTS (
    SELECT 1 FROM public.user_subscriptions
    WHERE user_id = p_user_id AND status = 'active' AND starts_at <= now() AND expires_at > now()
  ) INTO v_active;
  IF v_active THEN RETURN public.admin_revoke_user_subscription(p_user_id, 'Admin tomonidan bekor qilindi'); END IF;
  RETURN public.admin_grant_user_subscription(p_user_id, NULL, 30, 'Admin tomonidan taqdim etildi');
END;
$$;

REVOKE ALL ON FUNCTION public.admin_extend_user_subscription(uuid, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_revoke_user_subscription(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_toggle_user_vip(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_extend_user_subscription(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_user_subscription(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_toggle_user_vip(uuid) TO authenticated;

-- Metadata edits and optional episode replacement commit or roll back together.
CREATE OR REPLACE FUNCTION public.admin_update_anime_and_episodes(
  p_anime_id uuid, p_anime jsonb, p_episodes jsonb DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_episode_count integer := 0;
  v_rows integer;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF p_anime IS NULL OR jsonb_typeof(p_anime) <> 'object' THEN
    RAISE EXCEPTION 'anime patch must be a JSON object';
  END IF;
  IF p_anime ? 'genres' AND jsonb_typeof(p_anime->'genres') <> 'array' THEN
    RAISE EXCEPTION 'genres must be an array';
  END IF;

  IF p_anime <> '{}'::jsonb THEN
    UPDATE public.animes SET
      title = CASE WHEN p_anime ? 'title' THEN p_anime->>'title' ELSE title END,
      alt_title = CASE WHEN p_anime ? 'alt_title' THEN p_anime->>'alt_title' ELSE alt_title END,
      year = CASE WHEN p_anime ? 'year' THEN nullif(p_anime->>'year', '')::integer ELSE year END,
      status = CASE WHEN p_anime ? 'status' THEN p_anime->>'status' ELSE status END,
      age_rating = CASE WHEN p_anime ? 'age_rating' THEN p_anime->>'age_rating' ELSE age_rating END,
      studio = CASE WHEN p_anime ? 'studio' THEN p_anime->>'studio' ELSE studio END,
      director = CASE WHEN p_anime ? 'director' THEN p_anime->>'director' ELSE director END,
      genres = CASE WHEN p_anime ? 'genres'
        THEN ARRAY(SELECT jsonb_array_elements_text(p_anime->'genres')) ELSE genres END,
      description = CASE WHEN p_anime ? 'description' THEN p_anime->>'description' ELSE description END,
      poster_url = CASE WHEN p_anime ? 'poster_url' THEN p_anime->>'poster_url' ELSE poster_url END,
      banner_url = CASE WHEN p_anime ? 'banner_url' THEN p_anime->>'banner_url' ELSE banner_url END,
      is_featured = CASE WHEN p_anime ? 'is_featured' THEN (p_anime->>'is_featured')::boolean ELSE is_featured END,
      is_published = CASE WHEN p_anime ? 'is_published' THEN (p_anime->>'is_published')::boolean ELSE is_published END,
      release_day = CASE WHEN p_anime ? 'release_day' THEN p_anime->>'release_day' ELSE release_day END,
      fandub_team = CASE WHEN p_anime ? 'fandub_team' THEN p_anime->>'fandub_team' ELSE fandub_team END
    WHERE id = p_anime_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 0 THEN RAISE EXCEPTION 'anime not found' USING ERRCODE = 'P0002'; END IF;
  ELSIF NOT EXISTS (SELECT 1 FROM public.animes WHERE id = p_anime_id) THEN
    RAISE EXCEPTION 'anime not found' USING ERRCODE = 'P0002';
  END IF;

  IF p_episodes IS NOT NULL THEN
    IF jsonb_typeof(p_episodes) <> 'array' OR jsonb_array_length(p_episodes) < 1
       OR jsonb_array_length(p_episodes) > 500 THEN
      RAISE EXCEPTION 'episode list must contain between 1 and 500 entries';
    END IF;
    IF EXISTS (
      SELECT 1 FROM jsonb_to_recordset(p_episodes) AS e(
        season_number integer, number integer, title text, video_url text
      )
      WHERE e.season_number IS NULL OR e.season_number < 1
         OR e.number IS NULL OR e.number < 1
         OR e.video_url IS NULL OR e.video_url !~* '^https?://'
         OR char_length(coalesce(e.title, '')) > 200
    ) THEN RAISE EXCEPTION 'invalid episode fields'; END IF;

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
    GET DIAGNOSTICS v_episode_count = ROW_COUNT;
  END IF;
  RETURN v_episode_count;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_anime_and_episodes(uuid, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_anime_and_episodes(uuid, jsonb, jsonb) TO authenticated;
