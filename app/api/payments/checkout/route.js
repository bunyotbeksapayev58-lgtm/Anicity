import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { rateLimit, checkDistributedRateLimit } from '@/lib/rate-limit';
import { createCheckoutUrl, PAYMENT_PROVIDERS } from '@/lib/payments/provider';
import { getSiteUrl } from '@/lib/siteUrl';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    // 0. Tezkor xotiradagi Rate Limiting (Instant in-memory rate limit)
    const rl = rateLimit('payments:checkout', request.headers, 10, 60);
    if (!rl.allowed) {
      return NextResponse.json({ error: rl.error }, { status: 429 });
    }

    const supabase = await createClient();
    const reqHeaders = await headers().catch(() => null);

    // 1. Taqsimlangan Rate Limiting (Brute-force va botlardan himoya)
    const limit = await checkDistributedRateLimit('payments:checkout', reqHeaders, 10, 60, supabase);
    if (!limit.allowed) {
      return NextResponse.json({ error: limit.error }, { status: 429 });
    }

    // 2. Foydalanuvchi sessiyasini tekshirish
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'To‘lovni boshlash uchun tizimga kirishingiz lozim' }, { status: 401 });
    }

    // 3. So'rov parametrlarini o'qish va tekshirish
    const body = await request.json().catch(() => ({}));
    const planId = String(body.planId || '').trim();
    const provider = String(body.provider || '').toLowerCase().trim();

    if (!planId || !provider) {
      return NextResponse.json({ error: 'planId va provider ko‘rsatilishi shart' }, { status: 400 });
    }

    if (!Object.values(PAYMENT_PROVIDERS).includes(provider)) {
      return NextResponse.json({ error: 'Qo‘llab-quvvatlanmaydigan to‘lov tizimi' }, { status: 400 });
    }

    // Production muhitida sandbox taqiqlangan
    if (provider === PAYMENT_PROVIDERS.SANDBOX && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Sandbox to‘lovlari ishlab chiqarishda taqiqlangan' }, { status: 403 });
    }

    // 4. Tanlangan tarif rejasini bazadan olish
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('id, name, price_uzs, is_active')
      .eq('id', planId)
      .maybeSingle();

    if (planError || !plan) {
      return NextResponse.json({ error: 'Tanlangan tarif rejasi topilmadi' }, { status: 404 });
    }

    if (!plan.is_active) {
      return NextResponse.json({ error: 'Tanlangan tarif rejasi ayni vaqtda faol emas' }, { status: 400 });
    }

    // 5. Checkout URL yaratish
    const siteUrl = getSiteUrl();
    const returnUrl = `${siteUrl}/premium?payment=return&provider=${provider}&plan=${encodeURIComponent(plan.name)}`;

    const checkoutUrl = createCheckoutUrl({
      provider,
      planId: plan.id,
      planName: plan.name,
      amountUzs: Number(plan.price_uzs),
      userId: user.id,
      returnUrl,
    });

    return NextResponse.json({
      success: true,
      provider,
      planName: plan.name,
      amountUzs: Number(plan.price_uzs),
      checkoutUrl,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'To‘lov havolasini yaratishda ichki xatolik yuz berdi' },
      { status: 500 }
    );
  }
}
