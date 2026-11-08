import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// ----------------------------------------------------
// TASK 1: Permission Guards & Server Action Inspection
// ----------------------------------------------------
test('TASK 1.1: Root cause of permission check failure (file path verification)', () => {
  const adminActionsPath = path.resolve('app/actions/admin.js');
  const nonExistentPath = path.resolve('app/actions/anime.js');

  assert.equal(fs.existsSync(adminActionsPath), true, 'app/actions/admin.js must exist');
  assert.equal(fs.existsSync(nonExistentPath), false, 'app/actions/anime.js does NOT exist (root cause of previous ENOENT)');
});

test('TASK 1.2: All exported admin actions must invoke assertAdmin', () => {
  const content = fs.readFileSync(path.resolve('app/actions/admin.js'), 'utf8');
  const lines = content.split('\n');

  const exportedFns = [];
  let currentFn = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('export async function')) {
      if (currentFn) exportedFns.push(currentFn);
      currentFn = { name: line.match(/export async function (\w+)/)[1], code: [line] };
    } else if (currentFn) {
      currentFn.code.push(line);
    }
  }
  if (currentFn) exportedFns.push(currentFn);

  assert.equal(exportedFns.length, 23, 'Must have exactly 23 exported functions in admin.js');

  for (const fn of exportedFns) {
    const body = fn.code.join('\n');
    assert.ok(
      body.includes('assertAdmin('),
      `Function ${fn.name} must call assertAdmin to enforce server-side authorization`
    );
  }
});

test('TASK 1.3: Sensitive billing and role management functions require Admin/Owner (no assistant permission arg)', () => {
  const content = fs.readFileSync(path.resolve('app/actions/admin.js'), 'utf8');
  const sensitiveFns = [
    'toggleUserVip',
    'toggleUserSuspension',
    'createSubscriptionPlan',
    'updateSubscriptionPlan',
    'togglePlanActive',
    'deleteSubscriptionPlan',
    'grantUserSubscription',
    'extendUserSubscription',
    'revokeUserSubscription',
  ];

  for (const fnName of sensitiveFns) {
    const regex = new RegExp(`export async function ${fnName}[\\s\\S]*?assertAdmin\\(supabase\\)`, 'm');
    assert.match(
      content,
      regex,
      `${fnName} must call assertAdmin(supabase) with NO permission argument, restricting execution exclusively to Admin/Owner`
    );
  }
});

test('TASK 1.4: User profile mutations strictly enforce user identity and cannot modify roles', () => {
  const profileAction = fs.readFileSync(path.resolve('app/actions/profile.js'), 'utf8');

  // Enforces session user ID
  assert.match(profileAction, /const\s*\{\s*data:\s*\{\s*user\s*\}\s*\}\s*=\s*await\s*supabase\.auth\.getUser\(\)/);
  assert.match(profileAction, /\.update\(\s*\{[\s\S]*?display_name[\s\S]*?avatar_url[\s\S]*?\}\s*\)\.eq\('id',\s*user\.id\)/);

  // Does NOT update role or is_vip
  assert.equal(profileAction.includes('role:'), false, 'Profile action must never allow updating user role');
  assert.equal(profileAction.includes('is_vip:'), false, 'Profile action must never allow updating VIP status');
});

// ----------------------------------------------------
// TASK 2: Hardened Migration 017 Verification
// ----------------------------------------------------
test('TASK 2.1: Migration 017 strictly validates input parameters and key length', () => {
  const sql = fs.readFileSync(path.resolve('supabase/migrations/017_distributed_rate_limiting.sql'), 'utf8');

  // Table key length constraint
  assert.match(sql, /CONSTRAINT rate_limits_key_len CHECK \(length\(key\) <= 128\)/);

  // Key validation
  assert.match(sql, /IF p_key IS NULL OR length\(trim\(p_key\)\) = 0 OR length\(p_key\) > 128 THEN/);

  // Max attempts validation
  assert.match(sql, /IF p_max_attempts IS NULL OR p_max_attempts < 1 OR p_max_attempts > 10000 THEN/);

  // Window seconds validation
  assert.match(sql, /IF p_window_seconds IS NULL OR p_window_seconds < 1 OR p_window_seconds > 86400 THEN/);

  // Opportunistic cleanup
  assert.match(sql, /DELETE FROM public\.rate_limits WHERE expires_at < \(v_now - INTERVAL '1 hour'\)/);
});

test('TASK 2.2: Migration 017 revokes execute from anon/authenticated and grants ONLY to service_role', () => {
  const sql = fs.readFileSync(path.resolve('supabase/migrations/017_distributed_rate_limiting.sql'), 'utf8');

  assert.match(sql, /REVOKE ALL ON FUNCTION public\.check_rate_limit\(TEXT, INTEGER, INTEGER\) FROM PUBLIC, anon, authenticated;/i);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.check_rate_limit\(TEXT, INTEGER, INTEGER\) TO service_role;/i);
});

