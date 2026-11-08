import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  verifyClickSignature,
  handleClickPrepare,
  handleClickComplete,
  CLICK_ERROR,
} from '@/lib/payments/click';
import {
  verifyPaymeAuth,
  handlePaymeRpc,
  PAYME_ERROR,
} from '@/lib/payments/payme';
import {
  calculateSubscriptionDates,
  verifyWebhookSignature,
} from '@/lib/payments/provider';

export async function POST(request) {
  const url = new URL(request.url);
  const providerParam = url.searchParams.get('provider')?.toLowerCase();
  const authHeader = request.headers.get('authorization') || '';

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'Database admin configuration error' }, { status: 500 });
  }

  // ==========================================
  // 1. PAYME JSON-RPC 2.0 ROUTING
  // ==========================================
  const isPayme = providerParam === 'payme' || (body && typeof body.method === 'string' && body.jsonrpc === '2.0');
  if (isPayme) {
    const isAuth = verifyPaymeAuth(authHeader);
    if (!isAuth && process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        {
          jsonrpc: '2.0',
          id: body?.id,
          error: {
            code: PAYME_ERROR.ACCESS_DENIED,
            message: { uz: 'Ruxsat berilmadi', ru: 'Доступ запрещен', en: 'Access denied' },
          },
        },
        { status: 200 } // Payme expects HTTP 200 with JSON-RPC error
      );
    }

    const paymeResult = await handlePaymeRpc(body, admin);
    return NextResponse.json(paymeResult);
  }

  // ==========================================
  // 2. CLICK MERCHANT API ROUTING
  // ==========================================
  const isClick = providerParam === 'click' || ('click_trans_id' in (body || {}));
  if (isClick) {
    const isSignValid = verifyClickSignature(body);
    if (!isSignValid && process.env.NODE_ENV === 'production') {
      return NextResponse.json({
        click_trans_id: body?.click_trans_id,
        merchant_trans_id: body?.merchant_trans_id,
        error: CLICK_ERROR.SIGN_CHECK_FAILED,
        error_note: 'SIGN CHECK FAILED',
      });
    }

    const action = Number(body?.action);
    if (action === 0) {
      const prepRes = await handleClickPrepare(body, admin);
      return NextResponse.json(prepRes);
    } else if (action === 1) {
      const compRes = await handleClickComplete(body, admin);
      return NextResponse.json(compRes);
    } else {
      return NextResponse.json({
        click_trans_id: body?.click_trans_id,
        merchant_trans_id: body?.merchant_trans_id,
        error: CLICK_ERROR.ACTION_NOT_FOUND,
        error_note: 'Action not found',
      });
    }
  }

  // ==========================================
  // 3. SANDBOX & GENERIC TESTING ROUTING
  // ==========================================
  // In production, sandbox payments are disabled unless explicitly enabled with a strong non-default secret
  if (process.env.NODE_ENV === 'production') {
    const sbSecret = process.env.PAYMENTS_SANDBOX_SECRET;
    if (!sbSecret || sbSecret === 'anicity-sandbox-secret' || process.env.ENABLE_PAYMENTS_SANDBOX !== 'true') {
      return NextResponse.json({ error: 'Sandbox payments are disabled in production' }, { status: 403 });
    }
  }

  const isSandboxValid = verifyWebhookSignature({
    provider: 'sandbox',
    headers: request.headers,
    body,
  });

  if (!isSandboxValid) {
    return NextResponse.json({ error: 'Unauthorized sandbox request' }, { status: 401 });
  }

  const txId = String(body.transaction_id || `sbx-${Date.now()}`);
  const userId = String(body.user_id || '');
  const planId = String(body.plan_id || '');
  const amountUzs = Number(body.amount_uzs) || 0;

  if (!txId || !userId) {
    return NextResponse.json({ error: 'Missing user_id or transaction_id' }, { status: 422 });
  }

  // Check idempotency
  const { data: existingTx } = await admin
    .from('subscription_transactions')
    .select('id, status')
    .eq('transaction_id', txId)
    .maybeSingle();

  if (existingTx && existingTx.status === 'completed') {
    return NextResponse.json({
      success: true,
      message: 'Transaction already processed (idempotent)',
      transaction_id: txId,
    });
  }

  let plan = null;
  if (planId) {
    const { data: p } = await admin
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .maybeSingle();
    plan = p;
  }

  const planDays = plan?.duration_days || 30;
  const planName = plan?.name || 'VIP Standart';

  const { data: currentSubs } = await admin
    .from('user_subscriptions')
    .select('expires_at')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('expires_at', { ascending: false })
    .limit(1);

  const existingExpiresAt = currentSubs?.[0]?.expires_at || null;
  const { startsAt, expiresAt, isExtended } = calculateSubscriptionDates(planDays, existingExpiresAt);

  await admin.from('subscription_transactions').upsert(
    {
      transaction_id: txId,
      user_id: userId,
      plan_id: plan?.id || null,
      amount_uzs: amountUzs,
      currency: 'UZS',
      provider: 'other',
      status: 'completed',
      metadata: { webhook_body: body, isExtended },
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'transaction_id' }
  );

  await admin.from('user_subscriptions').insert({
    user_id: userId,
    plan_id: plan?.id || null,
    plan_name: planName,
    status: 'active',
    starts_at: startsAt,
    expires_at: expiresAt,
    grant_type: 'online_payment',
    notes: `Sandbox to‘lovi: TxID ${txId}`,
  });

  return NextResponse.json({
    success: true,
    transaction_id: txId,
    expires_at: expiresAt,
  });
}
