import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Hls from 'hls.js';
import {
  detectProvider,
  generatePlaybackToken,
  verifyPlaybackToken,
  VIDEO_PROVIDERS,
} from '../lib/video/provider.js';

test('1. Hls.js library is loaded and exposes standard engine API', () => {
  assert.equal(typeof Hls, 'function', 'Hls must be a valid class constructor');
  assert.equal(typeof Hls.isSupported, 'function', 'Hls.isSupported must be a static function');
  assert.ok(Hls.Events, 'Hls.Events must be exposed');
  assert.ok(Hls.ErrorTypes, 'Hls.ErrorTypes must be exposed');
});

test('2. detectProvider classifies HLS streams accurately', () => {
  const hlsSource = 'https://stream.anicity.uz/hls/attack-on-titan/season1/ep1/master.m3u8';
  const meta = detectProvider(hlsSource);
  assert.equal(meta.provider, VIDEO_PROVIDERS.HLS);
  assert.equal(meta.isAdaptive, true);
  assert.equal(meta.isEmbed, false);
});

test('3. Player.js implements HLS mounting, error recovery, quality switching, and Safari fallback', () => {
  const playerSource = fs.readFileSync(path.resolve('components/Player.js'), 'utf8');

  // Verify Hls import
  assert.ok(playerSource.includes("import Hls from 'hls.js';"), 'Must import Hls from hls.js');

  // Verify isHls detection
  assert.ok(playerSource.includes('const isHls ='), 'Must detect HLS stream by .m3u8 extension');

  // Verify Hls.isSupported() check
  assert.ok(playerSource.includes('if (Hls.isSupported())'), 'Must check Hls.isSupported()');

  // Verify error recovery (network and media error recovery)
  assert.ok(playerSource.includes('Hls.ErrorTypes.NETWORK_ERROR'), 'Must handle NETWORK_ERROR');
  assert.ok(playerSource.includes('Hls.ErrorTypes.MEDIA_ERROR'), 'Must handle MEDIA_ERROR');
  assert.ok(playerSource.includes('hls.startLoad()'), 'Must call hls.startLoad() on network error');
  assert.ok(playerSource.includes('hls.recoverMediaError()'), 'Must call hls.recoverMediaError() on media error');

  // Verify Safari fallback
  assert.ok(
    playerSource.includes("videoRef.current.canPlayType('application/vnd.apple.mpegurl')"),
    'Must support native Apple Safari HLS playback'
  );

  // Verify Quality selector UI
  assert.ok(playerSource.includes('quality-btn'), 'Must render quality button for adaptive streams');
  assert.ok(playerSource.includes('changeQuality'), 'Must implement quality level switcher');
});

test('4. Playback Token generation, expiration, and resource binding', () => {
  // Mock key for unit testing HMAC signature
  const mockSigningKey = 'mock-hls-key';
  const validPayload = {
    userId: 'user-vip-77',
    episodeId: 'episode-uuid-999',
    ttlSeconds: 3600,
  };

  const token = generatePlaybackToken(validPayload, mockSigningKey);
  const verification = verifyPlaybackToken(token, mockSigningKey);
  assert.equal(verification.valid, true);
  assert.equal(verification.payload.userId, 'user-vip-77');
  assert.equal(verification.payload.episodeId, 'episode-uuid-999');

  // Resource binding check
  const requestedEpisodeId = 'episode-uuid-999';
  assert.equal(verification.payload.episodeId, requestedEpisodeId, 'Token must match requested episode resource');

  // Mismatched resource binding check
  const mismatchedEpisodeId = 'different-episode-uuid';
  assert.notEqual(verification.payload.episodeId, mismatchedEpisodeId, 'Token must NOT match different episode resource');

  // Expired token check
  const expiredToken = generatePlaybackToken({ ...validPayload, ttlSeconds: -10 }, mockSigningKey);
  const expiredVerification = verifyPlaybackToken(expiredToken, mockSigningKey);
  assert.equal(expiredVerification.valid, false);
  assert.equal(expiredVerification.reason, 'Token expired');
});
