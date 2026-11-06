import test from 'node:test';
import assert from 'node:assert/strict';
import { getClientIp, rateLimit, globalLimiter } from '../lib/rate-limit.js';

test('1. getClientIp correctly resolves client IP address from various header formats', () => {
  // Direct x-forwarded-for single IP
  const headers1 = new Headers({ 'x-forwarded-for': '203.0.113.195' });
  assert.equal(getClientIp(headers1), '203.0.113.195');

  // Multi-proxy forwarded list (first IP is the real client)
  const headers2 = new Headers({ 'x-forwarded-for': '198.51.100.10, 10.0.0.1, 192.168.1.1' });
  assert.equal(getClientIp(headers2), '198.51.100.10');

  // Cloudflare Connecting IP
  const headers3 = new Headers({ 'cf-connecting-ip': '192.0.2.45' });
  assert.equal(getClientIp(headers3), '192.0.2.45');

  // Plain object support
  assert.equal(getClientIp({ 'x-real-ip': '198.51.100.77' }), '198.51.100.77');

  // Null/undefined fallback
  assert.equal(getClientIp(null), '127.0.0.1');
  assert.equal(getClientIp(undefined), '127.0.0.1');
});

test('2. RateLimiter enforces sliding window request quotas', () => {
  const testIp = '10.99.88.77';
  const prefix = 'test:slider';
  const key = `${prefix}:${testIp}`;
  globalLimiter.reset(key);

  const mockHeaders = { 'x-real-ip': testIp };

  // First 3 requests should be allowed (max 3)
  for (let i = 1; i <= 3; i++) {
    const res = rateLimit(prefix, mockHeaders, 3, 60);
    assert.equal(res.allowed, true, `Attempt ${i} should be allowed`);
    assert.equal(res.remaining, 3 - i);
    assert.equal(res.error, null);
  }

  // 4th request should be blocked
  const blocked = rateLimit(prefix, mockHeaders, 3, 60);
  assert.equal(blocked.allowed, false, '4th attempt must be blocked');
  assert.equal(blocked.remaining, 0);
  assert.match(blocked.error, /Juda ko‘p so‘rov yuborildi/);
  assert.ok(blocked.resetSeconds > 0 && blocked.resetSeconds <= 60);

  // Resetting key clears the lock
  globalLimiter.reset(key);
  const afterReset = rateLimit(prefix, mockHeaders, 3, 60);
  assert.equal(afterReset.allowed, true, 'Request after reset must be allowed');
});

test('3. RateLimiter prune safely purges expired keys', () => {
  const oldKey = 'test:old:1.2.3.4';
  globalLimiter.storage.set(oldKey, {
    timestamps: [Date.now() - 700000], // 11+ minutes ago
  });

  const activeKey = 'test:active:1.2.3.4';
  globalLimiter.storage.set(activeKey, {
    timestamps: [Date.now() - 5000], // 5 seconds ago
  });

  globalLimiter.prune();

  assert.equal(globalLimiter.storage.has(oldKey), false, 'Stale key must be purged');
  assert.equal(globalLimiter.storage.has(activeKey), true, 'Active key must be preserved');
  globalLimiter.reset(activeKey);
});
