import crypto from 'node:crypto';
import { calculateSubscriptionDates } from './provider.js';

export const CLICK_ERROR = {
  SUCCESS: 0,
  SIGN_CHECK_FAILED: -1,
  INVALID_AMOUNT: -2,
  ACTION_NOT_FOUND: -3,
  ALREADY_PAID: -4,
  USER_NOT_FOUND: -5,
  TRANSACTION_NOT_FOUND: -6,
  UPDATE_FAILED: -7,
  REQUEST_ERROR: -8,
  CANCELLED: -9,
};

/**
 * Validates Click MD5 signature according to official specification.
 *
 * @param {object} body
 * @param {string} secretKey
 * @returns {boolean}
 */
export function verifyClickSignature(body, secretKey = process.env.CLICK_SECRET_KEY || '') {
  if (!secretKey) return false;
  const action = Number(body?.action);
  const clickTransId = String(body?.click_trans_id || '');
  const serviceId = String(body?.service_id || '');
  const merchantTransId = String(body?.merchant_trans_id || '');
  const merchantPrepareId = String(body?.merchant_prepare_id || '');
  const amount = String(body?.amount || '');
  const signTime = String(body?.sign_time || '');
  const providedSign = String(body?.sign_string || '').toLowerCase();

  let signString = '';
  if (action === 0) {
    // Prepare action
    signString = `${clickTransId}${serviceId}${secretKey}${merchantTransId}${amount}${action}${signTime}`;
  } else if (action === 1) {
    // Complete action
    signString = `${clickTransId}${serviceId}${secretKey}${merchantTransId}${merchantPrepareId}${amount}${action}${signTime}`;
  } else {
    return false;
  }

  const expectedSign = crypto.createHash('md5').update(signString).digest('hex').toLowerCase();
  if (providedSign.length !== expectedSign.length) return false;
  return crypto.timingSafeEqual(Buffer.from(providedSign), Buffer.from(expectedSign));
}

/**
 * Handles Click Step 1: Prepare (action = 0)
 * Verifies that the user and plan exist and creates a pending prepare record.
 */
export async function handleClickPrepare(body, adminClient) {
  const clickTransId = String(body.click_trans_id || '');
  const userId = String(body.merchant_trans_id || '');
  const amount = Number(body.amount) || 0;
  const planId = String(body.additional_param3 || body.param2 || '');

  // 1. Verify user exists
  const { data: user, error: userErr } = await adminClient
    .from('profiles')
    .select('id, username')
    .eq('id', userId)
    .maybeSingle();

  if (userErr || !user) {
    return {
      click_trans_id: clickTransId,
      merchant_trans_id: userId,
      error: CLICK_ERROR.USER_NOT_FOUND,
      error_note: 'Foydalanuvchi topilmadi (User not found)',
    };
  }

  // 2. Verify plan
  let plan = null;
  if (planId) {
    const { data: p } = await adminClient
      .from('subscription_plans')
      .select('id, name, price_uzs, duration_days, is_active')
      .eq('id', planId)
      .maybeSingle();
    plan = p;
    if (!plan || plan.is_active === false) {
      return {
        click_trans_id: clickTransId,
        merchant_trans_id: userId,
        error: CLICK_ERROR.INVALID_AMOUNT,
        error_note: 'Tarif rejasi topilmadi yoki nofaol (Invalid or inactive plan ID)',
      };
    }
  }

  // Validate positive amount and plan price match
  if (amount <= 0 || (plan && Number(amount) !== Number(plan.price_uzs))) {
    return {
      click_trans_id: clickTransId,
      merchant_trans_id: userId,
      error: CLICK_ERROR.INVALID_AMOUNT,
      error_note: 'Noto‘g‘ri to‘lov summasi (Invalid payment amount)',
    };
  }

  // 3. Create or check existing transaction
  const merchantPrepareId = `prep-${clickTransId}-${Date.now()}`;
  const { data: existingTx } = await adminClient
    .from('subscription_transactions')
    .select('id, status, transaction_id')
    .eq('transaction_id', clickTransId)
    .maybeSingle();

  if (existingTx) {
    if (existingTx.status === 'completed') {
      return {
        click_trans_id: clickTransId,
        merchant_trans_id: userId,
        error: CLICK_ERROR.ALREADY_PAID,
        error_note: 'Tranzaksiya avval to‘langan (Already paid)',
      };
    }
  } else {
    // Record pending transaction
    await adminClient.from('subscription_transactions').insert({
      transaction_id: clickTransId,
      user_id: userId,
      plan_id: plan?.id || null,
      amount_uzs: amount,
      currency: 'UZS',
      provider: 'click',
      status: 'pending',
      provider_tx_id: clickTransId,
      metadata: {
        merchant_prepare_id: merchantPrepareId,
        click_paydoc_id: body.click_paydoc_id,
        plan_name: plan?.name || 'VIP Standart',
        duration_days: plan?.duration_days || 30,
      },
    });
  }

  return {
    click_trans_id: clickTransId,
    merchant_trans_id: userId,
    merchant_prepare_id: merchantPrepareId,
    error: CLICK_ERROR.SUCCESS,
    error_note: 'Success',
  };
}

