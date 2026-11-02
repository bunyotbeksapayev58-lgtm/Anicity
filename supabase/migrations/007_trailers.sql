-- ============================================================================
-- 007_trailers.sql — Anicity Anime Trailers and Clips Schema & Policies
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.trailers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anime_id UUID REFERENCES public.animes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  duration_text TEXT,
  clip_type TEXT DEFAULT 'trailer' CHECK (clip_type IN ('trailer', 'clip', 'pv', 'teaser')),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trailers_anime_id ON public.trailers (anime_id);
CREATE INDEX IF NOT EXISTS idx_trailers_active_sort ON public.trailers (is_active, sort_order);

ALTER TABLE public.trailers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'trailers' AND policyname = 'trailers read'
  ) THEN
    CREATE POLICY "trailers read" ON public.trailers FOR SELECT TO anon, authenticated
      USING (is_active = true OR is_staff());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'trailers' AND policyname = 'trailers admin write'
  ) THEN
    CREATE POLICY "trailers admin write" ON public.trailers FOR ALL TO authenticated
      USING (is_admin()) WITH CHECK (is_admin());
  END IF;
END $$;

GRANT SELECT ON public.trailers TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.trailers TO authenticated;
