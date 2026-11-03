-- Tighten assistant read scope and protect the episode-replacement RPC.
-- Migration 013 remains immutable; this migration only adds forward-compatible guards.

CREATE OR REPLACE FUNCTION public.assistant_can_manage_content()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.assistant_admin_permissions ap ON ap.user_id = p.id
    WHERE p.id = auth.uid()
      AND p.role = 'assistant_admin'
      AND p.suspended_at IS NULL
      AND ap.enabled
      AND ap.permission_key IN (
        'anime_view', 'anime_edit', 'anime_delete', 'video_upload',
        'episode_create', 'episode_edit', 'episode_delete'
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.assistant_update_anime_and_episodes_authorized(
  p_anime_id uuid, p_anime jsonb, p_episodes jsonb DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_actor AND role = 'assistant_admin' AND suspended_at IS NULL
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_anime IS NULL OR jsonb_typeof(p_anime) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'anime patch must be a JSON object';
  END IF;
  IF p_anime <> '{}'::jsonb AND NOT public.assistant_has_permission('anime_edit') THEN
    RAISE EXCEPTION 'anime_edit permission is required' USING ERRCODE = '42501';
  END IF;

  -- The legacy RPC replaces the whole episode set (delete + insert). Require
  -- every corresponding permission before invoking it under this definer.
  IF p_episodes IS NOT NULL AND NOT (
    public.assistant_has_permission('episode_edit')
    AND public.assistant_has_permission('episode_create')
    AND public.assistant_has_permission('episode_delete')
    AND public.assistant_has_permission('video_upload')
  ) THEN
    RAISE EXCEPTION 'episode_edit, episode_create, episode_delete and video_upload permissions are required'
      USING ERRCODE = '42501';
  END IF;

  RETURN public.assistant_update_anime_and_episodes(p_anime_id, p_anime, p_episodes);
END;
$$;

REVOKE ALL ON FUNCTION public.assistant_update_anime_and_episodes(uuid, jsonb, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.assistant_update_anime_and_episodes_authorized(uuid, jsonb, jsonb)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.assistant_update_anime_and_episodes_authorized(uuid, jsonb, jsonb)
  TO authenticated;

REVOKE ALL ON FUNCTION public.assistant_can_manage_content() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.assistant_can_manage_content() TO authenticated;
