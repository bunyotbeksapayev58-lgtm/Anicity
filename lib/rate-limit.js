/**
 * Rate Limiter for AniCity.
 * Supports both:
 * 1. Synchronous in-memory sliding window for instant zero-latency protection.
 * 2. Asynchronous distributed atomic rate limiting via Supabase PostgreSQL RPC (check_rate_limit)
 *    for multi-instance Vercel serverless environments, with automatic fail-safe fallback.
 */

class RateLimiter {
  constructor() {
    this.storage = new Map();
    // Periodically prune stale entries every 5 minutes to avoid memory leaks
    if (typeof setInterval !== 'undefined') {
      const timer = setInterval(() => this.prune(), 5 * 60 * 1000);
      if (timer.unref) timer.unref();
    }
  }

  /**
   * Checks whether an action by a given key exceeds the rate limit.
   *
   * @param {string} key - Identifier (e.g. `auth:${ip}`)
   * @param {number} maxAttempts - Maximum attempts allowed in window
   * @param {number} windowSeconds - Duration of window in seconds
   * @returns {{ success: boolean, remaining: number, resetSeconds: number }}
   */
  check(key, maxAttempts = 10, windowSeconds = 60) {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;

    let record = this.storage.get(key);

    if (!record || now - record.startTime > windowMs) {
      // Window expired or new key: start fresh window
      record = {
        count: 1,
        startTime: now,
        expiresAt: now + windowMs,
      };
      this.storage.set(key, record);
      return {
        success: true,
        remaining: Math.max(0, maxAttempts - 1),
        resetSeconds: windowSeconds,
      };
    }

    // Inside current window
    record.count += 1;
    const remaining = Math.max(0, maxAttempts - record.count);
    const resetSeconds = Math.max(1, Math.ceil((record.expiresAt - now) / 1000));

    if (record.count > maxAttempts) {
      return {
        success: false,
        remaining: 0,
        resetSeconds,
      };
    }

    return {
      success: true,
      remaining,
      resetSeconds,
    };
  }

  /**
   * Cleans up expired rate-limiting keys to preserve serverless memory.
   * Handles both modern expiresAt records and legacy timestamps arrays.
   */
  prune() {
    const now = Date.now();
    for (const [key, record] of this.storage.entries()) {
      if (Array.isArray(record?.timestamps)) {
        record.timestamps = record.timestamps.filter((t) => now - t < 600000);
        if (record.timestamps.length === 0) {
          this.storage.delete(key);
        }
      } else if (record?.expiresAt && now > record.expiresAt) {
        this.storage.delete(key);
      }
    }
  }

  /**
   * Clears a specific key or all entries (useful in testing).
   *
   * @param {string} [key]
   */
  reset(key) {
    if (key) {
      this.storage.delete(key);
    } else {
      this.storage.clear();
    }
  }
}

// Global singleton instance for in-memory caching
const globalLimiter = new RateLimiter();

/**
 * Extracts a normalized client IP address from standard proxy headers.
 * Handles x-forwarded-for, x-real-ip, cf-connecting-ip.
 *
 * @param {Headers|object} headersList
 * @returns {string} Client IP address
 */
export function getClientIp(headersList) {
  if (!headersList) return '127.0.0.1';

  const getH = (name) => {
    if (typeof headersList.get === 'function') return headersList.get(name);
    return headersList[name] || headersList[name.toLowerCase()] || null;
  };

  // Prioritize trusted edge proxy headers to prevent IP spoofing
  const vercelIp = getH('x-vercel-forwarded-for');
  if (vercelIp) {
    const parts = vercelIp.split(',').map((p) => p.trim());
    if (parts.length > 0 && parts[0]) return parts[0];
  }

  const cfIp = getH('cf-connecting-ip');
  if (cfIp) return cfIp.trim();

  const realIp = getH('x-real-ip');
  if (realIp) return realIp.trim();

  const xff = getH('x-forwarded-for');
  if (xff) {
    const parts = xff.split(',').map((p) => p.trim());
    if (parts.length > 0 && parts[0]) return parts[0];
  }

  return '127.0.0.1';
}

/**
 * Synchronous in-memory rate limiting helper.
 *
 * @param {string} prefix - Action category prefix (e.g. `auth:login`)
 * @param {Headers|object} headersList - Request headers
 * @param {number} maxAttempts - Max allowed in window
 * @param {number} windowSeconds - Window size in seconds
 * @returns {{ allowed: boolean, error: string|null, remaining: number, resetSeconds: number }}
 */
export function rateLimit(prefix, headersList, maxAttempts = 10, windowSeconds = 60) {
  const ip = getClientIp(headersList);
  const key = `${prefix}:${ip}`;
  const result = globalLimiter.check(key, maxAttempts, windowSeconds);

  if (!result.success) {
    return {
      allowed: false,
      error: `Juda ko‘p so‘rov yuborildi. Iltimos, ${result.resetSeconds} soniyadan keyin qaytadan urinib ko‘ring.`,
      remaining: 0,
      resetSeconds: result.resetSeconds,
    };
  }

  return {
    allowed: true,
    error: null,
    remaining: result.remaining,
    resetSeconds: result.resetSeconds,
  };
}

/**
 * Asynchronous distributed atomic rate limiting helper.
 * Uses Supabase check_rate_limit RPC when client is provided or resolves service-role client, with
 * fail-safe fallback to local in-memory sliding window.
 *
 * @param {string} prefix
 * @param {Headers|object} headersList
 * @param {number} maxAttempts
 * @param {number} windowSeconds
 * @param {object} supabaseClient
 * @returns {Promise<{ allowed: boolean, error: string|null, remaining: number, resetSeconds: number, distributed: boolean }>}
 */
export async function checkDistributedRateLimit(
  prefix,
  headersList,
  maxAttempts = 10,
  windowSeconds = 60,
  supabaseClient = null
) {
  const ip = getClientIp(headersList);
  const key = `${prefix}:${ip}`;

  let client = supabaseClient;
  if (!client) {
    try {
      const { createAdminClient } = await import('@/lib/supabase/admin');
      client = createAdminClient();
    } catch {
      // In standalone test or non-server environment
    }
  }

  if (client && typeof client.rpc === 'function') {
    try {
      const { data, error } = await client.rpc('check_rate_limit', {
        p_key: key,
        p_max_attempts: maxAttempts,
        p_window_seconds: windowSeconds,
      });

      if (!error && data && typeof data.allowed === 'boolean') {
        const allowed = Boolean(data.allowed);
        const resetSeconds = Number(data.reset_seconds) || windowSeconds;
        return {
          allowed,
          error: allowed
            ? null
            : `Juda ko‘p so‘rov yuborildi. Iltimos, ${resetSeconds} soniyadan keyin qaytadan urinib ko‘ring.`,
          remaining: Number(data.remaining) || 0,
          resetSeconds,
          distributed: true,
        };
      }
    } catch {
      // Fail-safe fallback to in-memory limiter below
    }
  }

  // Local fallback
  const localRes = rateLimit(prefix, headersList, maxAttempts, windowSeconds);
  return {
    ...localRes,
    distributed: false,
  };
}

export { globalLimiter };
