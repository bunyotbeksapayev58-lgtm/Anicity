-- ============================================================================
-- ANICITY PLATFORM — FULL CONSOLIDATED PRODUCTION DATABASE SCHEMA
-- Single-file turnkey SQL deployment for Supabase / PostgreSQL.
-- Run this entire script in Supabase SQL Editor to set up everything.
-- ============================================================================

-- 0. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. SCHEMAS & GRANTS
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- ============================================================================
-- TABLES DEFINITION
-- ============================================================================

-- ---------- profiles ----------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL CONSTRAINT profiles_username_len CHECK (char_length(username) BETWEEN 3 AND 30),
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT CONSTRAINT profiles_bio_len CHECK (bio IS NULL OR char_length(bio) <= 500),
  role TEXT NOT NULL DEFAULT 'user' CONSTRAINT profiles_role_valid CHECK (role IN ('user', 'assistant', 'admin', 'owner')),
  subscription_plan TEXT NOT NULL DEFAULT 'free' CONSTRAINT profiles_sub_valid CHECK (subscription_plan IN ('free', 'vip', 'premium')),
  subscription_expires_at TIMESTAMPTZ,
  suspended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- animes ----------
CREATE TABLE IF NOT EXISTS public.animes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  alt_title TEXT,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  poster_url TEXT,
  banner_url TEXT,
  year INT CONSTRAINT animes_year_valid CHECK (year IS NULL OR (year BETWEEN 1900 AND 2100)),
  status TEXT NOT NULL DEFAULT 'ongoing' CONSTRAINT animes_status_valid CHECK (status IN ('ongoing', 'completed', 'announced')),
  age_rating TEXT NOT NULL DEFAULT '13+' CONSTRAINT animes_age_valid CHECK (age_rating IN ('0+', '6+', '12+', '13+', '16+', '18+')),
  type TEXT NOT NULL DEFAULT 'tv' CONSTRAINT animes_type_valid CHECK (type IN ('tv', 'movie', 'ova', 'ona', 'special')),
  episodes_count INT NOT NULL DEFAULT 0 CONSTRAINT animes_episodes_nonneg CHECK (episodes_count >= 0),
  duration_min INT CONSTRAINT animes_duration_positive CHECK (duration_min IS NULL OR duration_min > 0),
  studio TEXT,
  release_day TEXT CONSTRAINT animes_day_valid CHECK (release_day IS NULL OR release_day IN ('dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba', 'yakshanba')),
  fandub_team TEXT,
  rating_avg NUMERIC(3, 2) NOT NULL DEFAULT 0 CONSTRAINT animes_rating_range CHECK (rating_avg BETWEEN 0 AND 10),
  rating_count INT NOT NULL DEFAULT 0 CONSTRAINT animes_rating_count_nonneg CHECK (rating_count >= 0),
  view_count BIGINT NOT NULL DEFAULT 0 CONSTRAINT animes_views_nonneg CHECK (view_count >= 0),
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_published BOOLEAN NOT NULL DEFAULT true,
  is_vip_only BOOLEAN NOT NULL DEFAULT false,
  genres TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- seasons ----------
CREATE TABLE IF NOT EXISTS public.seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anime_id UUID NOT NULL REFERENCES public.animes(id) ON DELETE CASCADE,
  number INT NOT NULL CONSTRAINT seasons_number_positive CHECK (number > 0),
  title TEXT,
  episodes_count INT NOT NULL DEFAULT 0 CONSTRAINT seasons_episodes_nonneg CHECK (episodes_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT seasons_anime_number_unique UNIQUE (anime_id, number)
);

-- ---------- episodes ----------
CREATE TABLE IF NOT EXISTS public.episodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anime_id UUID NOT NULL REFERENCES public.animes(id) ON DELETE CASCADE,
  season_id UUID REFERENCES public.seasons(id) ON DELETE SET NULL,
  season_number INT NOT NULL DEFAULT 1,
  number INT NOT NULL CONSTRAINT episodes_number_positive CHECK (number > 0),
  title TEXT,
  description TEXT,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  quality TEXT DEFAULT '1080p',
  is_published BOOLEAN NOT NULL DEFAULT true,
  requires_vip BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT episodes_anime_season_number_unique UNIQUE (anime_id, season_number, number)
);

