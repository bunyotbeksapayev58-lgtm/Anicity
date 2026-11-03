-- Forward-only assistant security and audit fixes. Safe to re-run.

-- Harden every SECURITY DEFINER function introduced/changed in migrations 011-013.
ALTER FUNCTION public.admin_list_users(integer, integer, text, text) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.admin_create_anime_with_episodes(jsonb, jsonb) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.admin_replace_anime_episodes(uuid, jsonb) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.admin_grant_user_subscription(uuid, uuid, integer, text) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.admin_extend_user_subscription(uuid, integer, text) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.admin_revoke_user_subscription(uuid, text) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.admin_toggle_user_vip(uuid) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.admin_update_anime_and_episodes(uuid, jsonb, jsonb) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.assistant_has_permission(text) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.assistant_can_manage_content() SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.main_admin_search_assistant_candidates(text) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.main_admin_list_assistant_admins() SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.main_admin_appoint_assistant(uuid) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.main_admin_set_assistant_permissions(uuid, jsonb) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.main_admin_remove_assistant(uuid) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.main_admin_revoke_all_assistant_permissions() SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.assistant_create_anime_with_episodes(jsonb, jsonb) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.assistant_update_anime_and_episodes(uuid, jsonb, jsonb) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.assistant_update_anime_and_episodes_authorized(uuid, jsonb, jsonb) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.prevent_assistant_content_escalation() SET search_path = pg_catalog, public, pg_temp;

-- Do not allow application roles to create objects in the function search schema.
REVOKE CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.assistant_can_manage_content()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.assistant_admin_permissions ap ON ap.user_id = p.id
    WHERE p.id = auth.uid() AND p.role = 'assistant_admin' AND p.suspended_at IS NULL
      AND ap.enabled AND (
        ap.permission_key IN ('anime_view', 'anime_edit', 'anime_delete', 'episode_edit', 'episode_delete')
        OR (ap.permission_key = 'episode_create' AND public.assistant_has_permission('video_upload'))
      )
  );
$$;
DROP POLICY IF EXISTS "assistant anime read" ON public.animes;
CREATE POLICY "assistant anime read" ON public.animes FOR SELECT TO authenticated
  USING (public.assistant_can_manage_content());
DROP POLICY IF EXISTS "assistant episodes read" ON public.episodes;
CREATE POLICY "assistant episodes read" ON public.episodes FOR SELECT TO authenticated
  USING (public.assistant_can_manage_content());
REVOKE ALL ON FUNCTION public.assistant_can_manage_content() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.assistant_can_manage_content() TO authenticated;

-- Inert feature keys remain in the schema for compatibility but cannot be enabled.
UPDATE public.assistant_admin_permissions
SET enabled = false, updated_at = now()
WHERE permission_key IN ('video_review', 'comment_moderate', 'report_view') AND enabled;

CREATE OR REPLACE FUNCTION public.main_admin_set_assistant_permissions(p_target_user_id uuid, p_permissions jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_key text;
  v_expected_count integer := 12;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_actor AND role = 'owner' AND suspended_at IS NULL) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_permissions IS NULL OR jsonb_typeof(p_permissions) IS DISTINCT FROM 'object'
     OR (SELECT count(*) FROM jsonb_object_keys(p_permissions)) <> v_expected_count THEN
    RAISE EXCEPTION 'permissions must be a complete JSON object';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_each(p_permissions) e
    WHERE e.key NOT IN ('anime_view','anime_create','anime_edit','anime_delete','video_upload',
      'episode_create','episode_edit','episode_delete','video_analyze','video_review','comment_moderate','report_view')
      OR jsonb_typeof(e.value) IS DISTINCT FROM 'boolean'
      OR (e.key IN ('video_review','comment_moderate','report_view') AND e.value = 'true'::jsonb)
  ) THEN RAISE EXCEPTION 'invalid or unavailable assistant permission'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.assistant_admins WHERE user_id = p_target_user_id) THEN
    RAISE EXCEPTION 'assistant admin not found' USING ERRCODE = 'P0002';
  END IF;
  FOR v_key IN SELECT permission_key FROM public.assistant_admin_permissions WHERE user_id = p_target_user_id LOOP
    UPDATE public.assistant_admin_permissions
    SET enabled = (p_permissions->>v_key)::boolean, updated_at = now()
    WHERE user_id = p_target_user_id AND permission_key = v_key;
  END LOOP;
  INSERT INTO public.assistant_admin_audit_logs(actor_id, action_name, target_user_id, details)
  VALUES (v_actor, 'assistant_permissions_updated', p_target_user_id, p_permissions);