// ----------------------------------------------------
// TASK 3: Rate Limiter Failure & Multi-Instance Behavior
// ----------------------------------------------------
test('TASK 3.1: In-memory rate limiting isolation across separate simulated instances', async () => {
  const { rateLimit, checkDistributedRateLimit } = await import('../lib/rate-limit.js');

  const headers = { 'x-forwarded-for': '198.51.100.44' };

  // Simulated Database Client: shared across all instances
  let dbCounter = 0;
  const mockSharedDb = {
    rpc: async (fnName, params) => {
      dbCounter++;
      const allowed = dbCounter <= params.p_max_attempts;
      return {
        data: {
          allowed,
          remaining: Math.max(0, params.p_max_attempts - dbCounter),
          reset_seconds: params.p_window_seconds,
          current_count: dbCounter,
        },
        error: null,
      };
    },
  };

  // Instance 1 & Instance 2 with shared DB
  const res1 = await checkDistributedRateLimit('test:mult', headers, 2, 60, mockSharedDb);
  assert.equal(res1.allowed, true);
  assert.equal(res1.distributed, true);

  const res2 = await checkDistributedRateLimit('test:mult', headers, 2, 60, mockSharedDb);
  assert.equal(res2.allowed, true);
  assert.equal(res2.distributed, true);

  // Third request across instances correctly blocked by shared DB
  const res3 = await checkDistributedRateLimit('test:mult', headers, 2, 60, mockSharedDb);
  assert.equal(res3.allowed, false);
  assert.equal(res3.distributed, true);
});

test('TASK 3.2: Graceful fallback to local sliding window when DB is unavailable', async () => {
  const { checkDistributedRateLimit } = await import('../lib/rate-limit.js');

  const headers = { 'x-forwarded-for': '203.0.113.88' };

  // Simulated Failing DB
  const failingDb = {
    rpc: async () => {
      throw new Error('Database connection timeout (504 Gateway Timeout)');
    },
  };

  const res = await checkDistributedRateLimit('test:failover', headers, 5, 60, failingDb);
  assert.equal(res.allowed, true, 'Failover must keep application available');
  assert.equal(res.distributed, false, 'Must flag that result was computed locally, not distributed');
});

// ----------------------------------------------------
// TASK 4: Payment Security (Click & Payme)
// ----------------------------------------------------
test('TASK 4.1: Click MD5 signature, Prepare, and Complete idempotency', async () => {
  const { verifyClickSignature, handleClickPrepare, handleClickComplete } = await import('../lib/payments/click.js');

  const secret = 'prod-click-secret-key-100';
  const prep = {
    click_trans_id: '9901',
    service_id: '8801',
    merchant_trans_id: 'user-uuid-1',
    amount: 25000,
    action: 0,
    sign_time: '2026-11-08 10:00:00',
  };
  const rawSign = `${prep.click_trans_id}${prep.service_id}${secret}${prep.merchant_trans_id}${prep.amount}${prep.action}${prep.sign_time}`;
  prep.sign_string = crypto.createHash('md5').update(rawSign).digest('hex');

  // Signature check
  assert.equal(verifyClickSignature(prep, secret), true);
  assert.equal(verifyClickSignature({ ...prep, sign_string: 'invalid' }, secret), false);

  // Mock DB tracking
  const transactions = [];
  const subscriptions = [];
  const auditLogs = [];

  const mockAdmin = {
    from: (table) => ({
      select: () => ({
        eq: (col, val) => ({
          maybeSingle: async () => {
            if (table === 'profiles') return { data: { id: val, username: 'testuser' }, error: null };
            if (table === 'subscription_transactions') {
              const tx = transactions.find((t) => t.transaction_id === val);
              return { data: tx || null, error: null };
            }
            return { data: null, error: null };
          },
          eq: () => ({
            order: () => ({
              limit: async () => ({ data: subscriptions.filter((s) => s.user_id === val), error: null }),
            }),
          }),
        }),
      }),
      insert: async (row) => {
        if (table === 'subscription_transactions') transactions.push({ ...row, id: 'tx-1' });
        if (table === 'user_subscriptions') subscriptions.push({ ...row, id: 'sub-1' });
        if (table === 'subscription_audit_logs') auditLogs.push(row);
        return { data: row, error: null };
      },
      update: (updates) => ({
        eq: (col, val) => {
          const tx = transactions.find((t) => t.transaction_id === val || t.id === val);
          if (tx) Object.assign(tx, updates);
          return { error: null };
        },
      }),
    }),
  };

  // 1. Prepare
  const prepRes = await handleClickPrepare(prep, mockAdmin);
  assert.equal(prepRes.error, 0);

  // 2. Complete
  const comp = {
    ...prep,
    action: 1,
    merchant_prepare_id: prepRes.merchant_prepare_id,
    error: 0,
  };
  const compRes = await handleClickComplete(comp, mockAdmin);
  assert.equal(compRes.error, 0);
  assert.equal(subscriptions.length, 1);
  assert.equal(subscriptions[0].status, 'active');

  // 3. Idempotent re-send of Complete: MUST NOT grant duplicate subscription
  const dupRes = await handleClickComplete(comp, mockAdmin);
  assert.equal(dupRes.error, 0);
  assert.equal(subscriptions.length, 1, 'Duplicate webhook must NOT insert second subscription');
});

