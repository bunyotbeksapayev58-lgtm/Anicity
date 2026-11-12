-- ============================================================================
-- 019_guest_access_and_security.sql — Guest (Anon) Catalog Access & Public RLS
-- ============================================================================
-- Allows non-authenticated visitors (guests) and SEO crawlers to view
-- published animes, episodes list, trailers, active banners, and plans.
-- Write operations remain strictly restricted to staff/admins.
-- ============================================================================

-- 1. SCHEMA PERMISSIONS FOR ANON ROLE
GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT ON public.animes TO anon, authenticated;
GRANT SELECT ON public.banners TO anon, authenticated;
GRANT SELECT ON public.trailers TO anon, authenticated;
GRANT SELECT ON public.seasons TO anon, authenticated;
GRANT SELECT ON public.episodes TO anon, authenticated;
GRANT SELECT ON public.episode_subtitles TO anon, authenticated;
GRANT SELECT ON public.subscription_plans TO anon, authenticated;
GRANT SELECT ON public.site_settings TO anon, authenticated;

-- 2. RLS POLICIES FOR PUBLIC READ ACCESS

-- Animes: Guests and users see published animes; staff see all
DROP POLICY IF EXISTS "animes read" ON public.animes;
CREATE POLICY "animes read" ON public.animes FOR SELECT TO anon, authenticated
  USING (is_published OR public.is_staff());

-- Banners: Guests and users see active banners within date bounds
DROP POLICY IF EXISTS "banners read" ON public.banners;
CREATE POLICY "banners read" ON public.banners FOR SELECT TO anon, authenticated
  USING (is_active AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at > now()));

-- Trailers: Guests and users see active trailers
DROP POLICY IF EXISTS "trailers read" ON public.trailers;
CREATE POLICY "trailers read" ON public.trailers FOR SELECT TO anon, authenticated
  USING (is_active);

-- Seasons: Viewable if parent anime is published
DROP POLICY IF EXISTS "seasons read" ON public.seasons;
CREATE POLICY "seasons read" ON public.seasons FOR SELECT TO anon, authenticated
  USING (public.is_staff() OR EXISTS (
    SELECT 1 FROM public.animes a WHERE a.id = seasons.anime_id AND a.is_published
  ));

-- Episodes: Viewable if published and parent anime is published
DROP POLICY IF EXISTS "episodes read" ON public.episodes;
CREATE POLICY "episodes read" ON public.episodes FOR SELECT TO anon, authenticated
  USING (public.is_staff() OR (
    episodes.is_published AND EXISTS (
      SELECT 1 FROM public.animes a WHERE a.id = episodes.anime_id AND a.is_published
    )
  ));

-- Subtitles: Viewable if episode and anime are published
DROP POLICY IF EXISTS "subtitles read" ON public.episode_subtitles;
CREATE POLICY "subtitles read" ON public.episode_subtitles FOR SELECT TO anon, authenticated
  USING (public.is_staff() OR EXISTS (
    SELECT 1 FROM public.episodes e 
    JOIN public.animes a ON a.id = e.anime_id
    WHERE e.id = episode_subtitles.episode_id AND e.is_published AND a.is_published
  ));

-- Subscription Plans: Publicly visible to everyone
DROP POLICY IF EXISTS "Plans are viewable by everyone" ON public.subscription_plans;
CREATE POLICY "Plans are viewable by everyone" ON public.subscription_plans FOR SELECT TO anon, authenticated
  USING (is_active = true OR public.is_admin());

-- Site Settings: Publicly visible for dynamic white-label branding
DROP POLICY IF EXISTS "site settings read" ON public.site_settings;
CREATE POLICY "site settings read" ON public.site_settings FOR SELECT TO anon, authenticated
  USING (true);
