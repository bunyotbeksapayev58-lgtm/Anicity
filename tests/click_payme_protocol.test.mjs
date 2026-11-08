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
