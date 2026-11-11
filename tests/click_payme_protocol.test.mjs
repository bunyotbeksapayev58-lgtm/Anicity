import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  verifyClickSignature,
  handleClickPrepare,
  handleClickComplete,
  CLICK_ERROR,
} from '../lib/payments/click.js';
import {
  verifyPaymeAuth,
  handlePaymeRpc,
  PAYME_ERROR,
  PAYME_STATE,
} from '../lib/payments/payme.js';

test('1. Click MD5 Signature Generation and Verification', () => {
  const secretKey = 'click-secret-key-prod-99';

  // Action 0 (Prepare)
  const prepBody = {
    click_trans_id: '887766',
    service_id: '54321',
    merchant_trans_id: 'user-uuid-1',
    amount: '35000',
    action: 0,
    sign_time: '2026-11-08 12:00:00',
  };
  const rawPrepSign = `${prepBody.click_trans_id}${prepBody.service_id}${secretKey}${prepBody.merchant_trans_id}${prepBody.amount}${prepBody.action}${prepBody.sign_time}`;
  const validPrepSign = crypto.createHash('md5').update(rawPrepSign).digest('hex');

  assert.equal(verifyClickSignature({ ...prepBody, sign_string: validPrepSign }, secretKey), true);
  assert.equal(verifyClickSignature({ ...prepBody, sign_string: 'tampered_sign' }, secretKey), false);

  // Action 1 (Complete)
  const compBody = {
    click_trans_id: '887766',
    service_id: '54321',
    merchant_trans_id: 'user-uuid-1',
    merchant_prepare_id: 'prep-887766-1234',
    amount: '35000',
    action: 1,
    sign_time: '2026-11-08 12:00:05',
  };
  const rawCompSign = `${compBody.click_trans_id}${compBody.service_id}${secretKey}${compBody.merchant_trans_id}${compBody.merchant_prepare_id}${compBody.amount}${compBody.action}${compBody.sign_time}`;
  const validCompSign = crypto.createHash('md5').update(rawCompSign).digest('hex');

  assert.equal(verifyClickSignature({ ...compBody, sign_string: validCompSign }, secretKey), true);
  assert.equal(verifyClickSignature({ ...compBody, sign_string: 'tampered_sign' }, secretKey), false);
});

test('2. Click Prepare and Complete Lifecycle with Database Mock', async () => {
  const memoryDb = {
    users: [{ id: 'user-100', username: 'naruto' }],
    transactions: [],
    subscriptions: [],
    auditLogs: [],
  };

  const mockAdmin = {
    from: (table) => {
      let currentQuery = { table, filters: {} };
      const chain = {
        select: () => chain,
        insert: async (data) => {
          if (table === 'subscription_transactions') memoryDb.transactions.push({ id: 'tx-1', ...data });
          if (table === 'user_subscriptions') memoryDb.subscriptions.push({ id: 'sub-1', ...data });
          if (table === 'subscription_audit_logs') memoryDb.auditLogs.push({ id: 'log-1', ...data });
          return { data, error: null };
        },
        update: (data) => ({
          eq: async (k, v) => {
            const found = memoryDb.transactions.find(t => t[k] === v);
            if (found) Object.assign(found, data);
            return { data: found, error: null };
          },
        }),
        eq: (k, v) => {
          currentQuery.filters[k] = v;
          return chain;
        },
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => {
          if (table === 'profiles') {
            const u = memoryDb.users.find(x => x.id === currentQuery.filters.id);
            return { data: u || null, error: null };
          }
          if (table === 'subscription_transactions') {
            const t = memoryDb.transactions.find(x => x.transaction_id === currentQuery.filters.transaction_id);
            return { data: t || null, error: null };
          }
          return { data: null, error: null };
        },
      };
      return chain;
    },
  };

  // Step 1: Prepare
  const prepRes = await handleClickPrepare({
    click_trans_id: 'clk-001',
    merchant_trans_id: 'user-100',
    amount: '35000',
  }, mockAdmin);

  assert.equal(prepRes.error, CLICK_ERROR.SUCCESS);
  assert.ok(prepRes.merchant_prepare_id.startsWith('prep-clk-001'));

  // Step 2: Complete
  const compRes = await handleClickComplete({
    click_trans_id: 'clk-001',
    merchant_trans_id: 'user-100',
    merchant_prepare_id: prepRes.merchant_prepare_id,
    error: 0,
  }, mockAdmin);

  assert.equal(compRes.error, CLICK_ERROR.SUCCESS);
  assert.equal(memoryDb.transactions[0].status, 'completed');
  assert.equal(memoryDb.subscriptions.length, 1);
  assert.equal(memoryDb.auditLogs.length, 1);

  // Idempotency: Duplicate complete returns already completed without duplicate grant
  const dupCompRes = await handleClickComplete({
    click_trans_id: 'clk-001',
    merchant_trans_id: 'user-100',
    merchant_prepare_id: prepRes.merchant_prepare_id,
    error: 0,
  }, mockAdmin);

  assert.equal(dupCompRes.error, CLICK_ERROR.SUCCESS);
  assert.equal(memoryDb.subscriptions.length, 1); // No double subscription
});

