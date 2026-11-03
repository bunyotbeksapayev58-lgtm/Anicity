-- User-owned avatar support already exists in migration 006; this migration adds
-- profile-safe administration and permission-scoped assistant accounts.

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('user', 'moderator', 'admin', 'owner', 'assistant_admin'));

CREATE TABLE IF NOT EXISTS public.assistant_admins (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  appointed_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.assistant_admin_permissions (
  user_id uuid NOT NULL REFERENCES public.assistant_admins(user_id) ON DELETE CASCADE,
  permission_key text NOT NULL CHECK (permission_key IN (
    'anime_view', 'anime_create', 'anime_edit', 'anime_delete',
    'video_upload', 'episode_create', 'episode_edit', 'episode_delete',
    'video_analyze', 'video_review', 'comment_moderate', 'report_view'
  )),
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, permission_key)
);

CREATE TABLE IF NOT EXISTS public.assistant_admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action_name text NOT NULL,
  target_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_record_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.assistant_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_admin_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_admin_audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.assistant_admins, public.assistant_admin_permissions, public.assistant_admin_audit_logs
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.assistant_has_permission(p_permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.assistant_admins aa ON aa.user_id = p.id
    JOIN public.assistant_admin_permissions ap ON ap.user_id = aa.user_id
    WHERE p.id = auth.uid()
      AND p.role = 'assistant_admin'
      AND p.suspended_at IS NULL
      AND ap.permission_key = p_permission
      AND ap.enabled
  );
$$;

CREATE OR REPLACE FUNCTION public.assistant_can_manage_content()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.assistant_admins aa ON aa.user_id = p.id
    JOIN public.assistant_admin_permissions ap ON ap.user_id = aa.user_id
    WHERE p.id = auth.uid() AND p.role = 'assistant_admin' AND p.suspended_at IS NULL
      AND ap.enabled AND ap.permission_key IN (
        'anime_view', 'anime_create', 'anime_edit', 'anime_delete', 'video_upload',
        'episode_create', 'episode_edit', 'episode_delete', 'video_analyze', 'video_review'
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.main_admin_search_assistant_candidates(p_search text DEFAULT '')
RETURNS TABLE (id uuid, username text, display_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'owner' AND suspended_at IS NULL) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF length(coalesce(p_search, '')) > 100 THEN RAISE EXCEPTION 'search text is too long'; END IF;
  RETURN QUERY
  SELECT p.id, p.username, p.display_name
  FROM public.profiles p
  WHERE p.role = 'user' AND p.suspended_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.assistant_admins aa WHERE aa.user_id = p.id)
    AND (nullif(trim(p_search), '') IS NULL
      OR p.username ILIKE '%' || trim(p_search) || '%'
      OR coalesce(p.display_name, '') ILIKE '%' || trim(p_search) || '%')
  ORDER BY p.created_at DESC
  LIMIT 50;
END;
$$;

CREATE OR REPLACE FUNCTION public.main_admin_list_assistant_admins()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_assistants jsonb;
  v_logs jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'owner' AND suspended_at IS NULL) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'username', p.username, 'display_name', p.display_name,
    'avatar_url', p.avatar_url, 'created_at', aa.created_at, 'permissions', perm.permissions
  ) ORDER BY aa.created_at DESC), '[]'::jsonb)
  INTO v_assistants
  FROM public.assistant_admins aa
  JOIN public.profiles p ON p.id = aa.user_id
  LEFT JOIN LATERAL (
    SELECT jsonb_object_agg(ap.permission_key, ap.enabled) AS permissions
    FROM public.assistant_admin_permissions ap WHERE ap.user_id = aa.user_id
  ) perm ON true;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', l.id, 'actor_id', l.actor_id, 'actor_username', actor.username,
    'action_name', l.action_name, 'target_user_id', l.target_user_id,
    'target_username', target.username, 'target_record_id', l.target_record_id,
    'details', l.details, 'created_at', l.created_at
  ) ORDER BY l.created_at DESC), '[]'::jsonb)
  INTO v_logs
  FROM (SELECT * FROM public.assistant_admin_audit_logs ORDER BY created_at DESC LIMIT 100) l
  LEFT JOIN public.profiles actor ON actor.id = l.actor_id
  LEFT JOIN public.profiles target ON target.id = l.target_user_id;
  RETURN jsonb_build_object('assistants', v_assistants, 'audit_logs', v_logs);
