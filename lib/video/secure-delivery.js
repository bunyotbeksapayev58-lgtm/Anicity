import { generatePlaybackToken, verifyPlaybackToken, detectProvider, getPlaybackSource, VIDEO_PROVIDERS } from './provider.js';
import { getCurrentSubscription } from '../subscriptions.js';
import { isAdminRole } from '../roles.js';

/**
 * Validates whether a user is authorized to stream a specific episode.
 * Enforces server-side authorization:
 * - Rejects unauthenticated callers
 * - Rejects suspended users
 * - Verifies episode is published (unless caller is admin/owner)
 * - Evaluates VIP requirement and validates active subscription
 * - Never trusts frontend VIP claims
 *
 * @param {object} params
 * @param {object} params.user - Authenticated user object from supabase.auth.getUser()
 * @param {object} params.profile - User profile { role, suspended_at }
 * @param {object} params.episode - Episode record { id, anime_id, is_published, quality, requires_vip, animes }
 * @param {Array} [params.subscriptions] - Array of user subscription records
 * @returns {{ allowed: boolean, reason?: string, code?: string, isVip: boolean, isPrivileged: boolean }}
 */
export function validatePlaybackAccess({ user, profile, episode, subscriptions = [] }) {
  if (!user || !user.id) {
    return { allowed: false, reason: 'Kirish talab etiladi (Unauthorized)', code: 'UNAUTHORIZED', isVip: false, isPrivileged: false };
  }

  if (profile?.suspended_at) {
    return { allowed: false, reason: 'Hisobingiz vaqtincha muzlatilgan (Suspended)', code: 'USER_SUSPENDED', isVip: false, isPrivileged: false };
  }

  const role = profile?.role || 'user';
  const isPrivileged = isAdminRole(role);

  if (!episode || !episode.id) {
    return { allowed: false, reason: 'Qism topilmadi', code: 'EPISODE_NOT_FOUND', isVip: false, isPrivileged };
  }

  // Unpublished episodes can only be viewed by administrators
  if (episode.is_published === false && !isPrivileged) {
    return { allowed: false, reason: 'Ushbu qism hali e’lon qilinmagan', code: 'EPISODE_UNPUBLISHED', isVip: false, isPrivileged };
  }

  // Check VIP requirement
  const episodeRequiresVip = Boolean(
    episode.requires_vip === true ||
    episode.quality === '4K' ||
    episode.animes?.is_vip_only === true
  );

  const activeSub = getCurrentSubscription(subscriptions);
  const isVip = Boolean(activeSub);
  const subscriptionExpiresAt = activeSub?.expires_at || null;

  if (episodeRequiresVip && !isVip && !isPrivileged) {
    return {
      allowed: false,
      reason: 'Ushbu qismni tomosha qilish uchun faol VIP obuna talab etiladi',
      code: 'VIP_REQUIRED',
      isVip: false,
      isPrivileged: false,
      subscriptionExpiresAt: null,
    };
  }

  return {
    allowed: true,
    isVip,
    isPrivileged,
    role,
    subscriptionExpiresAt,
  };
}

/**
 * Calculates the maximum safe TTL for a playback token so that it
 * strictly cannot outlive the user's active subscription.
 *
 * @param {object} params
 * @param {number} [params.requestedTtl=7200] - Requested TTL in seconds (default 2 hours)
 * @param {string|Date|null} [params.subscriptionExpiresAt] - ISO timestamp or Date of sub expiry
 * @param {boolean} [params.isPrivileged=false] - If admin/owner, no subscription cap needed
 * @param {boolean} [params.isVipRequired=false] - Whether content requires VIP
 * @param {number} [params.nowSec] - Current time in seconds (for deterministic testing)
 * @returns {number} Safe clamped TTL in seconds (0 if expired)
 */
export function calculatePlaybackTokenTtl({
  requestedTtl = 7200,
  subscriptionExpiresAt = null,
  isPrivileged = false,
  isVipRequired = false,
  nowSec = Math.floor(Date.now() / 1000),
}) {
  if (isPrivileged || !isVipRequired || !subscriptionExpiresAt) {
    return requestedTtl;
  }

  const subExpiresSec = Math.floor(new Date(subscriptionExpiresAt).getTime() / 1000);
  const remainingSec = subExpiresSec - nowSec;

  if (remainingSec <= 0) {
    return 0; // Expired subscription cannot obtain a new token
  }

  // Token expiry CANNOT exceed subscription expiry
  return Math.min(requestedTtl, remainingSec);
}

/**
 * Builds the secure delivery configuration and metadata for a given stream.
 *
 * @param {object} episode - Episode record
 * @param {string} token - Signed HMAC token
 * @param {object} [options] - Additional provider options
 * @returns {object} Provider delivery specification
 */
