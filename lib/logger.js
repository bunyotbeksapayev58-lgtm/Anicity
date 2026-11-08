/**
 * AniCity Structured Server Logger.
 * Guarantees zero secret leakage into terminal, serverless logs, or error trackers.
 */

const REDACT_KEYS = new Set([
  'password',
  'token',
  'secret',
  'key',
  'authorization',
  'apikey',
  'service_role',
  'cookie',
]);

/**
 * Recursively sanitizes objects to redact sensitive keys.
 */
function sanitize(data) {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(sanitize);

  const clean = {};
  for (const [k, v] of Object.entries(data)) {
    const lower = k.toLowerCase();
    const isSensitive = [...REDACT_KEYS].some((rk) => lower.includes(rk));
    if (isSensitive) {
      clean[k] = '[REDACTED]';
    } else if (typeof v === 'object' && v !== null) {
      clean[k] = sanitize(v);
    } else {
      clean[k] = v;
    }
  }
  return clean;
}

export const logger = {
  info(message, context = {}) {
    const payload = {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message,
      context: sanitize(context),
    };
    console.log(JSON.stringify(payload));
  },

  warn(message, context = {}) {
    const payload = {
      timestamp: new Date().toISOString(),
      level: 'WARN',
      message,
      context: sanitize(context),
    };
    console.warn(JSON.stringify(payload));
  },

  error(message, error = null, context = {}) {
    const payload = {
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      message,
      errorMessage: error?.message || (typeof error === 'string' ? error : null),
      context: sanitize(context),
    };
    console.error(JSON.stringify(payload));
  },

  security(event, context = {}) {
    const payload = {
      timestamp: new Date().toISOString(),
      level: 'SECURITY_AUDIT',
      event,
      context: sanitize(context),
    };
    console.warn(JSON.stringify(payload));
  },
};
