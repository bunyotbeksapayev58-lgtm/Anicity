import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectProvider,
  getPlaybackSource,
  generatePlaybackToken,
  verifyPlaybackToken,
  VIDEO_PROVIDERS,
} from '../lib/video/provider.js';

test('1. detectProvider classifies video providers accurately', () => {
  // Google Drive
  const drive1 = detectProvider('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view?usp=sharing');
  assert.equal(drive1.provider, VIDEO_PROVIDERS.DRIVE);
  assert.equal(drive1.isEmbed, true);
  assert.equal(drive1.isAdaptive, false);

  const drive2 = detectProvider('drive:1AbCdEfGhIjKlMnOp');
  assert.equal(drive2.provider, VIDEO_PROVIDERS.DRIVE);

  // HLS stream
  const hls = detectProvider('https://cdn.anicity.uz/hls/attack-on-titan/ep1/master.m3u8');
  assert.equal(hls.provider, VIDEO_PROVIDERS.HLS);
  assert.equal(hls.isAdaptive, true);
  assert.equal(hls.isEmbed, false);

  // Direct MP4 / WebM
  const mp4 = detectProvider('https://storage.anicity.uz/media/demon_slayer_ep1.mp4');
  assert.equal(mp4.provider, VIDEO_PROVIDERS.DIRECT);
  assert.equal(mp4.isEmbed, false);

  const webm = detectProvider('https://storage.anicity.uz/media/naruto.webm');
  assert.equal(webm.provider, VIDEO_PROVIDERS.DIRECT);

  // Cloudflare Stream
  const cf = detectProvider('https://iframe.videodelivery.net/5d5ba308508d2e77c6143a7c48421c48');
  assert.equal(cf.provider, VIDEO_PROVIDERS.CLOUDFLARE);
  assert.equal(cf.isEmbed, true);

  // Mux
  const mux = detectProvider('https://stream.mux.com/DS00Spx1CV902MCtP7Gs02Q22x3O00S.m3u8');
  // .m3u8 check runs before Mux domain check or both are valid streaming adaptive
  assert.ok(mux.isAdaptive);
});

test('2. getPlaybackSource normalizes URLs and resolves MIME types', () => {
  // Drive URL normalizes to /preview
  const driveSource = getPlaybackSource('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view');
  assert.equal(driveSource.url, 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/preview');
  assert.equal(driveSource.isDrive, true);

  // HLS MIME
  const hlsSource = getPlaybackSource('https://cdn.anicity.uz/stream.m3u8');
  assert.equal(hlsSource.mimeType, 'application/x-mpegURL');
  assert.equal(hlsSource.isHls, true);

  // WebM MIME
  const webmSource = getPlaybackSource('https://cdn.anicity.uz/clip.webm');
  assert.equal(webmSource.mimeType, 'video/webm');
  assert.equal(webmSource.isDirect, true);
});

test('3. Playback token generation and cryptographic HMAC verification', () => {
  const mockSigningKey = 'mock-video-key';
  const payload = {
    userId: 'user-uuid-1234',
    episodeId: 'episode-uuid-5678',
    ttlSeconds: 300,
  };

  const token = generatePlaybackToken(payload, mockSigningKey);
  assert.ok(typeof token === 'string' && token.includes('.'), 'Token must be b64.signature format');

  // Successful verification
  const verification = verifyPlaybackToken(token, mockSigningKey);
  assert.equal(verification.valid, true);
  assert.equal(verification.payload.userId, 'user-uuid-1234');
  assert.equal(verification.payload.episodeId, 'episode-uuid-5678');
  assert.ok(verification.payload.expiresAt > Math.floor(Date.now() / 1000));

  // Signature tampering
  const tamperedToken = token.slice(0, -4) + 'abcd';
  const tamperedResult = verifyPlaybackToken(tamperedToken, mockSigningKey);
  assert.equal(tamperedResult.valid, false);
  assert.equal(tamperedResult.reason, 'Signature mismatch');

  // Wrong secret key
  const wrongKeyResult = verifyPlaybackToken(token, 'different-wrong-secret');
  assert.equal(wrongKeyResult.valid, false);
  assert.equal(wrongKeyResult.reason, 'Signature mismatch');

  // Expired token test
  const expiredToken = generatePlaybackToken({ ...payload, ttlSeconds: -10 }, mockSigningKey);
  const expiredResult = verifyPlaybackToken(expiredToken, mockSigningKey);
  assert.equal(expiredResult.valid, false);
  assert.equal(expiredResult.reason, 'Token expired');
});