export function buildDeliveryConfig(episode, token, options = {}) {
  const source = getPlaybackSource(episode.video_url);

  switch (source.provider) {
    case VIDEO_PROVIDERS.DRIVE:
      return {
        provider: VIDEO_PROVIDERS.DRIVE,
        deliveryType: 'iframe_sandbox',
        embedUrl: source.url,
        token,
        isTokenEnforcedAtEdge: false,
        limitations: [
          'Google Drive serves bytes directly to the client browser.',
          'Google Drive does not validate AniCity HMAC tokens.',
          'Protection relies on AniCity page authentication, no-referrer headers, and popout-guard overlay.',
          'Anyone with the direct Google Drive file ID can access public files independently of AniCity.',
        ],
      };

    case VIDEO_PROVIDERS.DIRECT:
      return {
        provider: VIDEO_PROVIDERS.DIRECT,
        deliveryType: 'html5_video',
        streamUrl: source.url,
        mimeType: source.mimeType,
        token,
        isTokenEnforcedAtEdge: false,
        proxyRequiredForEdgeSecurity: true,
        limitations: [
          'Direct MP4/WebM URLs do not authenticate playback tokens at the byte layer.',
          'To enforce byte-level token security, an edge streaming proxy or signed CDN is required.',
        ],
      };

    case VIDEO_PROVIDERS.HLS:
      return {
        provider: VIDEO_PROVIDERS.HLS,
        deliveryType: 'adaptive_hls',
        manifestUrl: source.url.includes('?') ? `${source.url}&token=${token}` : `${source.url}?token=${token}`,
        mimeType: 'application/x-mpegURL',
        token,
        isTokenEnforcedAtEdge: options.isEdgeEnforced || false,
        segmentAuthStrategy: 'signed_cookie_or_edge_rewrite',
        limitations: [
          'Query-param tokens authorize the manifest fetch.',
          'Media segments (.ts/.m4s) require CDN signed cookies or manifest rewrite to enforce per-chunk authorization.',
        ],
      };

    case VIDEO_PROVIDERS.CLOUDFLARE:
      return {
        provider: VIDEO_PROVIDERS.CLOUDFLARE,
        deliveryType: 'cloudflare_stream',
        streamUrl: source.url,
        token,
        isTokenEnforcedAtEdge: true,
        limitations: [
          'Requires Cloudflare Stream account and signing key configuration.',
        ],
      };

    default:
      return {
        provider: VIDEO_PROVIDERS.UNKNOWN,
        deliveryType: 'unknown',
        url: source.url,
        token,
        isTokenEnforcedAtEdge: false,
        limitations: ['Unknown video source provider.'],
      };
  }
}

/**
 * Verifies that a playback token is cryptographically valid, not expired,
 * strictly bound to the requested user and episode, and optionally revalidates
 * that the user's VIP subscription has not been revoked during playback.
 *
 * @param {object} params
 * @param {string} params.token - The token to verify
 * @param {string} [params.expectedUserId] - Target user ID
 * @param {string} [params.expectedEpisodeId] - Target episode ID
 * @param {string} [params.secretKey]
 * @param {Function} [params.revalidateSubscriptionFn] - Optional async hook (userId) => boolean to recheck live DB status
 * @returns {Promise<{ valid: boolean, payload: object|null, reason?: string }>|{ valid: boolean, payload: object|null, reason?: string }}
 */
export function verifyDeliveryToken({
  token,
  expectedUserId,
  expectedEpisodeId,
  secretKey,
  revalidateSubscriptionFn = null,
}) {
  const result = verifyPlaybackToken(token, secretKey);
  if (!result.valid) {
    return result;
  }

  const { payload } = result;

  // Anti-Cross-User Sharing: Token must belong to the requesting user
  if (expectedUserId && payload.userId !== expectedUserId) {
    return { valid: false, payload, reason: 'Token boshqa foydalanuvchiga tegishli (User mismatch)' };
  }

  // Anti-Episode Substitution: Token must be bound to the exact requested episode
  if (expectedEpisodeId && payload.episodeId !== expectedEpisodeId) {
    return { valid: false, payload, reason: 'Token boshqa video qismiga tegishli (Episode mismatch)' };
  }

  // If a live DB revalidation function is provided, verify subscription has not been revoked mid-stream
  if (revalidateSubscriptionFn && typeof revalidateSubscriptionFn === 'function') {
    return Promise.resolve(revalidateSubscriptionFn(payload.userId)).then((isActive) => {
      if (!isActive) {
        return { valid: false, payload, reason: 'VIP obuna bekor qilingan yoki muddati tugagan (Subscription revoked)' };
      }
      return { valid: true, payload };
    });
  }

  return { valid: true, payload };
}
