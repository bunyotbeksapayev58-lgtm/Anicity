import test from 'node:test';
import assert from 'node:assert/strict';
import { generatePlaybackToken, verifyPlaybackToken, VIDEO_PROVIDERS } from '../lib/video/provider.js';
import {
  validatePlaybackAccess,
  buildDeliveryConfig,
  verifyDeliveryToken,
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
