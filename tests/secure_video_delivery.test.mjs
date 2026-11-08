import test from 'node:test';
import assert from 'node:assert/strict';
import { generatePlaybackToken, verifyPlaybackToken, VIDEO_PROVIDERS } from '../lib/video/provider.js';
import {
  validatePlaybackAccess,
  buildDeliveryConfig,
  verifyDeliveryToken,
  calculatePlaybackTokenTtl,
} from '../lib/video/secure-delivery.js';

// ----------------------------------------------------
// 1. Server-Side VIP Authorization & Access Rules
// ----------------------------------------------------
test('1. validatePlaybackAccess: Unauthenticated user is rejected', () => {
  const result = validatePlaybackAccess({
    user: null,
    profile: null,
    episode: { id: 'ep-1', is_published: true },
  });
  assert.equal(result.allowed, false);
  assert.equal(result.code, 'UNAUTHORIZED');
});

test('2. validatePlaybackAccess: Suspended user is rejected', () => {
  const result = validatePlaybackAccess({
    user: { id: 'user-bad' },
    profile: { role: 'user', suspended_at: new Date().toISOString() },
    episode: { id: 'ep-1', is_published: true },
  });
  assert.equal(result.allowed, false);
  assert.equal(result.code, 'USER_SUSPENDED');
});

test('3. validatePlaybackAccess: Unpublished episode is rejected for regular users, allowed for Admin/Owner', () => {
  const regularResult = validatePlaybackAccess({
    user: { id: 'user-reg' },
    profile: { role: 'user' },
    episode: { id: 'ep-draft', is_published: false },
  });
  assert.equal(regularResult.allowed, false);
  assert.equal(regularResult.code, 'EPISODE_UNPUBLISHED');

  const adminResult = validatePlaybackAccess({
    user: { id: 'user-admin' },
    profile: { role: 'admin' },
    episode: { id: 'ep-draft', is_published: false },
  });
  assert.equal(adminResult.allowed, true);
  assert.equal(adminResult.isPrivileged, true);
});

test('4. validatePlaybackAccess: VIP-required episode rejects non-VIP users and expired subscriptions', () => {
  const vipEpisode = {
    id: 'ep-vip-1',
    is_published: true,
    requires_vip: true,
    quality: '1080p',
  };

  // Case A: Regular user with zero subscriptions
  const noSubResult = validatePlaybackAccess({
    user: { id: 'user-free' },
    profile: { role: 'user' },
    episode: vipEpisode,
    subscriptions: [],
  });
  assert.equal(noSubResult.allowed, false);
  assert.equal(noSubResult.code, 'VIP_REQUIRED');

  // Case B: Regular user with expired subscription
  const expiredSubResult = validatePlaybackAccess({
    user: { id: 'user-expired' },
    profile: { role: 'user' },
    episode: vipEpisode,
    subscriptions: [
      {
        id: 'sub-exp',
        status: 'active',
        starts_at: new Date(Date.now() - 60 * 86400000).toISOString(),
        expires_at: new Date(Date.now() - 5 * 86400000).toISOString(), // Expired 5 days ago
      },
    ],
  });
  assert.equal(expiredSubResult.allowed, false);
  assert.equal(expiredSubResult.code, 'VIP_REQUIRED');
});

test('5. validatePlaybackAccess: Active VIP subscription authorizes premium playback', () => {
  const vipEpisode = {
    id: 'ep-vip-1',
    is_published: true,
    requires_vip: true,
  };

  const activeSubResult = validatePlaybackAccess({
    user: { id: 'user-vip' },
    profile: { role: 'user' },
    episode: vipEpisode,
    subscriptions: [
      {
        id: 'sub-active',
        status: 'active',
        starts_at: new Date(Date.now() - 5 * 86400000).toISOString(),
        expires_at: new Date(Date.now() + 25 * 86400000).toISOString(), // Active for 25 more days
      },
    ],
  });
  assert.equal(activeSubResult.allowed, true);
  assert.equal(activeSubResult.isVip, true);
});