-- ---------- episode_subtitles ----------
CREATE TABLE IF NOT EXISTS public.episode_subtitles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id UUID NOT NULL REFERENCES public.episodes(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- favorites ----------
CREATE TABLE IF NOT EXISTS public.favorites (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  anime_id UUID NOT NULL REFERENCES public.animes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, anime_id)
);

-- ---------- watch_progress ----------
CREATE TABLE IF NOT EXISTS public.watch_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  episode_id UUID NOT NULL REFERENCES public.episodes(id) ON DELETE CASCADE,
  anime_id UUID NOT NULL REFERENCES public.animes(id) ON DELETE CASCADE,
  position_sec DOUBLE PRECISION NOT NULL DEFAULT 0 CONSTRAINT progress_position_nonneg CHECK (position_sec >= 0),
  duration_sec DOUBLE PRECISION NOT NULL DEFAULT 0 CONSTRAINT progress_duration_nonneg CHECK (duration_sec >= 0),
  completed BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT progress_user_episode_unique UNIQUE (user_id, episode_id)
);

-- ---------- ratings ----------
CREATE TABLE IF NOT EXISTS public.ratings (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  anime_id UUID NOT NULL REFERENCES public.animes(id) ON DELETE CASCADE,
  score INT NOT NULL CONSTRAINT ratings_score_range CHECK (score BETWEEN 1 AND 10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, anime_id)
);

