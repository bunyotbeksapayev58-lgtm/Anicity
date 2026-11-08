/**
 * Resolves the canonical site URL for authentication redirects and metadata.
 * In production, this will ALWAYS return the trusted canonical HTTPS production domain.
 *
 * Security: Does NOT trust arbitrary Host or x-forwarded-host headers to construct
 * authentication redirects, strictly preventing Host Header Injection / Poisoning attacks.
 *
 * @param {object|Headers|null} [_headersList] - Request headers (ignored in production for redirect safety)
 * @returns {string} - Clean canonical origin URL without trailing slash
 */
export function getSiteUrl(_headersList = null) {
  const isProduction = process.env.NODE_ENV === 'production';

  const parseOrigin = (value, allowHttp = false) => {
    if (!value || typeof value !== 'string') return null;
    try {
      const url = new URL(value.trim());
      if (!['https:', ...(allowHttp ? ['http:'] : [])].includes(url.protocol)) return null;
      if (url.username || url.password) return null;
      if (!allowHttp && (url.port || url.hostname === 'localhost' || url.hostname === '127.0.0.1')) return null;
      return url.origin;
    } catch {
      return null;
    }
  };

  // 1. Primary: NEXT_PUBLIC_SITE_URL environment variable
  const configured = parseOrigin(process.env.NEXT_PUBLIC_SITE_URL, !isProduction);
  if (configured) {
    if (isProduction && (configured.startsWith('http://localhost') || configured.startsWith('http://127.0.0.1'))) {
      // Reject accidental localhost in production environment
    } else {
      return configured;
    }
  }

  // 2. Server-side Vercel production deployment domain (trusted platform variable)
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    const vercelProd = parseOrigin(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`, false);
    if (vercelProd) return vercelProd;
  }

  // 3. Known production canonical fallback
  if (isProduction) {
    return 'https://anicity-app.vercel.app';
  }

  // 4. Local development fallback
  return 'http://localhost:3000';
}
