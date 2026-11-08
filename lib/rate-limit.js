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
    if (!record) {
      record = { timestamps: [] };
      this.storage.set(key, record);
    }

    // Filter timestamps within the current window
    record.timestamps = record.timestamps.filter((t) => now - t < windowMs);

    if (record.timestamps.length >= maxAttempts) {
      const oldestInWindow = record.timestamps[0];
      const resetSeconds = Math.ceil((oldestInWindow + windowMs - now) / 1000);
      return {
        success: false,
        remaining: 0,
        resetSeconds: Math.max(1, resetSeconds),
      };
    }

    record.timestamps.push(now);
    return {
      success: true,
      remaining: maxAttempts - record.timestamps.length,
      resetSeconds: windowSeconds,
    };
  }

  /**
   * Resets rate limit for a specific key (e.g. upon successful authentication).
   * @param {string} key
   */
  reset(key) {
    this.storage.delete(key);
  }

  /**
   * Prunes all entries where all timestamps are older than 10 minutes.
   */
  prune() {
    const now = Date.now();
    for (const [key, record] of this.storage.entries()) {
      record.timestamps = record.timestamps.filter((t) => now - t < 600000);
      if (record.timestamps.length === 0) {
        this.storage.delete(key);
      }
    }
  }
}

// Global singleton instance preserved across server action calls
const globalLimiter = globalThis.__anicityRateLimiter || new RateLimiter();
if (process.env.NODE_ENV !== 'production') {
  globalThis.__anicityRateLimiter = globalLimiter;
}

/**
 * Extracts client IP address safely from request headers.
 * Validates against trusted proxies and rejects spoofed headers.
 *
 * @param {Headers|object} headersList
 * @returns {string}
 */
export function getClientIp(headersList) {
  if (!headersList) return '127.0.0.1';
  const getHeader = typeof headersList.get === 'function'
    ? (k) => headersList.get(k)
    : (k) => headersList[k];

  // In production on Vercel, x-real-ip or cf-connecting-ip is set by the edge proxy
  const realIp = getHeader('x-real-ip') || getHeader('cf-connecting-ip');
  if (realIp && typeof realIp === 'string') {
    const cleanReal = realIp.trim();
    if (cleanReal) return cleanReal;
  }

  const forwarded = getHeader('x-forwarded-for');
  if (forwarded && typeof forwarded === 'string') {
    const firstIp = forwarded.split(',')[0].trim();
    if (firstIp) return firstIp;
  }

  return '127.0.0.1';
}

/**
 * Synchronous in-memory rate limiting helper.
 *
 * @param {string} prefix - Route category (e.g. 'auth:login', 'api:search')
 * @param {Headers|object} headersList - Request headers
 * @param {number} maxAttempts
 * @param {number} windowSeconds
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
 * Uses Supabase check_rate_limit RPC when client is provided, with
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

  if (supabaseClient && typeof supabaseClient.rpc === 'function') {
    try {
      const { data, error } = await supabaseClient.rpc('check_rate_limit', {
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