test('6. validatePlaybackAccess: Admin bypasses VIP requirement even without active subscription', () => {
  const vipEpisode = {
    id: 'ep-vip-1',
    is_published: true,
    requires_vip: true,
  };

  const adminResult = validatePlaybackAccess({
    user: { id: 'user-owner' },
    profile: { role: 'owner' },
    episode: vipEpisode,
    subscriptions: [],
  });
  assert.equal(adminResult.allowed, true);
  assert.equal(adminResult.isPrivileged, true);
});

// ----------------------------------------------------
// 2. Token Security: Binding, Expiration & Anti-Tamper
// ----------------------------------------------------
test('7. verifyDeliveryToken: Valid token matching user and episode succeeds', () => {
  const secretKey = 'test-signing-key-42';
  const token = generatePlaybackToken(
    { userId: 'user-100', episodeId: 'ep-200', ttlSeconds: 3600 },
    secretKey
  );

  const result = verifyDeliveryToken({
    token,
    expectedUserId: 'user-100',
    expectedEpisodeId: 'ep-200',
    secretKey,
  });

  assert.equal(result.valid, true);
  assert.equal(result.payload.userId, 'user-100');
  assert.equal(result.payload.episodeId, 'ep-200');
});

test('8. verifyDeliveryToken: Expired token is rejected', () => {
  const secretKey = 'test-signing-key-42';
  const token = generatePlaybackToken(
    { userId: 'user-100', episodeId: 'ep-200', ttlSeconds: -10 }, // Expired
    secretKey
  );

  const result = verifyDeliveryToken({
    token,
    expectedUserId: 'user-100',
    expectedEpisodeId: 'ep-200',
    secretKey,
  });

  assert.equal(result.valid, false);
  assert.equal(result.reason, 'Token expired');
});

test('9. verifyDeliveryToken: Anti-Cross-User Sharing (Wrong user is rejected)', () => {
  const secretKey = 'test-signing-key-42';
  const token = generatePlaybackToken(
    { userId: 'user-alice', episodeId: 'ep-200', ttlSeconds: 3600 },
    secretKey
  );

  // Bob attempts to use Alice's token
  const result = verifyDeliveryToken({
    token,
    expectedUserId: 'user-bob',
    expectedEpisodeId: 'ep-200',
    secretKey,
  });

  assert.equal(result.valid, false);
  assert.match(result.reason, /User mismatch/);
});

test('10. verifyDeliveryToken: Anti-Episode Substitution (Wrong episode is rejected)', () => {
  const secretKey = 'test-signing-key-42';
  const token = generatePlaybackToken(
    { userId: 'user-alice', episodeId: 'ep-free-1', ttlSeconds: 3600 },
    secretKey
  );

  // Attempting to use Free Episode 1 token on Premium Episode 2
  const result = verifyDeliveryToken({
    token,
    expectedUserId: 'user-alice',
    expectedEpisodeId: 'ep-premium-2',
    secretKey,
  });

  assert.equal(result.valid, false);
  assert.match(result.reason, /Episode mismatch/);
});

// ----------------------------------------------------
// 3. Provider Abstraction & Real Limitations
// ----------------------------------------------------
test('11. buildDeliveryConfig: Accurately reports Google Drive and Direct MP4 delivery limitations', () => {
  const dummyToken = 'header.signature';

  // Google Drive
  const driveEp = {
    id: 'ep-drive',
    video_url: 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/view',
  };
  const driveConfig = buildDeliveryConfig(driveEp, dummyToken);
  assert.equal(driveConfig.provider, VIDEO_PROVIDERS.DRIVE);
  assert.equal(driveConfig.isTokenEnforcedAtEdge, false);
  assert.ok(driveConfig.limitations.length >= 3);

  // Direct MP4
  const mp4Ep = {
    id: 'ep-mp4',
    video_url: 'https://cdn.example.com/anime/ep1.mp4',
  };
  const mp4Config = buildDeliveryConfig(mp4Ep, dummyToken);
  assert.equal(mp4Config.provider, VIDEO_PROVIDERS.DIRECT);
  assert.equal(mp4Config.proxyRequiredForEdgeSecurity, true);
  assert.equal(mp4Config.isTokenEnforcedAtEdge, false);

  // HLS
  const hlsEp = {
    id: 'ep-hls',
    video_url: 'https://cdn.example.com/hls/master.m3u8',
  };
  const hlsConfig = buildDeliveryConfig(hlsEp, dummyToken);
  assert.equal(hlsConfig.provider, VIDEO_PROVIDERS.HLS);
  assert.ok(hlsConfig.manifestUrl.includes('token=' + dummyToken));
});