-- ---------- comments ----------
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anime_id UUID NOT NULL REFERENCES public.animes(id) ON DELETE CASCADE,
  episode_id UUID REFERENCES public.episodes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  body TEXT NOT NULL CONSTRAINT comments_body_len CHECK (char_length(body) BETWEEN 1 AND 2000),
  is_spoiler BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'visible' CONSTRAINT comments_status_valid CHECK (status IN ('visible', 'hidden')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- banners ----------
CREATE TABLE IF NOT EXISTS public.banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subtitle TEXT,
  image_url TEXT NOT NULL,
  video_url TEXT,
  link_url TEXT,
  anime_id UUID REFERENCES public.animes(id) ON DELETE SET NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- trailers ----------
CREATE TABLE IF NOT EXISTS public.trailers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anime_id UUID NOT NULL REFERENCES public.animes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  duration_text TEXT,
  clip_type TEXT NOT NULL DEFAULT 'trailer' CONSTRAINT trailers_clip_type CHECK (clip_type IN ('trailer', 'teaser', 'opening', 'ending', 'clip')),
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- subscription_plans ----------
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  price_uzs BIGINT NOT NULL DEFAULT 0,
  duration_days INT NOT NULL DEFAULT 30,
  benefits JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_popular BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- user_subscriptions ----------
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  plan_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CONSTRAINT sub_status CHECK (status IN ('active', 'expired', 'cancelled', 'pending')),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  grant_type TEXT NOT NULL DEFAULT 'online_payment' CONSTRAINT sub_grant CHECK (grant_type IN ('manual_admin', 'online_payment', 'promo_code', 'system')),
  admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- subscription_transactions ----------
CREATE TABLE IF NOT EXISTS public.subscription_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  amount_uzs BIGINT NOT NULL,
  currency TEXT DEFAULT 'UZS',
  provider TEXT NOT NULL DEFAULT 'click' CONSTRAINT tx_provider CHECK (provider IN ('payme', 'click', 'uzum', 'manual', 'other')),
  status TEXT NOT NULL DEFAULT 'pending' CONSTRAINT tx_status CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  provider_tx_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- subscription_audit_logs ----------
CREATE TABLE IF NOT EXISTS public.subscription_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  previous_plan TEXT,
  previous_expires_at TIMESTAMPTZ,
  new_plan TEXT,
  new_expires_at TIMESTAMPTZ,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- site_settings (White-label & branding) ----------
CREATE TABLE IF NOT EXISTS public.site_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- distributed_rate_limits ----------
CREATE TABLE IF NOT EXISTS public.distributed_rate_limits (
  bucket_key TEXT PRIMARY KEY,
  hits INT NOT NULL DEFAULT 1,
  expires_at_epoch BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- INDEXES FOR MAXIMUM QUERY SPEED
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_animes_slug ON public.animes(slug);
CREATE INDEX IF NOT EXISTS idx_animes_status_published ON public.animes(status, is_published);
CREATE INDEX IF NOT EXISTS idx_animes_is_vip_only ON public.animes(is_vip_only);
CREATE INDEX IF NOT EXISTS idx_episodes_anime_number ON public.episodes(anime_id, number);
CREATE INDEX IF NOT EXISTS idx_episodes_requires_vip ON public.episodes(requires_vip);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_status ON public.user_subscriptions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_subscription_tx_trans_id ON public.subscription_transactions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_watch_progress_user_anime ON public.watch_progress(user_id, anime_id);
CREATE INDEX IF NOT EXISTS idx_rate_limits_expires ON public.distributed_rate_limits(expires_at_epoch);

-- ============================================================================
-- HELPER FUNCTIONS & RLS SECURITY
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_staff() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('admin', 'owner', 'assistant') AND suspended_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('admin', 'owner') AND suspended_at IS NULL
  );
$$;

-- RLS ACTIVATION
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.animes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.episode_subtitles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watch_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trailers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- PUBLIC READ POLICIES (Guests + Authenticated Users)
CREATE POLICY "public_read_animes" ON public.animes FOR SELECT TO anon, authenticated
  USING (is_published = true OR public.is_staff());

CREATE POLICY "public_read_seasons" ON public.seasons FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "public_read_episodes" ON public.episodes FOR SELECT TO anon, authenticated
  USING (is_published = true OR public.is_staff());

CREATE POLICY "public_read_subtitles" ON public.episode_subtitles FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "public_read_banners" ON public.banners FOR SELECT TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "public_read_trailers" ON public.trailers FOR SELECT TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "public_read_plans" ON public.subscription_plans FOR SELECT TO anon, authenticated
  USING (is_active = true OR public.is_admin());

CREATE POLICY "public_read_settings" ON public.site_settings FOR SELECT TO anon, authenticated
  USING (true);

-- USER SPECIFIC POLICIES
CREATE POLICY "profiles_read_all" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "favorites_user_access" ON public.favorites FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "progress_user_access" ON public.watch_progress FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ratings_user_access" ON public.ratings FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "comments_read_all" ON public.comments FOR SELECT TO anon, authenticated
  USING (status = 'visible' OR public.is_staff());

CREATE POLICY "comments_insert_user" ON public.comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "subs_read_own" ON public.user_subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "tx_read_own" ON public.subscription_transactions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

-- ADMIN WRITE POLICIES
CREATE POLICY "admin_all_animes" ON public.animes FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "admin_all_episodes" ON public.episodes FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "admin_all_banners" ON public.banners FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "admin_all_trailers" ON public.trailers FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "admin_all_plans" ON public.subscription_plans FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "admin_all_settings" ON public.site_settings FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "admin_all_subscriptions" ON public.user_subscriptions FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "admin_all_transactions" ON public.subscription_transactions FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "admin_all_audit" ON public.subscription_audit_logs FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================================
-- DEFAULT SEED DATA
-- ============================================================================

-- Site Settings Default
INSERT INTO public.site_settings (key, value)
VALUES ('site', '{"name": "AniCity", "tagline": "Premium Anime Cinema", "primary_color": "#ff3366", "accent_color": "#9933ff"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Default VIP Subscription Plans
INSERT INTO public.subscription_plans (name, slug, description, price_uzs, duration_days, benefits, is_active, is_popular, sort_order)
VALUES 
  ('VIP 1 Oy', 'vip-1-month', 'Boshlang‘ich VIP obuna', 25000, 30, '["1080p Full HD sifat", "100% Reklamasiz", "VIP nishoni"]'::jsonb, true, false, 1),
  ('VIP 3 Oy', 'vip-3-month', 'Ommabop 3 oylik tarif', 65000, 90, '["1080p Full HD va 4K", "Reklamasiz", "Yangi premyeralar navbatsiz", "VIP chat"]'::jsonb, true, true, 2),
  ('VIP 1 Yil', 'vip-1-year', 'Eng tejamkor yillik VIP obuna', 220000, 365, '["Barcha imkoniyatlar to‘liq ochiq", "Eng yuqori bitreyt", "Oltin VIP nishon", "30% tejamkorlik"]'::jsonb, true, false, 3)
ON CONFLICT (slug) DO NOTHING;
