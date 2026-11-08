import crypto from 'node:crypto';
import { isDriveUrl, extractDriveFileId, toPlayableUrl } from '../drive.js';

/**
 * Supported streaming providers in AniCity
 */
export const VIDEO_PROVIDERS = {
  DRIVE: 'drive',
  DIRECT: 'direct',
  HLS: 'hls',
  CLOUDFLARE: 'cloudflare',
  MUX: 'mux',
  UNKNOWN: 'unknown',
};

/**
 * Standard quality levels
 */
export const VIDEO_QUALITIES = ['auto', '1080p', '720p', '480p', '360p'];

/**
 * Detects the streaming provider based on raw URL / identifier.
 *
 * @param {string} rawUrl
 * @returns {{ provider: string, isEmbed: boolean, isAdaptive: boolean }}
 */
export function detectProvider(rawUrl) {
  const str = String(rawUrl || '').trim();
  if (!str) return { provider: VIDEO_PROVIDERS.UNKNOWN, isEmbed: false, isAdaptive: false };

  if (isDriveUrl(str)) {
    return { provider: VIDEO_PROVIDERS.DRIVE, isEmbed: true, isAdaptive: false };
  }

  if (/\.m3u8(\?|$)/i.test(str)) {
    return { provider: VIDEO_PROVIDERS.HLS, isEmbed: false, isAdaptive: true };
  }

  if (/cloudflarestream\.com|videodelivery\.net/i.test(str)) {
    return { provider: VIDEO_PROVIDERS.CLOUDFLARE, isEmbed: true, isAdaptive: true };
  }

  if (/mux\.com|stream\.mux\.com/i.test(str)) {
    return { provider: VIDEO_PROVIDERS.MUX, isEmbed: false, isAdaptive: true };
  }

  if (/\.(mp4|webm|ogg|mkv|mov)(\?|$)/i.test(str)) {
    return { provider: VIDEO_PROVIDERS.DIRECT, isEmbed: false, isAdaptive: false };
  }

  return { provider: VIDEO_PROVIDERS.UNKNOWN, isEmbed: false, isAdaptive: false };
}

/**
 * Resolves standard playable configuration for the player.
 *
 * @param {string} rawUrl
 * @param {object} options - { token, quality, defaultQuality }
 * @returns {{ provider: string, url: string, mimeType: string, isDirect: boolean, isDrive: boolean, isHls: boolean, isEmbed: boolean }}
 */
export function getPlaybackSource(rawUrl, options = {}) {
  const meta = detectProvider(rawUrl);
  let resolvedUrl = toPlayableUrl(rawUrl);

  let mimeType = 'video/mp4';
  if (meta.provider === VIDEO_PROVIDERS.HLS) {
    mimeType = 'application/x-mpegURL';
  } else if (/\.webm(\?|$)/i.test(resolvedUrl)) {
    mimeType = 'video/webm';
  } else if (/\.ogg(\?|$)/i.test(resolvedUrl)) {
    mimeType = 'video/ogg';
  }

  return {
    provider: meta.provider,
    url: resolvedUrl,
    mimeType,
    isDirect: meta.provider === VIDEO_PROVIDERS.DIRECT,
    isDrive: meta.provider === VIDEO_PROVIDERS.DRIVE,
    isHls: meta.provider === VIDEO_PROVIDERS.HLS,
    isEmbed: meta.isEmbed,
    isAdaptive: meta.isAdaptive,
  };
}

/**
 * Creates an HMAC signed playback token for secure media delivery.
 *
 * @param {{ userId: string, episodeId: string, ttlSeconds?: number }} payload
 * @param {string} secretKey
 * @returns {string}
 */

/**
 * Resolves video signing key safely, enforcing fail-closed security in production.
 */
function resolveVideoSigningKey(providedKey) {
  const key = providedKey || process.env.VIDEO_SIGNING_KEY;
  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CRITICAL: VIDEO_SIGNING_KEY is missing in production');
    }
    return 'anicity-dev-stream-signing-key';
  }
  if (process.env.NODE_ENV === 'production' && (key === 'anicity-stream-secret-fallback' || key === 'anicity-dev-stream-signing-key')) {
    throw new Error('CRITICAL: Insecure default VIDEO_SIGNING_KEY is forbidden in production');
  }
  return key;
}

export function generatePlaybackToken(payload, secretKey) {
  const activeKey = resolveVideoSigningKey(secretKey);
  const { userId, episodeId, ttlSeconds = 7200 } = payload;
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const nonce = crypto.randomBytes(8).toString('hex');

  const data = JSON.stringify({ userId, episodeId, expiresAt, nonce });
  const b64Data = Buffer.from(data).toString('base64url');
  const signature = crypto
    .createHmac('sha256', activeKey)
    .update(b64Data)
    .digest('base64url');

  return `${b64Data}.${signature}`;
}

/**
 * Validates an HMAC signed playback token.
 *
 * @param {string} token
 * @param {string} secretKey
 * @returns {{ valid: boolean, payload: object|null, reason?: string }}
 */
export function verifyPlaybackToken(token, secretKey) {
  let activeKey;
  try {
    activeKey = resolveVideoSigningKey(secretKey);
  } catch (err) {
    return { valid: false, payload: null, reason: err.message };
  }
  if (!token || typeof token !== 'string') {
    return { valid: false, payload: null, reason: 'Missing token' };
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return { valid: false, payload: null, reason: 'Invalid token format' };
  }

  const [b64Data, signature] = parts;
  const expectedSig = crypto
    .createHmac('sha256', activeKey)
    .update(b64Data)
    .digest('base64url');

  // Constant-time comparison to prevent timing attacks
  const bufA = Buffer.from(signature);
  const bufB = Buffer.from(expectedSig);
  if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
    return { valid: false, payload: null, reason: 'Signature mismatch' };
  }

  try {
    const jsonStr = Buffer.from(b64Data, 'base64url').toString('utf8');
    const payload = JSON.parse(jsonStr);

    const now = Math.floor(Date.now() / 1000);
    if (payload.expiresAt && payload.expiresAt < now) {
      return { valid: false, payload, reason: 'Token expired' };
    }

    return { valid: true, payload };
  } catch {
    return { valid: false, payload: null, reason: 'Malformed payload' };
  }
}
