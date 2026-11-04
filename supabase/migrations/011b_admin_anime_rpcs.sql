-- Forward-only bridge migration: safely introduces missing admin anime RPCs
-- without re-running obsolete 011 subscription logic or changing profiles RLS policies.
-- Safe to run on both Production and Staging.

CREATE OR REPLACE FUNCTION public.admin_create_anime_with_episodes(
  p_anime jsonb,
  p_episodes jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_anime public.animes%ROWTYPE;
  v_episode_count integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_anime IS NULL OR jsonb_typeof(p_anime) <> 'object' THEN
    RAISE EXCEPTION 'anime payload must be a JSON object';
  END IF;
  IF p_episodes IS NULL OR jsonb_typeof(p_episodes) <> 'array' THEN
    RAISE EXCEPTION 'episodes payload must be a JSON array';
  END IF;
  IF jsonb_array_length(p_episodes) > 500 THEN
    RAISE EXCEPTION 'at most 500 episodes are allowed';
  END IF;
  IF p_anime ? 'genres' AND jsonb_typeof(p_anime->'genres') <> 'array' THEN
    RAISE EXCEPTION 'genres must be an array';
  END IF;

  INSERT INTO public.animes (
    title, alt_title, description, year, status, age_rating, genres, studio, director,
    poster_url, banner_url, is_featured, is_published, release_day, fandub_team
  )
  VALUES (
    p_anime->>'title',
    p_anime->>'alt_title',
    coalesce(p_anime->>'description', ''),
    nullif(p_anime->>'year', '')::integer,
    coalesce(p_anime->>'status', 'Tugallangan'),
    coalesce(p_anime->>'age_rating', '12+'),
    CASE 
      WHEN p_anime ? 'genres' THEN ARRAY(SELECT jsonb_array_elements_text(p_anime->'genres'))
      ELSE '{}'::text[]
    END,
    p_anime->>'studio',
    p_anime->>'director',
    p_anime->>'poster_url',
    p_anime->>'banner_url',
    coalesce((p_anime->>'is_featured')::boolean, false),
    coalesce((p_anime->>'is_published')::boolean, true),
    p_anime->>'release_day',
    coalesce(p_anime->>'fandub_team', 'Anicity Dub')
  )
  RETURNING * INTO v_anime;

  v_episode_count := jsonb_array_length(p_episodes);
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
      RAISE EXCEPTION 'invalid episode fields in episode list';
    END IF;

    -- Duplicate check: ensure payload does not contain duplicate (season_number, number) entries
    IF (
      SELECT count(*) FROM (
        SELECT DISTINCT e.season_number, e.number
        FROM jsonb_to_recordset(p_episodes) AS e(season_number integer, number integer)
      ) d
    ) <> v_episode_count THEN
      RAISE EXCEPTION 'duplicate episode season_number and number in payload' USING ERRCODE = '23505';
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

REVOKE ALL ON FUNCTION public.admin_create_anime_with_episodes(jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_anime_with_episodes(jsonb, jsonb) TO authenticated;

-- Non-destructive compatibility wrapper delegating to atomic admin_update_anime_and_episodes
CREATE OR REPLACE FUNCTION public.admin_replace_anime_episodes(
  p_anime_id uuid,
  p_episodes jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  -- Safe delegation: routes through audited atomic updater
  RETURN public.admin_update_anime_and_episodes(p_anime_id, '{}'::jsonb, p_episodes);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_replace_anime_episodes(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_replace_anime_episodes(uuid, jsonb) TO authenticated;
