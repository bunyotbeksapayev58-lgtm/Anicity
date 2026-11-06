import { json, fail } from '@/lib/api';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  PAYMENT_PROVIDERS,
  verifyWebhookSignature,
  calculateSubscriptionDates,
} from '@/lib/payments/provider';

export async function POST(request) {
  const url = new URL(request.url);
  const provider = (url.searchParams.get('provider') || 'sandbox').toLowerCase();

  let body;
  try {
    body = await request.json();
  } catch {
    return fail('Yaroqsiz JSON payload', 400);
  }

  // 1. Signature Verification
  const isValid = verifyWebhookSignature({
    provider,
    headers: request.headers,
    body,
  });

  if (!isValid && process.env.NODE_ENV === 'production') {
    return fail('Imzo mos kelmadi (Signature invalid)', 401);
  }

  const admin = createAdminClient();
  if (!admin) {
    return fail('Server konfiguratsiyasi xatosi', 500);
  }

  // 2. Extract transaction identifiers based on provider
  let txId = '';
  let userId = '';
  let planId = '';
  let amountUzs = 0;

  if (provider === PAYMENT_PROVIDERS.CLICK) {
    txId = String(body.click_trans_id || '');
    userId = String(body.merchant_trans_id || '');
    planId = String(body.additional_param3 || '');
    amountUzs = Number(body.amount) || 0;
  } else if (provider === PAYMENT_PROVIDERS.PAYME) {
    txId = String(body.params?.id || body.id || '');
    userId = String(body.params?.account?.user_id || '');
    planId = String(body.params?.account?.plan_id || '');
    amountUzs = Math.round((Number(body.params?.amount) || 0) / 100);
  } else {
    // Sandbox / Generic
    txId = String(body.transaction_id || `sbx-${Date.now()}`);
    userId = String(body.user_id || '');
    planId = String(body.plan_id || '');
    amountUzs = Number(body.amount_uzs) || 0;
  }

  if (!txId || !userId) {
    return fail('Tranzaksiya ma’lumotlari yetarli emas', 422);
  }

  // 3. Idempotency Check: Don't double process already completed transactions
  const { data: existingTx } = await admin
    .from('subscription_transactions')
    .select('id, status')
    .eq('transaction_id', txId)
    .maybeSingle();

  if (existingTx && existingTx.status === 'completed') {
    return json({
      success: true,
      message: 'Tranzaksiya avval bajarilgan (idempotent)',
      transaction_id: txId,
    });
  }

  // 4. Retrieve plan details
  let plan = null;
  if (planId) {
    const { data: p } = await admin
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .maybeSingle();
    plan = p;
  }

  // Fallback to active 30-day plan if specific plan not found
  if (!plan) {
    const { data: defaultPlan } = await admin
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('price_uzs', { ascending: true })
      .limit(1)
      .maybeSingle();
    plan = defaultPlan || { id: null, name: 'VIP Standart', duration_days: 30 };
  }

  // 5. Check if user currently has an active subscription to extend
  const { data: currentSubs } = await admin
    .from('user_subscriptions')
    .select('expires_at')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('expires_at', { ascending: false })
    .limit(1);

  const existingExpiresAt = currentSubs?.[0]?.expires_at || null;
  const { startsAt, expiresAt, isExtended } = calculateSubscriptionDates(
    plan.duration_days || 30,
    existingExpiresAt
  );

  // 6. Record or update transaction as completed
  await admin.from('subscription_transactions').upsert(
    {
      transaction_id: txId,
      user_id: userId,
      plan_id: plan.id,
      amount_uzs: amountUzs,
      currency: 'UZS',
      provider: provider === PAYMENT_PROVIDERS.CLICK ? 'click' : provider === PAYMENT_PROVIDERS.PAYME ? 'payme' : 'other',
      status: 'completed',
      metadata: { webhook_body: body, extended: isExtended },
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'transaction_id' }
  );

  // 7. Insert active user subscription
  const { data: newSub, error: subError } = await admin
    .from('user_subscriptions')
    .insert({
      user_id: userId,
      plan_id: plan.id,
      plan_name: plan.name,
      status: 'active',
      starts_at: startsAt,
      expires_at: expiresAt,
      grant_type: 'online_payment',
      notes: `To‘lov tizimi: ${provider.toUpperCase()}, TxID: ${txId}`,
    })
    .select()
    .single();

  if (subError) {
    return fail(`Obunani faollashtirishda xatolik: ${subError.message}`, 500);
  }

  // 8. Log audit trail
  await admin.from('subscription_audit_logs').insert({
    user_id: userId,
    action: isExtended ? 'extend' : 'grant',
    previous_plan: currentSubs?.[0]?.plan_name || null,
    previous_expires_at: existingExpiresAt,
    new_plan: plan.name,
    new_expires_at: expiresAt,
    reason: `Avtomatik to‘lov orqali faollashtirildi (${provider.toUpperCase()})`,
  });

  return json({
    success: true,
    transaction_id: txId,
    subscription_id: newSub?.id,
    expires_at: expiresAt,
  });
}
