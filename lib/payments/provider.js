import crypto from 'node:crypto';

export const PAYMENT_PROVIDERS = {
  PAYME: 'payme',
  CLICK: 'click',
  STRIPE: 'stripe',
  SANDBOX: 'sandbox',
};

/**
 * Calculates new subscription start and expiration dates, extending existing subscription if still active.
 *
 * @param {number} durationDays
 * @param {string|Date|null} existingExpiresAt
 * @param {Date} now
 * @returns {{ startsAt: string, expiresAt: string, isExtended: boolean }}
 */
export function calculateSubscriptionDates(durationDays = 30, existingExpiresAt = null, now = new Date()) {
  const nowDate = now instanceof Date ? now : new Date(now);
  const nowMs = nowDate.getTime();

  let baseTime = nowMs;
  let isExtended = false;

  if (existingExpiresAt) {
    const existingTime = new Date(existingExpiresAt).getTime();
    if (Number.isFinite(existingTime) && existingTime > nowMs) {
      baseTime = existingTime;
      isExtended = true;
    }
  }

  const durationMs = durationDays * 24 * 60 * 60 * 1000;
  const expiresAt = new Date(baseTime + durationMs);

  return {
    startsAt: nowDate.toISOString(),
    expiresAt: expiresAt.toISOString(),
    isExtended,
  };
}

/**
 * Creates checkout URL for given payment provider.
 *
 * @param {object} params
 * @param {string} params.provider - 'payme' | 'click' | 'stripe' | 'sandbox'
 * @param {string} params.planId
 * @param {string} params.planName
 * @param {number} params.amountUzs
 * @param {string} params.userId
 * @param {string} params.returnUrl
 * @returns {string}
 */
export function createCheckoutUrl({
  provider,
  planId,
  planName = 'AniCity VIP',
  amountUzs,
  userId,
  returnUrl = 'https://anicity-app.vercel.app/profile',
}) {
  const p = String(provider || '').toLowerCase();

  switch (p) {
    case PAYMENT_PROVIDERS.PAYME: {
      const merchantId = process.env.PAYME_MERCHANT_ID;
      if (!merchantId && process.env.NODE_ENV === 'production') {
        throw new Error('PAYME_MERCHANT_ID sozlanmagan');
      }
      const activeMerchantId = merchantId || 'dummy-merchant';
      // Payme expects amount in tiyin (1 UZS = 100 tiyin)
      const amountTiyin = amountUzs * 100;
      const params = `m=${activeMerchantId};ac.user_id=${userId};ac.plan_id=${planId};a=${amountTiyin};c=${returnUrl}`;
      const encoded = Buffer.from(params).toString('base64');
      return `https://checkout.paycom.uz/${encoded}`;
    }

    case PAYMENT_PROVIDERS.CLICK: {
      const serviceId = process.env.CLICK_SERVICE_ID;
      const merchantId = process.env.CLICK_MERCHANT_ID;
      if ((!serviceId || !merchantId) && process.env.NODE_ENV === 'production') {
        throw new Error('CLICK_SERVICE_ID yoki CLICK_MERCHANT_ID sozlanmagan');
      }
      const activeServiceId = serviceId || 'dummy-service';
      const activeMerchantId = merchantId || 'dummy-merchant';
      const params = new URLSearchParams({
        service_id: activeServiceId,
        merchant_id: activeMerchantId,
        amount: String(amountUzs),
        transaction_param: userId,
        additional_param3: planId,
        return_url: returnUrl,
      });
      return `https://my.click.uz/services/pay?${params.toString()}`;
    }

    case PAYMENT_PROVIDERS.SANDBOX: {
      const token = crypto.randomBytes(16).toString('hex');
      const params = new URLSearchParams({
        sandbox_tx: token,
        user_id: userId,
        plan_id: planId,
        amount: String(amountUzs),
        return_url: returnUrl,
      });
      return `/api/payments/sandbox-checkout?${params.toString()}`;
    }

    default:
      throw new Error(`Unsupported payment provider: ${provider}`);
  }
}

/**
 * Verifies webhook signatures for payment providers.
 *
 * @param {object} options
 * @param {string} options.provider
 * @param {Headers|object} options.headers
 * @param {object|string} options.body
 * @param {string} options.rawBody
 * @param {string} options.secret
 * @returns {boolean}
 */
export function verifyWebhookSignature({ provider, headers, body, rawBody = '', secret }) {
  const p = String(provider || '').toLowerCase();
  const getH = (k) => (typeof headers?.get === 'function' ? headers.get(k) : headers?.[k]);

  if (p === PAYMENT_PROVIDERS.SANDBOX) {
    const sandboxSecret = secret || process.env.PAYMENTS_SANDBOX_SECRET;
    if (!sandboxSecret) return false;
    if (process.env.NODE_ENV === 'production' && sandboxSecret === 'anicity-sandbox-secret') return false;
    const reqSecret = getH('x-sandbox-secret') || (typeof body === 'object' ? body?.sandbox_secret : null);
    return Boolean(reqSecret && reqSecret === sandboxSecret);
  }

  if (p === PAYMENT_PROVIDERS.CLICK) {
    const clickSecret = secret || process.env.CLICK_SECRET_KEY || '';
    if (!clickSecret) return false;

    // Click MD5 signature verification:
    // md5(click_trans_id + service_id + secret_key + merchant_trans_id + amount + action + sign_time)
    const b = typeof body === 'object' ? body : {};
    const signString = `${b.click_trans_id || ''}${b.service_id || ''}${clickSecret}${b.merchant_trans_id || ''}${b.amount || ''}${b.action || ''}${b.sign_time || ''}`;
    const calculatedSign = crypto.createHash('md5').update(signString).digest('hex');

    const provided = String(b.sign_string || '').toLowerCase();
    if (provided.length !== calculatedSign.length) return false;
    return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(calculatedSign));
  }

  if (p === PAYMENT_PROVIDERS.PAYME) {
    const paymeSecret = secret || process.env.PAYME_SECRET_KEY || '';
    if (!paymeSecret) return false;

    const authHeader = getH('authorization') || '';
    if (!authHeader.startsWith('Basic ')) return false;

    const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
    const [, password] = decoded.split(':');
    return password === paymeSecret;
  }

  return false;
}
