import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  PAYMENT_PROVIDERS,
  calculateSubscriptionDates,
  createCheckoutUrl,
  verifyWebhookSignature,
} from '../lib/payments/provider.js';

test('1. calculateSubscriptionDates computes correct dates and extensions', () => {
  const now = new Date('2026-11-06T12:00:00Z');

  // Case A: Fresh subscription (no existing)
  const fresh = calculateSubscriptionDates(30, null, now);
  assert.equal(fresh.startsAt, '2026-11-06T12:00:00.000Z');
  assert.equal(fresh.expiresAt, '2026-12-06T12:00:00.000Z');
  assert.equal(fresh.isExtended, false);

  // Case B: Active subscription extending 15 days ahead
  const existingActive = '2026-11-20T12:00:00.000Z';
  const extended = calculateSubscriptionDates(30, existingActive, now);
  assert.equal(extended.startsAt, '2026-11-06T12:00:00.000Z');
  assert.equal(extended.expiresAt, '2026-12-20T12:00:00.000Z'); // 30 days added to existing expiration!
  assert.equal(extended.isExtended, true);

  // Case C: Past expired subscription (should NOT extend from past)
  const pastExpired = '2026-10-01T12:00:00.000Z';
  const renewed = calculateSubscriptionDates(30, pastExpired, now);
  assert.equal(renewed.startsAt, '2026-11-06T12:00:00.000Z');
  assert.equal(renewed.expiresAt, '2026-12-06T12:00:00.000Z');
  assert.equal(renewed.isExtended, false);
});

test('2. createCheckoutUrl generates valid checkout URLs for supported providers', () => {
  const plan = {
    planId: 'plan-uuid-1',
    planName: 'VIP 1 Oy',
    amountUzs: 25000,
    userId: 'user-uuid-99',
    returnUrl: 'https://anicity.uz/profile',
  };

  // Payme
  const paymeUrl = createCheckoutUrl({ ...plan, provider: PAYMENT_PROVIDERS.PAYME });
  assert.ok(paymeUrl.startsWith('https://checkout.paycom.uz/'));
  const b64 = paymeUrl.split('https://checkout.paycom.uz/')[1];
  const decoded = Buffer.from(b64, 'base64').toString('utf8');
  assert.ok(decoded.includes('ac.user_id=user-uuid-99'));
  assert.ok(decoded.includes('a=2500000')); // 25,000 UZS * 100 tiyin

  // Click
  const clickUrl = createCheckoutUrl({ ...plan, provider: PAYMENT_PROVIDERS.CLICK });
  assert.ok(clickUrl.startsWith('https://my.click.uz/services/pay?'));
  assert.ok(clickUrl.includes('transaction_param=user-uuid-99'));
  assert.ok(clickUrl.includes('amount=25000'));

  // Sandbox
  const sandboxUrl = createCheckoutUrl({ ...plan, provider: PAYMENT_PROVIDERS.SANDBOX });
  assert.ok(sandboxUrl.startsWith('/api/payments/sandbox-checkout?'));
  assert.ok(sandboxUrl.includes('user_id=user-uuid-99'));
});

test('3. verifyWebhookSignature validates cryptographic HMAC/hashes correctly', () => {
  // Sandbox secret check
  const sandboxValid = verifyWebhookSignature({
    provider: PAYMENT_PROVIDERS.SANDBOX,
    headers: { 'x-sandbox-secret': 'my-secret-key' },
    secret: 'my-secret-key',
  });
  assert.equal(sandboxValid, true);

  const sandboxInvalid = verifyWebhookSignature({
    provider: PAYMENT_PROVIDERS.SANDBOX,
    headers: { 'x-sandbox-secret': 'wrong-secret' },
    secret: 'my-secret-key',
  });
  assert.equal(sandboxInvalid, false);

  // Click MD5 signature verification
  const clickSecret = 'click-secret-key-123';
  const clickBody = {
    click_trans_id: '123456',
    service_id: '1001',
    merchant_trans_id: 'user-77',
    amount: '25000',
    action: '1',
    sign_time: '2026-11-06 12:00:00',
  };
  const clickRawSign = `${clickBody.click_trans_id}${clickBody.service_id}${clickSecret}${clickBody.merchant_trans_id}${clickBody.amount}${clickBody.action}${clickBody.sign_time}`;
  const validSign = crypto.createHash('md5').update(clickRawSign).digest('hex');

  const clickValid = verifyWebhookSignature({
    provider: PAYMENT_PROVIDERS.CLICK,
    body: { ...clickBody, sign_string: validSign },
    secret: clickSecret,
  });
  assert.equal(clickValid, true);

  const clickInvalid = verifyWebhookSignature({
    provider: PAYMENT_PROVIDERS.CLICK,
    body: { ...clickBody, sign_string: 'forged_tampered_signature' },
    secret: clickSecret,
  });
  assert.equal(clickInvalid, false);

  // Payme Basic Auth header verification
  const paymeSecret = 'payme-pass-999';
  const paymeValid = verifyWebhookSignature({
    provider: PAYMENT_PROVIDERS.PAYME,
    headers: {
      authorization: `Basic ${Buffer.from(`Paycom:${paymeSecret}`).toString('base64')}`,
    },
    secret: paymeSecret,
  });
  assert.equal(paymeValid, true);

  const paymeInvalid = verifyWebhookSignature({
    provider: PAYMENT_PROVIDERS.PAYME,
    headers: {
      authorization: `Basic ${Buffer.from('Paycom:wrong-pass').toString('base64')}`,
    },
    secret: paymeSecret,
  });
  assert.equal(paymeInvalid, false);
});
