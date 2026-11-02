/**
 * Resolves the canonical site URL for authentication redirects and metadata.
 * In production, this will NEVER return localhost.
 *
 * Priority:
 * 1. Request headers (x-forwarded-host / host, x-forwarded-proto) if valid and not localhost in production.
 * 2. NEXT_PUBLIC_SITE_URL environment variable.
 * 3. VERCEL_PROJECT_PRODUCTION_URL or VERCEL_URL.
 * 4. Production fallback: https://anicity-app.vercel.app.
 * 5. Localhost fallback only in development / test when nothing else matches.
 *
 * @param {object|Headers|null} [headersList] - Request headers if available
 * @returns {string} - Clean origin URL without trailing slash
 */
export function getSiteUrl(headersList = null) {
  // 1. Try reading forwarded headers if passed
  try {
    if (headersList) {
      const getHeader = typeof headersList.get === 'function'
        ? (k) => headersList.get(k)
        : (k) => headersList[k];

      const rawHost = getHeader('x-forwarded-host') || getHeader('host');
      const host = Array.isArray(rawHost) ? rawHost[0] : (rawHost ? String(rawHost).split(',')[0].trim() : null);

      if (host) {
        const rawProto = getHeader('x-forwarded-proto');
        const proto = Array.isArray(rawProto)
          ? rawProto[0]
          : (rawProto ? String(rawProto).split(',')[0].trim() : (host.includes('localhost') ? 'http' : 'https'));

        const isLocal = host.includes('localhost') || host.startsWith('127.') || host.startsWith('0.0.0.0');
        if (process.env.NODE_ENV === 'production' && isLocal) {
          // Reject localhost host header spoof in production
        } else {
          return `${proto}://${host}`.replace(/\/$/, '');
        }
      }
    }
  } catch {
    // Ignore header reading errors
  }

  // 2. Explicit environment variable configured on Vercel / server
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit && !explicit.includes('localhost')) {
    return explicit.replace(/\/$/, '');
  }

  // 3. Vercel deployment variables
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`.replace(/\/$/, '');
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`.replace(/\/$/, '');
  }

  // 4. Production fallback - NEVER allow localhost in production
  if (process.env.NODE_ENV === 'production') {
    return 'https://anicity-app.vercel.app';
  }

  // 5. Development fallback
  return (explicit || 'http://localhost:3000').replace(/\/$/, '');
}
