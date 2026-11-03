-- Correct the assistant replacement match key: migration 008 allows the same
-- episode number in different seasons, so identity is (anime_id, season_number, number).
CREATE OR REPLACE FUNCTION public.assistant_update_anime_and_episodes(
  p_anime_id uuid, p_anime jsonb, p_episodes jsonb DEFAULT NULL
)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_episode_count integer := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_actor AND role = 'assistant_admin' AND suspended_at IS NULL) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_anime IS NULL OR jsonb_typeof(p_anime) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'anime patch must be an object';
  END IF;
  IF p_anime <> '{}'::jsonb AND NOT public.assistant_has_permission('anime_edit') THEN
    RAISE EXCEPTION 'anime_edit required' USING ERRCODE = '42501';
  END IF;
  IF p_episodes IS NOT NULL AND NOT (
    public.assistant_has_permission('episode_edit') AND public.assistant_has_permission('episode_create')
    AND public.assistant_has_permission('episode_delete') AND public.assistant_has_permission('video_upload')
  ) THEN RAISE EXCEPTION 'all episode replacement permissions are required' USING ERRCODE = '42501'; END IF;
  IF p_anime ? 'genres' AND jsonb_typeof(p_anime->'genres') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'genres must be an array';
  END IF;

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
    IF EXISTS (
      SELECT 1 FROM jsonb_to_recordset(p_episodes) AS e(season_number integer, number integer, title text, video_url text, is_published boolean)
      WHERE e.season_number IS NULL OR e.season_number < 1 OR e.number IS NULL OR e.number < 1
        OR e.video_url IS NULL OR e.video_url !~* '^https?://' OR coalesce(e.is_published, false)
    ) THEN RAISE EXCEPTION 'invalid episode fields or assistant publish attempt'; END IF;
    IF EXISTS (
      SELECT 1 FROM public.episodes old
      WHERE old.anime_id = p_anime_id AND old.is_published
        AND NOT EXISTS (
          SELECT 1 FROM jsonb_to_recordset(p_episodes) AS e(season_number integer, number integer)
          WHERE e.season_number = old.season_number AND e.number = old.number
        )
    ) THEN RAISE EXCEPTION 'published episodes cannot be removed by an assistant'; END IF;

    UPDATE public.episodes old SET
      season_number = e.season_number, number = e.number, title = e.title, description = e.description,
      video_url = e.video_url, thumbnail_url = e.thumbnail_url, quality = coalesce(e.quality, '1080p')
    FROM jsonb_to_recordset(p_episodes) AS e(
      season_number integer, number integer, title text, description text, video_url text,
      thumbnail_url text, is_published boolean, quality text
    )
    WHERE old.anime_id = p_anime_id AND old.season_number = e.season_number AND old.number = e.number;

    DELETE FROM public.episodes old WHERE old.anime_id = p_anime_id
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_to_recordset(p_episodes) AS e(season_number integer, number integer)
        WHERE e.season_number = old.season_number AND e.number = old.number
      );

    INSERT INTO public.episodes(anime_id, season_number, number, title, description, video_url, thumbnail_url, is_published, quality)
    SELECT p_anime_id, e.season_number, e.number, e.title, e.description, e.video_url,
      e.thumbnail_url, false, coalesce(e.quality, '1080p')
    FROM jsonb_to_recordset(p_episodes) AS e(
      season_number integer, number integer, title text, description text, video_url text,
      thumbnail_url text, is_published boolean, quality text
    )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.episodes old WHERE old.anime_id = p_anime_id
        AND old.season_number = e.season_number AND old.number = e.number
    );
    v_episode_count := jsonb_array_length(p_episodes);
  END IF;
  RETURN v_episode_count;
END;
$$;

-- Preserve the permission boundary from 014/015: callers use the authorized wrapper;
-- direct execution of this definer remains revoked.
REVOKE ALL ON FUNCTION public.assistant_update_anime_and_episodes(uuid, jsonb, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
