-- Migration 017: Distributed Atomic Rate Limiting for Vercel Serverless
-- Creates shared persistent rate limiting table and atomic RPC function

CREATE TABLE IF NOT EXISTS public.rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 1,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for automatic expiration lookups
CREATE INDEX IF NOT EXISTS idx_rate_limits_expires_at ON public.rate_limits(expires_at);

-- Enable RLS
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Service role and internal procedures have full access; admins can view
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rate_limits' AND policyname = 'Admins can view rate limits'
  ) THEN
    CREATE POLICY "Admins can view rate limits" ON public.rate_limits FOR SELECT USING (is_admin());
  END IF;
END $$;

-- Atomic sliding-window rate limit checker
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key TEXT,
  p_max_attempts INTEGER,
  p_window_seconds INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_count INTEGER;
  v_expires_at TIMESTAMPTZ;
  v_now TIMESTAMPTZ := now();
  v_window INTERVAL := (p_window_seconds || ' seconds')::interval;
  v_allowed BOOLEAN;
  v_remaining INTEGER;
  v_reset_seconds INTEGER;
BEGIN
  -- Atomic upsert: insert fresh record or increment active counter
  INSERT INTO public.rate_limits (key, count, expires_at, created_at, updated_at)
  VALUES (p_key, 1, v_now + v_window, v_now, v_now)
  ON CONFLICT (key) DO UPDATE
  SET
    count = CASE
      WHEN public.rate_limits.expires_at < v_now THEN 1
      ELSE public.rate_limits.count + 1
    END,
    expires_at = CASE
      WHEN public.rate_limits.expires_at < v_now THEN v_now + v_window
      ELSE public.rate_limits.expires_at
    END,
    updated_at = v_now
  RETURNING public.rate_limits.count, public.rate_limits.expires_at
  INTO v_count, v_expires_at;

  v_allowed := (v_count <= p_max_attempts);
  v_remaining := GREATEST(0, p_max_attempts - v_count);
  v_reset_seconds := GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_expires_at - v_now)))::integer);

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'remaining', v_remaining,
    'reset_seconds', v_reset_seconds,
    'current_count', v_count
  );
END;
$$;

-- Grant execution to authenticated, anon and service role
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER) TO anon, authenticated, service_role;
