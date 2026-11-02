-- Migration 008: Admin Decoupled Anime & Episode Management Upgrade
-- 1. Add age_rating and is_featured columns to public.animes
ALTER TABLE public.animes 
  ADD COLUMN IF NOT EXISTS age_rating text DEFAULT '12+',
  ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false;

-- 2. Add description and season_number columns to public.episodes
ALTER TABLE public.episodes 
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS season_number integer DEFAULT 1;

-- 3. Update uniqueness constraint to allow season-based numbering
ALTER TABLE public.episodes DROP CONSTRAINT IF EXISTS episodes_anime_id_number_key;
ALTER TABLE public.episodes DROP CONSTRAINT IF EXISTS episodes_anime_season_number_key;
ALTER TABLE public.episodes ADD CONSTRAINT episodes_anime_season_number_key UNIQUE (anime_id, season_number, number);

-- 4. Create index for fast season queries
CREATE INDEX IF NOT EXISTS idx_episodes_anime_season ON public.episodes (anime_id, season_number, number);
