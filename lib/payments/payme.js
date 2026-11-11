import { calculateSubscriptionDates } from './provider.js';

export const PAYME_ERROR = {
  TRANSPORT_ERROR: -32300,
  ACCESS_DENIED: -32504,
  METHOD_NOT_FOUND: -32601,
  INVALID_JSON: -32700,
  INVALID_AMOUNT: -31001,
  TRANSACTION_NOT_FOUND: -31003,
  CANNOT_PERFORM_OPERATION: -31008,
  CANNOT_CANCEL: -31007,
  USER_NOT_FOUND: -31050,
};

export const PAYME_STATE = {
  CREATED: 1,
  COMPLETED: 2,
  CANCELLED_BEFORE_PAYMENT: -1,
  CANCELLED_AFTER_PAYMENT: -2,
};

/**
 * Validates Payme Basic Authentication header.
 *
 * @param {string} authHeader
 * @param {string} secretKey
 * @returns {boolean}
 */
export function verifyPaymeAuth(authHeader, secretKey = process.env.PAYME_SECRET_KEY || '') {
  if (!authHeader || !authHeader.startsWith('Basic ')) return false;
  if (!secretKey) return false;

  try {
    const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
    const [, password] = decoded.split(':');
    return password === secretKey;
  } catch {
    return false;
  }
}

/**
 * Formats a successful JSON-RPC 2.0 response.
 */
function rpcSuccess(id, result) {
  return {
    jsonrpc: '2.0',
    id,
    result,
  };
}

/**
 * Formats a standard Payme JSON-RPC 2.0 error response.
 */
function rpcError(id, code, messageUz, data = null) {
  return {
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message: {
        uz: messageUz,
        ru: messageUz,
        en: messageUz,
      },
      data,
    },
  };
}

/**
 * Handles incoming Payme JSON-RPC 2.0 method calls.
 *
 * @param {object} req - JSON-RPC request body
 * @param {object} adminClient - Supabase admin client
 * @returns {Promise<object>}
 */