test('3. Payme Basic Auth Verification', () => {
  const secretKey = 'payme-super-secret-123';
  const validHeader = `Basic ${Buffer.from(`Paycom:${secretKey}`).toString('base64')}`;
  const invalidHeader = `Basic ${Buffer.from('Paycom:wrong-secret').toString('base64')}`;

  assert.equal(verifyPaymeAuth(validHeader, secretKey), true);
  assert.equal(verifyPaymeAuth(invalidHeader, secretKey), false);
  assert.equal(verifyPaymeAuth('Bearer token', secretKey), false);
});

test('4. Payme JSON-RPC 2.0 Full State Machine Lifecycle', async () => {
  const memoryDb = {
    users: [{ id: 'user-payme-1', username: 'lelouch' }],
    transactions: [],
    subscriptions: [],
    auditLogs: [],
  };

  const mockAdmin = {
    from: (table) => {
      let currentQuery = { table, filters: {} };
      const chain = {
        select: () => chain,
        insert: (data) => ({
          select: () => ({
            single: async () => {
              const row = { id: `uuid-${Date.now()}`, ...data };
              memoryDb.transactions.push(row);
              return { data: row, error: null };
            },
          }),
        }),
        update: (data) => ({
          eq: async (k, v) => {
            const found = memoryDb.transactions.find(t => t[k] === v);
            if (found) Object.assign(found, data);
            return { data: found, error: null };
          },
        }),
        eq: (k, v) => {
          currentQuery.filters[k] = v;
          return chain;
        },
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => {
          if (table === 'profiles') {
            const u = memoryDb.users.find(x => x.id === currentQuery.filters.id);
            return { data: u || null, error: null };
          }
          if (table === 'subscription_transactions') {
            const t = memoryDb.transactions.find(x => x.transaction_id === currentQuery.filters.transaction_id);
            return { data: t || null, error: null };
          }
          return { data: null, error: null };
        },
      };
      return chain;
    },
  };

  // A. CheckPerformTransaction (Success)
  const checkRes = await handlePaymeRpc({
    id: 1,
    method: 'CheckPerformTransaction',
    params: {
      amount: 3500000, // 35,000 UZS in tiyin
      account: { user_id: 'user-payme-1' },
    },
  }, mockAdmin);
  assert.equal(checkRes.result.allow, true);

  // B. CheckPerformTransaction (User Not Found Error -31050)
  const checkNotFound = await handlePaymeRpc({
    id: 2,
    method: 'CheckPerformTransaction',
    params: {
      amount: 3500000,
      account: { user_id: 'nonexistent-user' },
    },
  }, mockAdmin);
  assert.equal(checkNotFound.error.code, PAYME_ERROR.USER_NOT_FOUND);

  // C. CreateTransaction
  const createRes = await handlePaymeRpc({
    id: 3,
    method: 'CreateTransaction',
    params: {
      id: 'payme-tx-999',
      time: 1731000000000,
      amount: 3500000,
      account: { user_id: 'user-payme-1' },
    },
  }, mockAdmin);
  assert.equal(createRes.result.state, PAYME_STATE.CREATED);

  // D. PerformTransaction
  const performRes = await handlePaymeRpc({
    id: 4,
    method: 'PerformTransaction',
    params: {
      id: 'payme-tx-999',
    },
  }, mockAdmin);
  assert.equal(performRes.result.state, PAYME_STATE.COMPLETED);

  // E. CheckTransaction
  const checkTxRes = await handlePaymeRpc({
    id: 5,
    method: 'CheckTransaction',
    params: {
      id: 'payme-tx-999',
    },
  }, mockAdmin);
  assert.equal(checkTxRes.result.state, PAYME_STATE.COMPLETED);
});


