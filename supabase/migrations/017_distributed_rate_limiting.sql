-- Migration 017: Distributed Atomic Rate Limiting for Vercel Serverless (Hardened)
-- Creates shared persistent rate limiting table and atomic RPC function restricted to service_role

CREATE TABLE IF NOT EXISTS public.rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 1,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT rate_limits_key_len CHECK (length(key) <= 128)
);

-- Index for automatic expiration lookups
CREATE INDEX IF NOT EXISTS idx_rate_limits_expires_at ON public.rate_limits(expires_at);

-- Enable RLS
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- RLS: Only authenticated administrators can view rate limit metrics; no direct client mutations
DROP POLICY IF EXISTS "Admins can view rate limits" ON public.rate_limits;
CREATE POLICY "Admins can view rate limits" ON public.rate_limits FOR SELECT TO authenticated USING (is_admin());

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
  v_window INTERVAL;
  v_allowed BOOLEAN;
  v_remaining INTEGER;
  v_reset_seconds INTEGER;
BEGIN
  -- Strict Parameter Validation to prevent abuse & arbitrary record generation
  IF p_key IS NULL OR length(trim(p_key)) = 0 OR length(p_key) > 128 THEN
    RAISE EXCEPTION 'Invalid rate limit key: must be between 1 and 128 characters' USING errcode = '22023';
  END IF;

  IF p_max_attempts IS NULL OR p_max_attempts < 1 OR p_max_attempts > 10000 THEN
    RAISE EXCEPTION 'Invalid max attempts: must be between 1 and 10000' USING errcode = '22023';
  END IF;

  IF p_window_seconds IS NULL OR p_window_seconds < 1 OR p_window_seconds > 86400 THEN
    RAISE EXCEPTION 'Invalid window seconds: must be between 1 and 86400' USING errcode = '22023';
  END IF;

  v_window := (p_window_seconds || ' seconds')::interval;

  -- Opportunistic garbage collection: 5% chance per invocation to purge stale records older than 1 hour
  IF (random() < 0.05) THEN
    DELETE FROM public.rate_limits WHERE expires_at < (v_now - INTERVAL '1 hour');
  END IF;

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

-- Revoke execute from public/anon/authenticated; GRANT SOLELY to service_role
REVOKE ALL ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;
