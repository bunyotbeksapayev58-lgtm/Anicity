-- ============================================================================
-- 018_vip_access_columns.sql — VIP Gating Schema Columns & Query Optimization
-- ============================================================================

-- 1. Add requires_vip to episodes
ALTER TABLE public.episodes 
ADD COLUMN IF NOT EXISTS requires_vip BOOLEAN NOT NULL DEFAULT false;

-- 2. Add is_vip_only to animes
ALTER TABLE public.animes 
ADD COLUMN IF NOT EXISTS is_vip_only BOOLEAN NOT NULL DEFAULT false;

-- 3. Indexes for fast filtering on catalog and watch pages
CREATE INDEX IF NOT EXISTS idx_episodes_requires_vip ON public.episodes (requires_vip);
CREATE INDEX IF NOT EXISTS idx_animes_is_vip_only ON public.animes (is_vip_only);