test('5. Payme Plan Validation & Rejection of Non-existent Plans', async () => {
  const memoryDb = {
    users: [{ id: 'user-payme-5', username: 'kirito' }],
    plans: [
      { id: 'plan-valid-1', name: 'VIP 1 Oy', price_uzs: 25000, duration_days: 30, is_active: true },
      { id: 'plan-inactive', name: 'Eski Tarif', price_uzs: 15000, duration_days: 30, is_active: false },
    ],
    transactions: [],
    subscriptions: [],
  };

  const mockAdmin = {
    from: (table) => {
      let currentQuery = { table, filters: {} };
      const chain = {
        select: () => chain,
        insert: (data) => {
          const row = { id: `uuid-${Date.now()}`, ...data };
          if (table === 'subscription_transactions') memoryDb.transactions.push(row);
          if (table === 'user_subscriptions') memoryDb.subscriptions.push(row);
          return {
            select: () => ({
              single: async () => ({ data: row, error: null }),
              maybeSingle: async () => ({ data: row, error: null }),
            }),
            data: [row],
            error: null,
          };
        },
        update: (data) => ({
          eq: (k, v) => {
            const list = table === 'user_subscriptions' ? memoryDb.subscriptions : memoryDb.transactions;
            const matches = list.filter(item => item[k] === v);
            matches.forEach(item => Object.assign(item, data));
            return {
              eq: (k2, v2) => {
                const subMatches = matches.filter(item => item[k2] === v2);
                subMatches.forEach(item => Object.assign(item, data));
                return {
                  select: () => ({ data: subMatches, error: null }),
                  data: subMatches,
                  error: null,
                };
              },
              select: () => ({ data: matches, error: null }),
              data: matches,
              error: null,
            };
          },
        }),
        eq: (k, v) => {
          currentQuery.filters[k] = v;
          return chain;
        },
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => {
          if (table === 'profiles') {
            const u = memoryDb.users.find(x => x.id === currentQuery.filters.id);
            return { data: u || null, error: null };
          }
          if (table === 'subscription_plans') {
            const p = memoryDb.plans.find(x => x.id === currentQuery.filters.id);
            return { data: p || null, error: null };
          }
          if (table === 'subscription_transactions') {
            const t = memoryDb.transactions.find(x => x.transaction_id === currentQuery.filters.transaction_id);
            return { data: t || null, error: null };
          }
          return { data: null, error: null };
        },
      };
      return chain;
    },
  };

  // Case A: CheckPerformTransaction with non-existent plan_id
  const checkInvalidPlan = await handlePaymeRpc({
    id: 10,
    method: 'CheckPerformTransaction',
    params: {
      amount: 2500000,
      account: { user_id: 'user-payme-5', plan_id: 'non-existent-plan' },
    },
  }, mockAdmin);
  assert.equal(checkInvalidPlan.error.code, PAYME_ERROR.INVALID_AMOUNT);

  // Case B: CheckPerformTransaction with inactive plan_id
  const checkInactivePlan = await handlePaymeRpc({
    id: 11,
    method: 'CheckPerformTransaction',
    params: {
      amount: 1500000,
      account: { user_id: 'user-payme-5', plan_id: 'plan-inactive' },
    },
  }, mockAdmin);
  assert.equal(checkInactivePlan.error.code, PAYME_ERROR.INVALID_AMOUNT);

  // Case C: CreateTransaction with non-existent plan_id
  const createInvalidPlan = await handlePaymeRpc({
    id: 12,
    method: 'CreateTransaction',
    params: {
      id: 'payme-fake-plan-tx',
      time: Date.now(),
      amount: 2500000,
      account: { user_id: 'user-payme-5', plan_id: 'non-existent-plan' },
    },
  }, mockAdmin);
  assert.equal(createInvalidPlan.error.code, PAYME_ERROR.INVALID_AMOUNT);

  // Case D: PerformTransaction with an invalid plan_id in tx fails with CANNOT_PERFORM_OPERATION
  memoryDb.transactions.push({
    id: 'tx-with-deleted-plan',
    transaction_id: 'payme-tx-deleted-plan',
    user_id: 'user-payme-5',
    plan_id: 'deleted-plan-uuid',
    amount_uzs: 25000,
    status: 'pending',
    metadata: { payme_state: PAYME_STATE.CREATED },
  });

  const performDeletedPlan = await handlePaymeRpc({
    id: 13,
    method: 'PerformTransaction',
    params: { id: 'payme-tx-deleted-plan' },
  }, mockAdmin);
  assert.equal(performDeletedPlan.error.code, PAYME_ERROR.CANNOT_PERFORM_OPERATION);
});

