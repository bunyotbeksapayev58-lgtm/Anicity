/**
 * In-memory sliding window rate limiter for AniCity.
 * Provides abuse prevention and brute force defense for authentication,
 * search, and API endpoints without introducing hard external dependencies.
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
 * @param {Headers|object} headersList
 * @returns {string}
 */
export function getClientIp(headersList) {
  if (!headersList) return '127.0.0.1';
  const getHeader = typeof headersList.get === 'function'
    ? (k) => headersList.get(k)
    : (k) => headersList[k];

  const forwarded = getHeader('x-forwarded-for');
  if (forwarded) {
    const firstIp = String(forwarded).split(',')[0].trim();
    if (firstIp) return firstIp;
  }

  const realIp = getHeader('x-real-ip') || getHeader('cf-connecting-ip');
  if (realIp) return String(realIp).trim();

  return '127.0.0.1';
}

/**
 * Convenience helper to enforce rate limiting inside Server Actions or API routes.
 *
 * @param {string} prefix - Route category (e.g. 'auth:login', 'api:search')
 * @param {Headers|object} headersList - Request headers
 * @param {number} maxAttempts
 * @param {number} windowSeconds
 * @returns {{ allowed: boolean, error: string|null, remaining: number }}
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

export { globalLimiter };