/**
 * Handles Click Step 2: Complete (action = 1)
 * Finalizes transaction and activates VIP subscription atomically.
 */
export async function handleClickComplete(body, adminClient) {
  const clickTransId = String(body.click_trans_id || '');
  const userId = String(body.merchant_trans_id || '');
  const merchantPrepareId = String(body.merchant_prepare_id || '');
  const clickError = Number(body.error) || 0;

  // Handle Click cancel notification
  if (clickError < 0) {
    const { data: txToCancel } = await adminClient
      .from('subscription_transactions')
      .select('id, metadata, user_id')
      .eq('transaction_id', clickTransId)
      .maybeSingle();

    await adminClient
      .from('subscription_transactions')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('transaction_id', clickTransId);

    const subId = txToCancel?.metadata?.subscription_id;
    if (subId) {
      // Specifically revoke ONLY the subscription created for this transaction
      await adminClient
        .from('user_subscriptions')
        .update({
          status: 'cancelled',
          expires_at: new Date().toISOString(),
          notes: `Click to‘lovi bekor qilindi: TxID ${clickTransId}`,
        })
        .eq('id', subId);
    } else {
      // Fallback: revoke ONLY subscription tied to this transaction ID in notes
      await adminClient
        .from('user_subscriptions')
        .update({
          status: 'cancelled',
          expires_at: new Date().toISOString(),
          notes: `Click to‘lovi bekor qilindi: TxID ${clickTransId}`,
        })
        .eq('user_id', userId)
        .ilike('notes', `%${clickTransId}%`);
    }

    return {
      click_trans_id: clickTransId,
      merchant_trans_id: userId,
      error: CLICK_ERROR.CANCELLED,
      error_note: 'Transaction cancelled by Click',
    };
  }

  // 1. Locate the prepared transaction
  const { data: tx, error: txErr } = await adminClient
    .from('subscription_transactions')
    .select('*')
    .eq('transaction_id', clickTransId)
    .maybeSingle();

  if (txErr || !tx) {
    return {
      click_trans_id: clickTransId,
      merchant_trans_id: userId,
      error: CLICK_ERROR.TRANSACTION_NOT_FOUND,
      error_note: 'Tranzaksiya topilmadi (Transaction not found)',
    };
  }

  // Validate merchant_prepare_id matches prepared transaction
  if (tx.metadata?.merchant_prepare_id && merchantPrepareId && tx.metadata.merchant_prepare_id !== merchantPrepareId) {
    return {
      click_trans_id: clickTransId,
      merchant_trans_id: userId,
      error: CLICK_ERROR.TRANSACTION_NOT_FOUND,
      error_note: 'Yaroqsiz prepare ID (Merchant prepare ID mismatch)',
    };
  }

  // Validate complete amount matches prepared amount
  if (body.amount !== undefined && Number(body.amount) !== Number(tx.amount_uzs)) {
    return {
      click_trans_id: clickTransId,
      merchant_trans_id: userId,
      error: CLICK_ERROR.INVALID_AMOUNT,
      error_note: 'To‘lov summasi mos kelmadi (Amount mismatch)',
    };
  }

  // Idempotency: If already completed, return success immediately
  if (tx.status === 'completed') {
    return {
      click_trans_id: clickTransId,
      merchant_trans_id: userId,
      merchant_confirm_id: tx.id,
      error: CLICK_ERROR.SUCCESS,
      error_note: 'Already completed',
    };
  }

  // 2. Retrieve plan metadata
  const planDays = tx.metadata?.duration_days || 30;
  const planName = tx.metadata?.plan_name || 'VIP Standart';

  // 3. Smart subscription extension: calculate new dates
  const { data: currentSubs } = await adminClient
    .from('user_subscriptions')
    .select('expires_at')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('expires_at', { ascending: false })
    .limit(1);

  const existingExpiresAt = currentSubs?.[0]?.expires_at || null;
  const { startsAt, expiresAt, isExtended } = calculateSubscriptionDates(
    planDays,
    existingExpiresAt
  );

  // 4. Update transaction status to completed atomically
  const updateQuery = adminClient
    .from('subscription_transactions')
    .update({
      status: 'completed',
      updated_at: new Date().toISOString(),
      metadata: { ...tx.metadata, isExtended, completed_at: new Date().toISOString() },
    })
    .eq('id', tx.id);

  let updatedTxList = null;
  if (typeof updateQuery?.eq === 'function') {
    const chained = updateQuery.eq('status', 'pending');
    if (typeof chained?.select === 'function') {
      const res = await chained.select('id');
      updatedTxList = res?.data;
    } else {
      const res = await chained;
      updatedTxList = res?.data || [tx];
    }
  } else {
    const res = await updateQuery;
    updatedTxList = res?.data || [tx];
  }

  // Concurrency guard: if another concurrent request completed it first
  if (Array.isArray(updatedTxList) && updatedTxList.length === 0) {
    const { data: recheckTx } = await adminClient
      .from('subscription_transactions')
      .select('status, id')
      .eq('id', tx.id)
      .maybeSingle();

    if (recheckTx?.status === 'completed') {
      return {
        click_trans_id: clickTransId,
        merchant_trans_id: userId,
        merchant_confirm_id: tx.id,
        error: CLICK_ERROR.SUCCESS,
        error_note: 'Already completed',
      };
    }
    return {
      click_trans_id: clickTransId,
      merchant_trans_id: userId,
      error: CLICK_ERROR.UPDATE_FAILED,
      error_note: 'Tranzaksiya holatini yangilab bo‘lmadi',
    };
  }

  // 5. Insert active user subscription with explicit failure detection
  let createdSubId = null;
  let subInsertError = null;
  try {
    const insertQuery = adminClient.from('user_subscriptions').insert({
      user_id: userId,
      plan_id: tx.plan_id,
      plan_name: planName,
      status: 'active',
      starts_at: startsAt,
      expires_at: expiresAt,
      grant_type: 'online_payment',
      notes: `Click to‘lovi muvaffaqiyatli: TxID ${clickTransId}`,
    });

    let res = null;
    if (typeof insertQuery?.select === 'function') {
      const sel = insertQuery.select('id');
      res = typeof sel?.maybeSingle === 'function'
        ? await sel.maybeSingle()
        : (typeof sel?.single === 'function' ? await sel.single() : await sel);
    } else {
      res = await insertQuery;
    }

    if (res?.error) {
      subInsertError = res.error;
    } else {
      createdSubId = res?.data?.id || (Array.isArray(res?.data) ? res?.data[0]?.id : null);
    }
  } catch (err) {
    subInsertError = err;
  }

  if (subInsertError) {
    console.error('[Click Complete Error] Failed to create user subscription:', subInsertError);
    return {
      click_trans_id: clickTransId,
      merchant_trans_id: userId,
      error: CLICK_ERROR.UPDATE_FAILED,
      error_note: 'Obuna yaratishda xatolik yuz berdi (Failed to create subscription)',
    };
  }

  if (createdSubId) {
    await adminClient
      .from('subscription_transactions')
      .update({
        metadata: {
          ...tx.metadata,
          isExtended,
          completed_at: new Date().toISOString(),
          subscription_id: createdSubId,
        },
      })
      .eq('id', tx.id);
  }

  // 6. Log audit trail
  await adminClient.from('subscription_audit_logs').insert({
    user_id: userId,
    action: isExtended ? 'extend' : 'grant',
    previous_plan: currentSubs?.[0]?.plan_name || null,
    previous_expires_at: existingExpiresAt,
    new_plan: planName,
    new_expires_at: expiresAt,
    reason: `Click onlayn to‘lovi orqali ${planDays} kunga faollashtirildi`,
  });

  return {
    click_trans_id: clickTransId,
    merchant_trans_id: userId,
    merchant_confirm_id: tx.id,
    error: CLICK_ERROR.SUCCESS,
    error_note: 'Success',
  };
}