END;
$$;
REVOKE ALL ON FUNCTION public.main_admin_set_assistant_permissions(uuid, jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.main_admin_set_assistant_permissions(uuid, jsonb) TO authenticated;

-- Replacement is one transaction. Match by the existing unique (anime_id, number)
-- identity, retain row IDs and published state, and refuse to discard published rows.
CREATE OR REPLACE FUNCTION public.assistant_update_anime_and_episodes(
  p_anime_id uuid, p_anime jsonb, p_episodes jsonb DEFAULT NULL
)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_episode_count integer := 0;
  v_rows integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_actor AND role = 'assistant_admin' AND suspended_at IS NULL) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_anime IS NULL OR jsonb_typeof(p_anime) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'anime patch must be an object'; END IF;
  IF p_anime <> '{}'::jsonb AND NOT public.assistant_has_permission('anime_edit') THEN RAISE EXCEPTION 'anime_edit required' USING ERRCODE = '42501'; END IF;
  IF p_episodes IS NOT NULL AND NOT (
    public.assistant_has_permission('episode_edit') AND public.assistant_has_permission('episode_create')
    AND public.assistant_has_permission('episode_delete') AND public.assistant_has_permission('video_upload')
  ) THEN RAISE EXCEPTION 'all episode replacement permissions are required' USING ERRCODE = '42501'; END IF;
  IF p_anime ? 'genres' AND jsonb_typeof(p_anime->'genres') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'genres must be an array'; END IF;

  PERFORM 1 FROM public.animes WHERE id = p_anime_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'anime not found' USING ERRCODE = 'P0002'; END IF;
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
  END IF;

  IF p_episodes IS NOT NULL THEN
    IF jsonb_typeof(p_episodes) IS DISTINCT FROM 'array' OR jsonb_array_length(p_episodes) < 1 OR jsonb_array_length(p_episodes) > 500 THEN
      RAISE EXCEPTION 'episode list must contain 1..500 entries';
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_to_recordset(p_episodes) AS e(season_number integer, number integer, title text, video_url text, is_published boolean)
      WHERE e.season_number IS NULL OR e.season_number < 1 OR e.number IS NULL OR e.number < 1
        OR e.video_url IS NULL OR e.video_url !~* '^https?://' OR coalesce(e.is_published, false)) THEN
      RAISE EXCEPTION 'invalid episode fields or assistant publish attempt';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.episodes old
      WHERE old.anime_id = p_anime_id AND old.is_published
        AND NOT EXISTS (SELECT 1 FROM jsonb_to_recordset(p_episodes) AS e(number integer) WHERE e.number = old.number)
    ) THEN RAISE EXCEPTION 'published episodes cannot be removed by an assistant'; END IF;

    UPDATE public.episodes old SET
      season_number = e.season_number, number = e.number, title = e.title, description = e.description,
      video_url = e.video_url, thumbnail_url = e.thumbnail_url, quality = coalesce(e.quality, '1080p')
    FROM jsonb_to_recordset(p_episodes) AS e(
      season_number integer, number integer, title text, description text, video_url text,
      thumbnail_url text, is_published boolean, quality text
    )
    WHERE old.anime_id = p_anime_id AND old.number = e.number;
    DELETE FROM public.episodes old WHERE old.anime_id = p_anime_id
      AND NOT EXISTS (SELECT 1 FROM jsonb_to_recordset(p_episodes) AS e(number integer) WHERE e.number = old.number);
    INSERT INTO public.episodes(anime_id, season_number, number, title, description, video_url, thumbnail_url, is_published, quality)
    SELECT p_anime_id, e.season_number, e.number, e.title, e.description, e.video_url, e.thumbnail_url, false, coalesce(e.quality, '1080p')
    FROM jsonb_to_recordset(p_episodes) AS e(
      season_number integer, number integer, title text, description text, video_url text,
      thumbnail_url text, is_published boolean, quality text
    ) WHERE NOT EXISTS (SELECT 1 FROM public.episodes old WHERE old.anime_id = p_anime_id AND old.number = e.number);
    v_episode_count := jsonb_array_length(p_episodes);
  END IF;
  RETURN v_episode_count;
END;
$$;

