import test from 'node:test';
import assert from 'node:assert/strict';
import { getClientIp, rateLimit, checkDistributedRateLimit, globalLimiter } from '../lib/rate-limit.js';

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

test('4. checkDistributedRateLimit handles Supabase RPC and fail-safe fallback', async () => {
  // A. Successful distributed RPC execution
  let rpcCalledWith = null;
  const mockSupabaseSuccess = {
    rpc: async (fn, params) => {
      rpcCalledWith = { fn, params };
      return {
        data: { allowed: true, remaining: 4, reset_seconds: 59, current_count: 1 },
        error: null,
      };
    },
  };

  const resDistributed = await checkDistributedRateLimit(
    'auth:test',
    { 'x-real-ip': '203.0.113.5' },
    5,
    60,
    mockSupabaseSuccess
  );

  assert.equal(resDistributed.allowed, true);
  assert.equal(resDistributed.remaining, 4);
  assert.equal(resDistributed.distributed, true);
  assert.equal(rpcCalledWith.fn, 'check_rate_limit');
  assert.equal(rpcCalledWith.params.p_key, 'auth:test:203.0.113.5');

  // B. Database RPC error -> gracefully falls back to local in-memory
  const mockSupabaseError = {
    rpc: async () => ({
      data: null,
      error: { message: 'Database connection failed' },
    }),
  };

  const resFallback = await checkDistributedRateLimit(
    'auth:fallback',
    { 'x-real-ip': '203.0.113.6' },
    5,
    60,
    mockSupabaseError
  );

  assert.equal(resFallback.allowed, true);
  assert.equal(resFallback.distributed, false); // Fell back to memory safely
});