// ----------------------------------------------------
// 4. Token TTL Clamping & Subscription Expiry Binding
// ----------------------------------------------------
test('12. calculatePlaybackTokenTtl: Token expiry strictly cannot exceed subscription expiry', () => {
  const nowSec = 1700000000;
  // User subscription expires in 1,800 seconds (30 minutes)
  const subExpiresAt = new Date((nowSec + 1800) * 1000).toISOString();

  // User requests standard 7,200s (2 hours) token
  const clampedTtl = calculatePlaybackTokenTtl({
    requestedTtl: 7200,
    subscriptionExpiresAt: subExpiresAt,
    isPrivileged: false,
    isVipRequired: true,
    nowSec,
  });

  // Clamped TTL must exactly equal 1,800s, NOT 7,200s!
  assert.equal(clampedTtl, 1800);
});

test('13. calculatePlaybackTokenTtl: Expired subscription returns 0 TTL and cannot obtain token', () => {
  const nowSec = 1700000000;
  // Subscription expired 10 seconds ago
  const subExpiresAt = new Date((nowSec - 10) * 1000).toISOString();

  const clampedTtl = calculatePlaybackTokenTtl({
    requestedTtl: 7200,
    subscriptionExpiresAt: subExpiresAt,
    isPrivileged: false,
    isVipRequired: true,
    nowSec,
  });

  // Must return 0 to block token generation
  assert.equal(clampedTtl, 0);
});

test('14. verifyDeliveryToken: Revoked subscriptions are revalidated during playback', async () => {
  const secretKey = 'test-signing-key-42';
  const token = generatePlaybackToken(
    { userId: 'user-vip-revoked', episodeId: 'ep-vip-10', ttlSeconds: 3600 },
    secretKey
  );

  // Simulated live DB revalidation hook returning false (subscription was revoked mid-stream)
  const revalidateSubMock = async (userId) => {
    return false; // Revoked!
  };

  const result = await verifyDeliveryToken({
    token,
    expectedUserId: 'user-vip-revoked',
    expectedEpisodeId: 'ep-vip-10',
    secretKey,
    revalidateSubscriptionFn: revalidateSubMock,
  });

  assert.equal(result.valid, false);
  assert.match(result.reason, /Subscription revoked/);
});

test('15. HLS Delivery Strategy: Manifest authorization is distinguished from chunk segment protection', () => {
  const dummyToken = 'header.signature';
  const hlsEp = {
    id: 'ep-hls-auth',
    video_url: 'https://cdn.example.com/hls/master.m3u8',
  };

  const hlsConfig = buildDeliveryConfig(hlsEp, dummyToken);

  // Manifest carries token
  assert.ok(hlsConfig.manifestUrl.includes('token=' + dummyToken));
  // Explicitly identifies segment auth strategy vs manifest auth
  assert.equal(hlsConfig.segmentAuthStrategy, 'signed_cookie_or_edge_rewrite');
  assert.ok(hlsConfig.limitations.some((lim) => lim.includes('Media segments (.ts/.m4s)')));
});

test('16. Watch Page Source Inspection: Server-Side VIP Playback Access Verification is wired', async () => {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const watchPageCode = await fs.readFile(path.resolve('app/watch/[animeId]/[num]/page.js'), 'utf8');

  // Verify validatePlaybackAccess is imported and executed
  assert.ok(watchPageCode.includes("import { validatePlaybackAccess } from '@/lib/video/secure-delivery'"));
  assert.ok(watchPageCode.includes('validatePlaybackAccess('));
  assert.ok(watchPageCode.includes("redirect(`/premium?vip_required=true&next="));
  assert.ok(watchPageCode.includes('requires_vip'));
  assert.ok(watchPageCode.includes('is_vip_only'));
});