export async function handlePaymeRpc(req, adminClient) {
  const { id, method, params } = req || {};

  if (!method) {
    return rpcError(id, PAYME_ERROR.METHOD_NOT_FOUND, 'Metod kiritilmagan');
  }

  switch (method) {
    case 'CheckPerformTransaction': {
      const userId = params?.account?.user_id;
      const amount = Number(params?.amount) || 0; // in tiyin

      if (!userId) {
        return rpcError(id, PAYME_ERROR.USER_NOT_FOUND, 'Foydalanuvchi hisobi ko‘rsatilmagan', 'user_id');
      }

      const { data: user } = await adminClient
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .maybeSingle();

      if (!user) {
        return rpcError(id, PAYME_ERROR.USER_NOT_FOUND, 'Foydalanuvchi topilmadi', 'user_id');
      }

      if (amount <= 0) {
        return rpcError(id, PAYME_ERROR.INVALID_AMOUNT, 'Noto‘g‘ri to‘lov summasi', 'amount');
      }

      return rpcSuccess(id, { allow: true });
    }

    case 'CreateTransaction': {
      const paymeTxId = params?.id;
      const time = Number(params?.time) || Date.now();
      const amount = Number(params?.amount) || 0;
      const userId = params?.account?.user_id;
      const planId = params?.account?.plan_id;

      // 1. Check if transaction already exists
      const { data: existingTx } = await adminClient
        .from('subscription_transactions')
        .select('*')
        .eq('transaction_id', paymeTxId)
        .maybeSingle();

      if (existingTx) {
        const txState = existingTx.metadata?.payme_state || PAYME_STATE.CREATED;
        if (txState !== PAYME_STATE.CREATED) {
          if (txState === PAYME_STATE.COMPLETED) {
            return rpcSuccess(id, {
              create_time: Number(existingTx.metadata?.payme_create_time) || time,
              transaction: existingTx.id,
              state: PAYME_STATE.COMPLETED,
            });
          }
          return rpcError(id, PAYME_ERROR.CANNOT_PERFORM_OPERATION, 'Tranzaksiya holati yaroqsiz');
        }

        // Check timeout (12 hours)
        const ageMs = Date.now() - (Number(existingTx.metadata?.payme_create_time) || time);
        if (ageMs > 43200000) {
          await adminClient
            .from('subscription_transactions')
            .update({ status: 'cancelled', metadata: { ...existingTx.metadata, payme_state: PAYME_STATE.CANCELLED_BEFORE_PAYMENT } })
            .eq('id', existingTx.id);

          return rpcError(id, PAYME_ERROR.CANNOT_PERFORM_OPERATION, 'Tranzaksiya vaqti tugagan');
        }

        return rpcSuccess(id, {
          create_time: Number(existingTx.metadata?.payme_create_time) || time,
          transaction: existingTx.id,
          state: PAYME_STATE.CREATED,
        });
      }

      if (amount <= 0) {
        return rpcError(id, PAYME_ERROR.INVALID_AMOUNT, 'Noto‘g‘ri to‘lov summasi', 'amount');
      }

      if (planId) {
        const { data: plan } = await adminClient
          .from('subscription_plans')
          .select('id, price_uzs')
          .eq('id', planId)
          .maybeSingle();

        if (plan && Math.round(amount / 100) !== Number(plan.price_uzs)) {
          return rpcError(id, PAYME_ERROR.INVALID_AMOUNT, 'To‘lov summasi tarif narxiga mos kelmadi', 'amount');
        }
      }

      // 2. Validate user
      const { data: user } = await adminClient
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .maybeSingle();

      if (!user) {
        return rpcError(id, PAYME_ERROR.USER_NOT_FOUND, 'Foydalanuvchi topilmadi', 'user_id');
      }

      // 3. Insert transaction in state 1 (Created)
      const amountUzs = Math.round(amount / 100);
      const { data: newTx, error: insErr } = await adminClient
        .from('subscription_transactions')
        .insert({
          transaction_id: paymeTxId,
          user_id: userId,
          plan_id: planId || null,
          amount_uzs: amountUzs,
          currency: 'UZS',
          provider: 'payme',
          status: 'pending',
          provider_tx_id: paymeTxId,
          metadata: {
            payme_state: PAYME_STATE.CREATED,
            payme_create_time: time,
          },
        })
        .select()
        .single();

      if (insErr) {
        return rpcError(id, PAYME_ERROR.CANNOT_PERFORM_OPERATION, insErr.message);
      }

      return rpcSuccess(id, {
        create_time: time,
        transaction: newTx.id,
        state: PAYME_STATE.CREATED,
      });
    }

    case 'PerformTransaction': {
      const paymeTxId = params?.id;

      const { data: tx, error: txErr } = await adminClient
        .from('subscription_transactions')
        .select('*')
        .eq('transaction_id', paymeTxId)
        .maybeSingle();

      if (txErr || !tx) {
        return rpcError(id, PAYME_ERROR.TRANSACTION_NOT_FOUND, 'Tranzaksiya topilmadi');
      }

      const currentState = tx.metadata?.payme_state || PAYME_STATE.CREATED;
      if (currentState === PAYME_STATE.COMPLETED) {
        return rpcSuccess(id, {
          transaction: tx.id,
          perform_time: Number(tx.metadata?.payme_perform_time) || Date.now(),
          state: PAYME_STATE.COMPLETED,
        });
      }

      if (currentState !== PAYME_STATE.CREATED) {
        return rpcError(id, PAYME_ERROR.CANNOT_PERFORM_OPERATION, 'Tranzaksiyani yakunlab bo‘lmaydi');
      }

      const performTime = Date.now();

      // Retrieve plan metadata
      let planDays = 30;
      let planName = 'VIP Standart';
      if (tx.plan_id) {
        const { data: p } = await adminClient
          .from('subscription_plans')
          .select('name, duration_days')
          .eq('id', tx.plan_id)
          .maybeSingle();
        if (p) {
          planDays = p.duration_days || 30;
          planName = p.name;
        }
      }

      // Calculate dates
      const { data: currentSubs } = await adminClient
        .from('user_subscriptions')
        .select('expires_at')
        .eq('user_id', tx.user_id)
        .eq('status', 'active')
        .order('expires_at', { ascending: false })
        .limit(1);

      const existingExpiresAt = currentSubs?.[0]?.expires_at || null;
      const { startsAt, expiresAt, isExtended } = calculateSubscriptionDates(planDays, existingExpiresAt);

      // Update transaction to completed
      await adminClient
        .from('subscription_transactions')
        .update({
          status: 'completed',
          updated_at: new Date().toISOString(),
          metadata: {
            ...tx.metadata,
            payme_state: PAYME_STATE.COMPLETED,
            payme_perform_time: performTime,
            isExtended,
          },
        })
        .eq('id', tx.id);

      // Insert subscription
      await adminClient.from('user_subscriptions').insert({
        user_id: tx.user_id,
        plan_id: tx.plan_id,
        plan_name: planName,
        status: 'active',
        starts_at: startsAt,
        expires_at: expiresAt,
        grant_type: 'online_payment',
        notes: `Payme to‘lovi orqali faollashtirildi: TxID ${paymeTxId}`,
      });

      // Audit log
      await adminClient.from('subscription_audit_logs').insert({
        user_id: tx.user_id,
        action: isExtended ? 'extend' : 'grant',
        previous_plan: currentSubs?.[0]?.plan_name || null,
        previous_expires_at: existingExpiresAt,
        new_plan: planName,
        new_expires_at: expiresAt,
        reason: `Payme to‘lovi orqali ${planDays} kunga faollashtirildi`,
      });

      return rpcSuccess(id, {
        transaction: tx.id,
        perform_time: performTime,
        state: PAYME_STATE.COMPLETED,
      });
    }

    case 'CancelTransaction': {
      const paymeTxId = params?.id;
      const reason = Number(params?.reason) || 1;

      const { data: tx, error: txErr } = await adminClient
        .from('subscription_transactions')
        .select('*')
        .eq('transaction_id', paymeTxId)
        .maybeSingle();

      if (txErr || !tx) {
        return rpcError(id, PAYME_ERROR.TRANSACTION_NOT_FOUND, 'Tranzaksiya topilmadi');
      }

      const currentState = tx.metadata?.payme_state || PAYME_STATE.CREATED;
      const cancelTime = Date.now();

      if (currentState === PAYME_STATE.CANCELLED_BEFORE_PAYMENT || currentState === PAYME_STATE.CANCELLED_AFTER_PAYMENT) {
        return rpcSuccess(id, {
          transaction: tx.id,
          cancel_time: Number(tx.metadata?.payme_cancel_time) || cancelTime,
          state: currentState,
        });
      }

      const nextState = currentState === PAYME_STATE.COMPLETED
        ? PAYME_STATE.CANCELLED_AFTER_PAYMENT
        : PAYME_STATE.CANCELLED_BEFORE_PAYMENT;

      if (currentState === PAYME_STATE.COMPLETED) {
        await adminClient
          .from('user_subscriptions')
          .update({
            status: 'cancelled',
            expires_at: new Date().toISOString(),
            notes: `Payme to‘lovi bekor qilindi (Refund): TxID ${paymeTxId}`,
          })
          .eq('user_id', tx.user_id)
          .eq('status', 'active');
      }

      await adminClient
        .from('subscription_transactions')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString(),
          metadata: {
            ...tx.metadata,
            payme_state: nextState,
            payme_cancel_time: cancelTime,
            cancel_reason: reason,
          },
        })
        .eq('id', tx.id);

      return rpcSuccess(id, {
        transaction: tx.id,
        cancel_time: cancelTime,
        state: nextState,
      });
    }

    case 'CheckTransaction': {
      const paymeTxId = params?.id;

      const { data: tx, error: txErr } = await adminClient
        .from('subscription_transactions')
        .select('*')
        .eq('transaction_id', paymeTxId)
        .maybeSingle();

      if (txErr || !tx) {
        return rpcError(id, PAYME_ERROR.TRANSACTION_NOT_FOUND, 'Tranzaksiya topilmadi');
      }

      const state = tx.metadata?.payme_state || (tx.status === 'completed' ? PAYME_STATE.COMPLETED : PAYME_STATE.CREATED);

      return rpcSuccess(id, {
        create_time: Number(tx.metadata?.payme_create_time) || 0,
        perform_time: Number(tx.metadata?.payme_perform_time) || 0,
        cancel_time: Number(tx.metadata?.payme_cancel_time) || 0,
        transaction: tx.id,
        state,
        reason: tx.metadata?.cancel_reason || null,
      });
    }

    case 'GetStatement': {
      const fromTime = Number(params?.from) || 0;
      const toTime = Number(params?.to) || Date.now();

      const fromIso = new Date(fromTime).toISOString();
      const toIso = new Date(toTime).toISOString();

      const { data: txs } = await adminClient
        .from('subscription_transactions')
        .select('*')
        .eq('provider', 'payme')
        .gte('created_at', fromIso)
        .lte('created_at', toIso)
        .order('created_at', { ascending: true });

      const list = (txs || []).map((t) => ({
        id: t.transaction_id,
        time: Number(t.metadata?.payme_create_time) || new Date(t.created_at).getTime(),
        amount: (Number(t.amount_uzs) || 0) * 100,
        account: {
          user_id: t.user_id,
          plan_id: t.plan_id,
        },
        create_time: Number(t.metadata?.payme_create_time) || new Date(t.created_at).getTime(),
        perform_time: Number(t.metadata?.payme_perform_time) || 0,
        cancel_time: Number(t.metadata?.payme_cancel_time) || 0,
        transaction: t.id,
        state: t.metadata?.payme_state || (t.status === 'completed' ? PAYME_STATE.COMPLETED : PAYME_STATE.CREATED),
        reason: t.metadata?.cancel_reason || null,
      }));

      return rpcSuccess(id, { transactions: list });
    }

    default:
      return rpcError(id, PAYME_ERROR.METHOD_NOT_FOUND, `Metod topilmadi: ${method}`);
  }
}