test('TASK 4.2: Payme Basic Auth, JSON-RPC 2.0 lifecycle, and duplicate protection', async () => {
  const { verifyPaymeAuth, handlePaymeRpc } = await import('../lib/payments/payme.js');

  const secret = 'payme-secret-99';
  const authHeader = `Basic ${Buffer.from(`Paycom:${secret}`).toString('base64')}`;

  assert.equal(verifyPaymeAuth(authHeader, secret), true);
  assert.equal(verifyPaymeAuth('Basic invalid', secret), false);

  const transactions = [];
  const subscriptions = [];

  const mockAdmin = {
    from: (table) => ({
      select: () => ({
        eq: (col, val) => ({
          maybeSingle: async () => {
            if (table === 'profiles') return { data: { id: val }, error: null };
            if (table === 'subscription_transactions') {
              const tx = transactions.find((t) => t.transaction_id === val);
              return { data: tx || null, error: null };
            }
            return { data: null, error: null };
          },
          eq: () => ({
            order: () => ({
              limit: async () => ({ data: [], error: null }),
            }),
          }),
        }),
      }),
      insert: (row) => ({
        select: () => ({
          single: async () => {
            const created = { ...row, id: 'payme-tx-internal-1' };
            transactions.push(created);
            return { data: created, error: null };
          },
        }),
      }),
      update: (updates) => ({
        eq: (col, val) => {
          const tx = transactions.find((t) => t.transaction_id === val || t.id === val);
          if (tx) Object.assign(tx, updates);
          return { error: null };
        },
      }),
    }),
  };

  // Step 1: CheckPerformTransaction
  const checkRes = await handlePaymeRpc({
    id: 1,
    method: 'CheckPerformTransaction',
    params: { amount: 2500000, account: { user_id: 'user-payme-1' } },
  }, mockAdmin);
  assert.equal(checkRes.result?.allow, true);

  // Step 2: CreateTransaction
  const createRes = await handlePaymeRpc({
    id: 2,
    method: 'CreateTransaction',
    params: { id: 'ptx-100', time: Date.now(), amount: 2500000, account: { user_id: 'user-payme-1' } },
  }, mockAdmin);
  assert.equal(createRes.result?.state, 1);

  // Step 3: PerformTransaction
  const performRes = await handlePaymeRpc({
    id: 3,
    method: 'PerformTransaction',
    params: { id: 'ptx-100' },
  }, mockAdmin);
  assert.equal(performRes.result?.state, 2);

  // Step 4: Duplicate PerformTransaction returns state 2 idempotently
  const dupPerformRes = await handlePaymeRpc({
    id: 4,
    method: 'PerformTransaction',
    params: { id: 'ptx-100' },
  }, mockAdmin);
  assert.equal(dupPerformRes.result?.state, 2);
});

// ----------------------------------------------------
// TASK 5: Video Security & Playback Token Validation
// ----------------------------------------------------
test('TASK 5.1: Cryptographic Playback Token generation, expiration, and resource binding', async () => {
  const { generatePlaybackToken, verifyPlaybackToken } = await import('../lib/video/provider.js');

  const secret = 'super-secret-video-key';
  const payload = { userId: 'user-abc', episodeId: 'ep-xyz', ttlSeconds: 3600 };

  // 1. Valid Token
  const token = generatePlaybackToken(payload, secret);
  const verifyValid = verifyPlaybackToken(token, secret);
  assert.equal(verifyValid.valid, true);
  assert.equal(verifyValid.payload.userId, 'user-abc');
  assert.equal(verifyValid.payload.episodeId, 'ep-xyz');

  // 2. Expired Token
  const expiredToken = generatePlaybackToken({ ...payload, ttlSeconds: -10 }, secret);
  const verifyExpired = verifyPlaybackToken(expiredToken, secret);
  assert.equal(verifyExpired.valid, false);
  assert.equal(verifyExpired.reason, 'Token expired');

  // 3. Tampered Token
  const tampered = token.slice(0, -6) + 'XXXXXX';
  const verifyTampered = verifyPlaybackToken(tampered, secret);
  assert.equal(verifyTampered.valid, false);
  assert.equal(verifyTampered.reason, 'Signature mismatch');

  // 4. Wrong Secret
  const verifyWrongKey = verifyPlaybackToken(token, 'attacker-secret');
  assert.equal(verifyWrongKey.valid, false);
  assert.equal(verifyWrongKey.reason, 'Signature mismatch');
});