test('6. Click & Payme Cancellation Targets Only Associated Subscription (No Overbroad Wipe)', async () => {
  const memoryDb = {
    users: [{ id: 'user-multi-sub', username: 'asuna' }],
    transactions: [
      {
        id: 'tx-legit',
        transaction_id: 'clk-legit-01',
        user_id: 'user-multi-sub',
        status: 'completed',
        metadata: { subscription_id: 'sub-existing-year' },
      },
      {
        id: 'tx-cancel-clk',
        transaction_id: 'clk-cancel-02',
        user_id: 'user-multi-sub',
        status: 'completed',
        metadata: { subscription_id: 'sub-to-cancel-clk' },
      },
      {
        id: 'tx-cancel-payme',
        transaction_id: 'payme-cancel-03',
        user_id: 'user-multi-sub',
        status: 'completed',
        metadata: { payme_state: PAYME_STATE.COMPLETED, subscription_id: 'sub-to-cancel-payme' },
      },
    ],
    subscriptions: [
      {
        id: 'sub-existing-year',
        user_id: 'user-multi-sub',
        plan_name: 'VIP 1 Yil',
        status: 'active',
        notes: 'Pre-existing annual subscription',
      },
      {
        id: 'sub-to-cancel-clk',
        user_id: 'user-multi-sub',
        plan_name: 'VIP 1 Oy',
        status: 'active',
        notes: 'Click to‘lovi muvaffaqiyatli: TxID clk-cancel-02',
      },
      {
        id: 'sub-to-cancel-payme',
        user_id: 'user-multi-sub',
        plan_name: 'VIP 3 Oy',
        status: 'active',
        notes: 'Payme to‘lovi orqali faollashtirildi: TxID payme-cancel-03',
      },
    ],
  };

  const mockAdmin = {
    from: (table) => {
      let currentQuery = { table, filters: {} };
      const chain = {
        select: () => chain,
        update: (data) => ({
          eq: (k, v) => {
            const list = table === 'user_subscriptions' ? memoryDb.subscriptions : memoryDb.transactions;
            const matches = list.filter(item => item[k] === v);
            matches.forEach(item => Object.assign(item, data));
            return {
              eq: (k2, v2) => {
                const subMatches = matches.filter(item => item[k2] === v2);
                subMatches.forEach(item => Object.assign(item, data));
                return { data: subMatches, error: null };
              },
              ilike: (col, pattern) => {
                const cleanPattern = pattern.replace(/%/g, '');
                const matched = matches.filter(item => String(item[col] || '').includes(cleanPattern));
                matched.forEach(item => Object.assign(item, data));
                return { data: matched, error: null };
              },
              data: matches,
              error: null,
            };
          },
        }),
        eq: (k, v) => {
          currentQuery.filters[k] = v;
          return chain;
        },
        maybeSingle: async () => {
          if (table === 'subscription_transactions') {
            const t = memoryDb.transactions.find(x => x.transaction_id === currentQuery.filters.transaction_id);
            return { data: t || null, error: null };
          }
          return { data: null, error: null };
        },
      };
      return chain;
    },
  };

  // 1. Execute Click cancellation for clk-cancel-02
  const clickCancelRes = await handleClickComplete({
    click_trans_id: 'clk-cancel-02',
    merchant_trans_id: 'user-multi-sub',
    error: -9,
  }, mockAdmin);

  assert.equal(clickCancelRes.error, CLICK_ERROR.CANCELLED);
  assert.equal(memoryDb.subscriptions.find(s => s.id === 'sub-to-cancel-clk').status, 'cancelled');
  assert.equal(memoryDb.subscriptions.find(s => s.id === 'sub-existing-year').status, 'active');

  // 2. Execute Payme CancelTransaction for payme-cancel-03
  const paymeCancelRes = await handlePaymeRpc({
    id: 99,
    method: 'CancelTransaction',
    params: { id: 'payme-cancel-03', reason: 2 },
  }, mockAdmin);

  assert.equal(paymeCancelRes.result.state, PAYME_STATE.CANCELLED_AFTER_PAYMENT);
  assert.equal(memoryDb.subscriptions.find(s => s.id === 'sub-to-cancel-payme').status, 'cancelled');
  // CRITICAL: Pre-existing annual subscription MUST STILL REMAIN ACTIVE!
  assert.equal(memoryDb.subscriptions.find(s => s.id === 'sub-existing-year').status, 'active');
});