END;
$$;

CREATE OR REPLACE FUNCTION public.main_admin_appoint_assistant(p_target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_username text;
  v_key text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_actor AND role = 'owner' AND suspended_at IS NULL) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT username INTO v_username FROM public.profiles
  WHERE id = p_target_user_id AND role = 'user' AND suspended_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'eligible user not found' USING ERRCODE = 'P0002'; END IF;
  INSERT INTO public.assistant_admins(user_id, appointed_by) VALUES (p_target_user_id, v_actor);
  UPDATE public.profiles SET role = 'assistant_admin' WHERE id = p_target_user_id;
  FOREACH v_key IN ARRAY ARRAY[
    'anime_view', 'anime_create', 'anime_edit', 'anime_delete', 'video_upload',
    'episode_create', 'episode_edit', 'episode_delete', 'video_analyze', 'video_review',
    'comment_moderate', 'report_view'
  ] LOOP
    INSERT INTO public.assistant_admin_permissions(user_id, permission_key, enabled)
    VALUES (p_target_user_id, v_key, false);
  END LOOP;
  INSERT INTO public.assistant_admin_audit_logs(actor_id, action_name, target_user_id, details)
  VALUES (v_actor, 'assistant_appointed', p_target_user_id, jsonb_build_object('username', v_username));
END;
$$;

CREATE OR REPLACE FUNCTION public.main_admin_set_assistant_permissions(p_target_user_id uuid, p_permissions jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_key text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_actor AND role = 'owner' AND suspended_at IS NULL) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_permissions) <> 'object' THEN RAISE EXCEPTION 'permissions must be a JSON object'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.assistant_admins WHERE user_id = p_target_user_id) THEN
    RAISE EXCEPTION 'assistant admin not found' USING ERRCODE = 'P0002';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_each(p_permissions) e
    WHERE e.key NOT IN (
      'anime_view', 'anime_create', 'anime_edit', 'anime_delete', 'video_upload',
      'episode_create', 'episode_edit', 'episode_delete', 'video_analyze', 'video_review',
      'comment_moderate', 'report_view'
    ) OR jsonb_typeof(e.value) <> 'boolean'
  ) THEN RAISE EXCEPTION 'invalid assistant permission payload'; END IF;
  FOR v_key IN SELECT permission_key FROM public.assistant_admin_permissions WHERE user_id = p_target_user_id LOOP
    UPDATE public.assistant_admin_permissions
    SET enabled = coalesce((p_permissions->>v_key)::boolean, false), updated_at = now()
    WHERE user_id = p_target_user_id AND permission_key = v_key;
  END LOOP;
  INSERT INTO public.assistant_admin_audit_logs(actor_id, action_name, target_user_id, details)
  VALUES (v_actor, 'assistant_permissions_updated', p_target_user_id,
    jsonb_build_object('permissions', p_permissions));
END;
$$;

