/**
 * Resolves the canonical site URL for authentication redirects and metadata.
 * In production, this will NEVER return localhost.
 *
 * Dynamically resolves deployment origins (including *.vercel.app) while
 * maintaining strict validation against malicious protocols and formats.
 *
 * @param {object|Headers|null} [headersList] - Request headers if available
 * @returns {string} - Clean origin URL without trailing slash
 */
export function getSiteUrl(headersList = null) {
  const isProduction = process.env.NODE_ENV === 'production';
  const canonicalCandidates = [
    process.env.NEXT_PUBLIC_SITE_URL?.trim(),
    process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    'https://anicity-app.vercel.app',
  ].filter(Boolean);

  const parseOrigin = (value, allowHttp = false) => {
    try {
      const url = new URL(value);
      if (!['https:', ...(allowHttp ? ['http:'] : [])].includes(url.protocol) || url.username || url.password) return null;
      if (!allowHttp && (url.port || url.hostname === 'localhost' || url.hostname === '127.0.0.1')) return null;
      return url.origin;
    } catch {
      return null;
    }
  };

  // Request headers provide the dynamic origin
  try {
    if (headersList) {
      const getHeader = typeof headersList.get === 'function'
        ? (k) => headersList.get(k)
        : (k) => headersList[k];

      const rawHost = getHeader('x-forwarded-host') || getHeader('host');
      const host = Array.isArray(rawHost) ? rawHost[0] : (rawHost ? String(rawHost).split(',')[0].trim() : null);

      if (host && !/[\s/@\\]/.test(host)) {
        const rawProto = getHeader('x-forwarded-proto');
        const proto = Array.isArray(rawProto)
          ? rawProto[0]
          : (rawProto ? String(rawProto).split(',')[0].trim() : (host.includes('localhost') ? 'http' : 'https'));
        const requestOrigin = parseOrigin(`${proto}://${host}`, !isProduction);
        if (requestOrigin) {
          if (!isProduction) {
            return requestOrigin;
          }
          const hostName = new URL(requestOrigin).hostname;
          const isVercelDomain = /\.vercel\.app$/i.test(hostName);
          const isConfigured = canonicalCandidates.some((candidate) => parseOrigin(candidate)?.toLowerCase() === requestOrigin.toLowerCase());
          if (isVercelDomain || isConfigured) {
            return requestOrigin;
          }
        }
      }
    }
  } catch {
    // Ignore header reading errors
  }

  if (!isProduction) {
    const explicitOrigin = parseOrigin(process.env.NEXT_PUBLIC_SITE_URL?.trim(), true);
    if (explicitOrigin) return explicitOrigin;
  }

  // Server-side environment values are trusted deployment configuration.
  for (const candidate of canonicalCandidates) {
    const origin = parseOrigin(candidate, !isProduction);
    if (origin && (isProduction || !origin.includes('localhost'))) return origin;
  }

  // Fallback
  return isProduction ? 'https://anicity-app.vercel.app' : 'http://localhost:3000';
}