test('7. Concurrency Protection: Parallel Complete & Perform Calls do not Duplicate Subscriptions', async () => {
  const memoryDb = {
    users: [{ id: 'user-concurrent', username: 'kirito-race' }],
    transactions: [
      {
        id: 'tx-clk-race',
        transaction_id: 'clk-race-01',
        user_id: 'user-concurrent',
        status: 'pending',
        amount_uzs: 25000,
        metadata: {
          merchant_prepare_id: 'prep-clk-race',
          duration_days: 30,
          plan_name: 'VIP 1 Oy',
        },
      },
    ],
    subscriptions: [],
    auditLogs: [],
  };

  let firstUpdateCompleted = false;

  const mockAdmin = {
    from: (table) => {
      let currentQuery = { table, filters: {} };
      const chain = {
        select: () => chain,
        insert: (data) => {
          const row = { id: `sub-${Date.now()}-${Math.random()}`, ...data };
          if (table === 'user_subscriptions') memoryDb.subscriptions.push(row);
          if (table === 'subscription_audit_logs') memoryDb.auditLogs.push(row);
          return {
            select: () => ({
              single: async () => ({ data: row, error: null }),
              maybeSingle: async () => ({ data: row, error: null }),
            }),
            data: [row],
            error: null,
          };
        },
        update: (data) => ({
          eq: (k, v) => {
            currentQuery.filters[k] = v;
            return {
              eq: (k2, v2) => {
                const tx = memoryDb.transactions.find(t => t.id === currentQuery.filters.id);
                // Atomic condition check: if k2 is status and v2 is pending
                if (k2 === 'status' && v2 === 'pending') {
                  if (tx && tx.status === 'pending' && !firstUpdateCompleted) {
                    firstUpdateCompleted = true;
                    Object.assign(tx, data);
                    return {
                      select: () => ({ data: [tx], error: null }),
                      data: [tx],
                      error: null,
                    };
                  } else {
                    // Already updated by concurrent thread! Returns 0 updated rows
                    return {
                      select: () => ({ data: [], error: null }),
                      data: [],
                      error: null,
                    };
                  }
                }
                if (tx) Object.assign(tx, data);
                return {
                  select: () => ({ data: [tx], error: null }),
                  data: [tx],
                  error: null,
                };
              },
            };
          },
        }),
        eq: (k, v) => {
          currentQuery.filters[k] = v;
          return chain;
        },
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => {
          if (table === 'subscription_transactions') {
            const t = memoryDb.transactions.find(x => x.transaction_id === currentQuery.filters.transaction_id || x.id === currentQuery.filters.id);
            return { data: t || null, error: null };
          }
          if (table === 'user_subscriptions') {
            return { data: memoryDb.subscriptions[0] || null, error: null };
          }
          return { data: null, error: null };
        },
      };
      return chain;
    },
  };

  // Run two concurrent handleClickComplete invocations
  const [res1, res2] = await Promise.all([
    handleClickComplete({
      click_trans_id: 'clk-race-01',
      merchant_trans_id: 'user-concurrent',
      merchant_prepare_id: 'prep-clk-race',
      amount: 25000,
    }, mockAdmin),
    handleClickComplete({
      click_trans_id: 'clk-race-01',
      merchant_trans_id: 'user-concurrent',
      merchant_prepare_id: 'prep-clk-race',
      amount: 25000,
    }, mockAdmin),
  ]);

  // Both should succeed gracefully
  assert.equal(res1.error, CLICK_ERROR.SUCCESS);
  assert.equal(res2.error, CLICK_ERROR.SUCCESS);

  // CRITICAL ATOMICITY CHECK: Exactly 1 subscription created despite concurrent requests
  assert.equal(memoryDb.subscriptions.length, 1, 'Concurrent requests must create strictly 1 subscription row');
  assert.equal(memoryDb.transactions[0].status, 'completed');
});