CREATE OR REPLACE FUNCTION public.main_admin_remove_assistant(p_target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_username text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_actor AND role = 'owner' AND suspended_at IS NULL) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT username INTO v_username FROM public.profiles
  WHERE id = p_target_user_id AND role = 'assistant_admin' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'assistant admin not found' USING ERRCODE = 'P0002'; END IF;
  INSERT INTO public.assistant_admin_audit_logs(actor_id, action_name, target_user_id, details)
  VALUES (v_actor, 'assistant_removed', p_target_user_id, jsonb_build_object('username', v_username));
  DELETE FROM public.assistant_admins WHERE user_id = p_target_user_id;
  UPDATE public.profiles SET role = 'user' WHERE id = p_target_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.main_admin_revoke_all_assistant_permissions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_count integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_actor AND role = 'owner' AND suspended_at IS NULL) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  UPDATE public.assistant_admin_permissions SET enabled = false, updated_at = now() WHERE enabled;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  INSERT INTO public.assistant_admin_audit_logs(actor_id, action_name, details)
  VALUES (v_actor, 'all_assistant_permissions_revoked', jsonb_build_object('revoked_count', v_count));
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.assistant_create_anime_with_episodes(p_anime jsonb, p_episodes jsonb DEFAULT '[]'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_anime public.animes%ROWTYPE;
  v_episode_count integer;
BEGIN
  IF NOT public.assistant_has_permission('anime_create') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF jsonb_typeof(p_anime) <> 'object' OR jsonb_typeof(coalesce(p_episodes, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'invalid anime or episode payload';
  END IF;
  IF jsonb_array_length(coalesce(p_episodes, '[]'::jsonb)) > 500 THEN RAISE EXCEPTION 'at most 500 episodes are allowed'; END IF;
  IF jsonb_array_length(coalesce(p_episodes, '[]'::jsonb)) > 0 AND NOT (
    public.assistant_has_permission('episode_create') AND public.assistant_has_permission('video_upload')
  ) THEN RAISE EXCEPTION 'episode_create and video_upload permissions are required' USING ERRCODE = '42501'; END IF;
  INSERT INTO public.animes (
    title, alt_title, description, year, status, age_rating, genres, studio, director,
    poster_url, banner_url, is_featured, is_published, release_day, fandub_team
  ) VALUES (
    p_anime->>'title', p_anime->>'alt_title', coalesce(p_anime->>'description', ''),
    nullif(p_anime->>'year', '')::integer, coalesce(p_anime->>'status', 'Tugallangan'),
    coalesce(p_anime->>'age_rating', '12+'),
    ARRAY(SELECT jsonb_array_elements_text(coalesce(p_anime->'genres', '[]'::jsonb))),
    p_anime->>'studio', p_anime->>'director', p_anime->>'poster_url', p_anime->>'banner_url',
    coalesce((p_anime->>'is_featured')::boolean, false), false,
    p_anime->>'release_day', coalesce(p_anime->>'fandub_team', 'Anicity Dub')
  ) RETURNING * INTO v_anime;

  v_episode_count := jsonb_array_length(coalesce(p_episodes, '[]'::jsonb));
  IF v_episode_count > 0 THEN
    IF EXISTS (
      SELECT 1 FROM jsonb_to_recordset(p_episodes) AS e(season_number integer, number integer, title text, video_url text)
      WHERE e.season_number IS NULL OR e.season_number < 1 OR e.number IS NULL OR e.number < 1
        OR e.video_url IS NULL OR e.video_url !~* '^https?://' OR char_length(coalesce(e.title, '')) > 200
    ) THEN RAISE EXCEPTION 'invalid episode fields'; END IF;
    INSERT INTO public.episodes(anime_id, season_number, number, title, description, video_url, thumbnail_url, is_published, quality)
    SELECT v_anime.id, e.season_number, e.number, e.title, e.description, e.video_url,
      e.thumbnail_url, false, coalesce(e.quality, '1080p')
    FROM jsonb_to_recordset(p_episodes) AS e(
      season_number integer, number integer, title text, description text, video_url text,
      thumbnail_url text, is_published boolean, quality text
    );
  END IF;
  RETURN jsonb_build_object('id', v_anime.id, 'title', v_anime.title, 'poster_url', v_anime.poster_url);
END;
$$;

CREATE OR REPLACE FUNCTION public.assistant_update_anime_and_episodes(
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
  IF p_anime IS NULL OR jsonb_typeof(p_anime) <> 'object' THEN RAISE EXCEPTION 'anime patch must be a JSON object'; END IF;
  IF p_anime <> '{}'::jsonb AND NOT public.assistant_has_permission('anime_edit') THEN
    RAISE EXCEPTION 'anime_edit permission is required' USING ERRCODE = '42501';
  END IF;
  IF p_episodes IS NOT NULL AND NOT (
    public.assistant_has_permission('episode_edit') AND public.assistant_has_permission('video_upload')
  ) THEN RAISE EXCEPTION 'episode_edit and video_upload permissions are required' USING ERRCODE = '42501'; END IF;
  IF p_anime ? 'genres' AND jsonb_typeof(p_anime->'genres') <> 'array' THEN RAISE EXCEPTION 'genres must be an array'; END IF;

  IF p_anime <> '{}'::jsonb THEN
    UPDATE public.animes SET
      title = CASE WHEN p_anime ? 'title' THEN p_anime->>'title' ELSE title END,
      alt_title = CASE WHEN p_anime ? 'alt_title' THEN p_anime->>'alt_title' ELSE alt_title END,
      year = CASE WHEN p_anime ? 'year' THEN nullif(p_anime->>'year', '')::integer ELSE year END,
      status = CASE WHEN p_anime ? 'status' THEN p_anime->>'status' ELSE status END,
      age_rating = CASE WHEN p_anime ? 'age_rating' THEN p_anime->>'age_rating' ELSE age_rating END,
      studio = CASE WHEN p_anime ? 'studio' THEN p_anime->>'studio' ELSE studio END,
      director = CASE WHEN p_anime ? 'director' THEN p_anime->>'director' ELSE director END,
      genres = CASE WHEN p_anime ? 'genres' THEN ARRAY(SELECT jsonb_array_elements_text(p_anime->'genres')) ELSE genres END,
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
    IF jsonb_typeof(p_episodes) <> 'array' OR jsonb_array_length(p_episodes) < 1 OR jsonb_array_length(p_episodes) > 500 THEN
      RAISE EXCEPTION 'episode list must contain between 1 and 500 entries';
    END IF;
    IF EXISTS (
      SELECT 1 FROM jsonb_to_recordset(p_episodes) AS e(season_number integer, number integer, title text, video_url text)
      WHERE e.season_number IS NULL OR e.season_number < 1 OR e.number IS NULL OR e.number < 1
        OR e.video_url IS NULL OR e.video_url !~* '^https?://' OR char_length(coalesce(e.title, '')) > 200
    ) THEN RAISE EXCEPTION 'invalid episode fields'; END IF;
    DELETE FROM public.episodes WHERE anime_id = p_anime_id;
    INSERT INTO public.episodes(anime_id, season_number, number, title, description, video_url, thumbnail_url, is_published, quality)
    SELECT p_anime_id, e.season_number, e.number, e.title, e.description, e.video_url,
      e.thumbnail_url, false, coalesce(e.quality, '1080p')
    FROM jsonb_to_recordset(p_episodes) AS e(
      season_number integer, number integer, title text, description text, video_url text,
      thumbnail_url text, is_published boolean, quality text
    );
    GET DIAGNOSTICS v_episode_count = ROW_COUNT;
  END IF;
  RETURN v_episode_count;
END;
$$;

DROP POLICY IF EXISTS "avatars own insert" ON storage.objects;
CREATE POLICY "avatars own insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'profile-avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND array_length(string_to_array(name, '/'), 1) = 2
    AND lower(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp')
  );

DROP POLICY IF EXISTS "avatars own update" ON storage.objects;
CREATE POLICY "avatars own update" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'profile-avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'profile-avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND array_length(string_to_array(name, '/'), 1) = 2
    AND lower(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp')
  );

DROP POLICY IF EXISTS "avatars own delete" ON storage.objects;
CREATE POLICY "avatars own delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'profile-avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

-- Read/write policies are permission scoped; financial and user-management tables remain inaccessible.
DROP POLICY IF EXISTS "assistant anime read" ON public.animes;
CREATE POLICY "assistant anime read" ON public.animes FOR SELECT TO authenticated
  USING (public.assistant_can_manage_content());
DROP POLICY IF EXISTS "assistant anime create" ON public.animes;
CREATE POLICY "assistant anime create" ON public.animes FOR INSERT TO authenticated
  WITH CHECK (public.assistant_has_permission('anime_create'));
DROP POLICY IF EXISTS "assistant anime edit" ON public.animes;
CREATE POLICY "assistant anime edit" ON public.animes FOR UPDATE TO authenticated
  USING (public.assistant_has_permission('anime_edit')) WITH CHECK (public.assistant_has_permission('anime_edit'));
DROP POLICY IF EXISTS "assistant anime delete" ON public.animes;
CREATE POLICY "assistant anime delete" ON public.animes FOR DELETE TO authenticated
  USING (public.assistant_has_permission('anime_delete'));

DROP POLICY IF EXISTS "assistant episodes read" ON public.episodes;
CREATE POLICY "assistant episodes read" ON public.episodes FOR SELECT TO authenticated
  USING (public.assistant_can_manage_content());
DROP POLICY IF EXISTS "assistant episodes create" ON public.episodes;
CREATE POLICY "assistant episodes create" ON public.episodes FOR INSERT TO authenticated
  WITH CHECK (public.assistant_has_permission('episode_create') AND public.assistant_has_permission('video_upload'));
DROP POLICY IF EXISTS "assistant episodes edit" ON public.episodes;
CREATE POLICY "assistant episodes edit" ON public.episodes FOR UPDATE TO authenticated
  USING (public.assistant_has_permission('episode_edit')) WITH CHECK (public.assistant_has_permission('episode_edit'));
DROP POLICY IF EXISTS "assistant episodes video source" ON public.episodes;
CREATE POLICY "assistant episodes video source" ON public.episodes FOR UPDATE TO authenticated
  USING (public.assistant_has_permission('video_upload')) WITH CHECK (public.assistant_has_permission('video_upload'));
DROP POLICY IF EXISTS "assistant episodes delete" ON public.episodes;
CREATE POLICY "assistant episodes delete" ON public.episodes FOR DELETE TO authenticated
  USING (public.assistant_has_permission('episode_delete'));

CREATE OR REPLACE FUNCTION public.prevent_assistant_content_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'assistant_admin') THEN
    IF coalesce(NEW.is_published, false) AND (TG_OP = 'INSERT' OR NOT coalesce(OLD.is_published, false)) THEN
      RAISE EXCEPTION 'assistant admins cannot publish content' USING ERRCODE = '42501';
    END IF;
    IF TG_TABLE_NAME = 'episodes' AND TG_OP = 'UPDATE' THEN
      IF NEW.video_url IS DISTINCT FROM OLD.video_url
         AND NOT public.assistant_has_permission('video_upload') THEN
        RAISE EXCEPTION 'video_upload permission is required' USING ERRCODE = '42501';
      END IF;
      IF NOT public.assistant_has_permission('episode_edit') AND (
        NEW.anime_id IS DISTINCT FROM OLD.anime_id OR
        NEW.season_number IS DISTINCT FROM OLD.season_number OR
        NEW.number IS DISTINCT FROM OLD.number OR
        NEW.title IS DISTINCT FROM OLD.title OR
        NEW.description IS DISTINCT FROM OLD.description OR
        NEW.thumbnail_url IS DISTINCT FROM OLD.thumbnail_url OR
        NEW.quality IS DISTINCT FROM OLD.quality OR
        NEW.is_published IS DISTINCT FROM OLD.is_published
      ) THEN
        RAISE EXCEPTION 'episode_edit permission is required' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assistant_anime_content_guard ON public.animes;
CREATE TRIGGER assistant_anime_content_guard BEFORE INSERT OR UPDATE ON public.animes
  FOR EACH ROW EXECUTE FUNCTION public.prevent_assistant_content_escalation();
DROP TRIGGER IF EXISTS assistant_episode_content_guard ON public.episodes;
CREATE TRIGGER assistant_episode_content_guard BEFORE INSERT OR UPDATE ON public.episodes
  FOR EACH ROW EXECUTE FUNCTION public.prevent_assistant_content_escalation();

REVOKE ALL ON FUNCTION public.assistant_has_permission(text) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.assistant_can_manage_content() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.main_admin_search_assistant_candidates(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.main_admin_list_assistant_admins() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.main_admin_appoint_assistant(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.main_admin_set_assistant_permissions(uuid, jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.main_admin_remove_assistant(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.main_admin_revoke_all_assistant_permissions() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.assistant_create_anime_with_episodes(jsonb, jsonb) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.assistant_update_anime_and_episodes(uuid, jsonb, jsonb) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.prevent_assistant_content_escalation() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.assistant_has_permission(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assistant_can_manage_content() TO authenticated;
GRANT EXECUTE ON FUNCTION public.main_admin_search_assistant_candidates(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.main_admin_list_assistant_admins() TO authenticated;
GRANT EXECUTE ON FUNCTION public.main_admin_appoint_assistant(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.main_admin_set_assistant_permissions(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.main_admin_remove_assistant(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.main_admin_revoke_all_assistant_permissions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.assistant_create_anime_with_episodes(jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assistant_update_anime_and_episodes(uuid, jsonb, jsonb) TO authenticated;