-- Successful assistant content changes are captured by row triggers. Snapshots omit
-- video URLs and user-supplied text; only bounded metadata and IDs are stored.
CREATE OR REPLACE FUNCTION public.audit_assistant_content_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_action text;
  v_record_id text;
  v_details jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_actor AND role = 'assistant_admin') THEN
    RETURN NULL;
  END IF;
  v_record_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id::text ELSE NEW.id::text END;
  IF TG_TABLE_NAME = 'animes' THEN
    v_action := CASE TG_OP WHEN 'INSERT' THEN 'anime_created' WHEN 'UPDATE' THEN 'anime_updated' ELSE 'anime_deleted' END;
    v_details := jsonb_build_object('entity','anime','operation',TG_OP,
      'published',CASE WHEN TG_OP = 'DELETE' THEN OLD.is_published ELSE NEW.is_published END,
      'year',CASE WHEN TG_OP = 'DELETE' THEN OLD.year ELSE NEW.year END);
  ELSE
    v_action := CASE TG_OP WHEN 'INSERT' THEN 'episode_created' WHEN 'UPDATE' THEN
      CASE WHEN NEW.video_url IS DISTINCT FROM OLD.video_url THEN 'episode_video_source_changed' ELSE 'episode_updated' END
      ELSE 'episode_deleted' END;
    v_details := jsonb_build_object('entity','episode','operation',TG_OP,
      'anime_id',CASE WHEN TG_OP = 'DELETE' THEN OLD.anime_id ELSE NEW.anime_id END,
      'number',CASE WHEN TG_OP = 'DELETE' THEN OLD.number ELSE NEW.number END,
      'published',CASE WHEN TG_OP = 'DELETE' THEN OLD.is_published ELSE NEW.is_published END,
      'video_url_changed',TG_OP = 'UPDATE' AND NEW.video_url IS DISTINCT FROM OLD.video_url);
  END IF;
  INSERT INTO public.assistant_admin_audit_logs(actor_id, action_name, target_record_id, details)
  VALUES (v_actor, v_action, v_record_id, v_details || jsonb_build_object('result','success'));
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS assistant_anime_audit ON public.animes;
CREATE TRIGGER assistant_anime_audit AFTER INSERT OR UPDATE OR DELETE ON public.animes
  FOR EACH ROW EXECUTE FUNCTION public.audit_assistant_content_change();
DROP TRIGGER IF EXISTS assistant_episode_audit ON public.episodes;
CREATE TRIGGER assistant_episode_audit AFTER INSERT OR UPDATE OR DELETE ON public.episodes
  FOR EACH ROW EXECUTE FUNCTION public.audit_assistant_content_change();
REVOKE ALL ON FUNCTION public.audit_assistant_content_change() FROM PUBLIC, anon, authenticated, service_role;

-- Server handlers may record failures using only a verified JWT subject and a
-- small allowlist. No caller-supplied actor, raw error, URL, or payload is stored.
CREATE OR REPLACE FUNCTION public.assistant_log_content_failure(
  p_action text, p_target_record_id text DEFAULT NULL, p_target_anime_id uuid DEFAULT NULL,
  p_failure_code text DEFAULT 'operation_failed'
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = v_actor AND role = 'assistant_admin' AND suspended_at IS NULL
  ) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF p_action IS NULL OR p_failure_code IS NULL
     OR p_action NOT IN ('anime_create','anime_update','anime_delete','episode_create','episode_update','episode_delete','episode_replace','video_source_change')
     OR p_failure_code NOT IN ('validation_failed','authorization_denied','operation_failed')
     OR (p_target_record_id IS NOT NULL AND p_target_record_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') THEN
    RAISE EXCEPTION 'invalid audit event';
  END IF;
  INSERT INTO public.assistant_admin_audit_logs(actor_id, action_name, target_record_id, details)
  VALUES (v_actor, p_action || '_failed', p_target_record_id,
    jsonb_build_object('result','failure','failure_code',p_failure_code,'anime_id',p_target_anime_id));
END;
$$;
REVOKE ALL ON FUNCTION public.assistant_log_content_failure(text, text, uuid, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.assistant_log_content_failure(text, text, uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.assistant_update_anime_and_episodes(uuid, jsonb, jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.assistant_update_anime_and_episodes_authorized(uuid, jsonb, jsonb) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.assistant_update_anime_and_episodes_authorized(uuid, jsonb, jsonb) TO authenticated;

-- Avatar security guard: prevent direct injection of unauthorized or external avatar URLs into profiles
CREATE OR REPLACE FUNCTION public.profiles_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.role IS DISTINCT FROM OLD.role
       OR NEW.suspended_at IS DISTINCT FROM OLD.suspended_at
       OR NEW.subscription_plan IS DISTINCT FROM OLD.subscription_plan
       OR NEW.subscription_expires_at IS DISTINCT FROM OLD.subscription_expires_at THEN
      RAISE EXCEPTION 'privileged fields can only be changed by an administrator'
        USING ERRCODE = '42501';
    END IF;

    -- Strict avatar URL validation: must be NULL or match own profile-avatars folder with allowed image extension
    IF NEW.avatar_url IS DISTINCT FROM OLD.avatar_url AND NEW.avatar_url IS NOT NULL THEN
      IF NEW.avatar_url !~* ('^https?://[^/]+/storage/v1/object/public/profile-avatars/' || auth.uid()::text || '/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$') THEN
        RAISE EXCEPTION 'invalid or unauthorized avatar url'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
