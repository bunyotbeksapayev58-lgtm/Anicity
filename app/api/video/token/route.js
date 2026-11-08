import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generatePlaybackToken } from '@/lib/video/provider';
import {
  validatePlaybackAccess,
  buildDeliveryConfig,
  verifyDeliveryToken,
  calculatePlaybackTokenTtl,
} from '@/lib/video/secure-delivery';
import { getCurrentSubscription } from '@/lib/subscriptions';

// POST /api/video/token — Issues an authorized time-bound playback token
export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Foydalanuvchi tizimga kirmagan (Unauthorized)' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Yaroqsiz JSON payload' }, { status: 400 });
  }

  const { episodeId } = body || {};
  if (!episodeId) {
    return NextResponse.json({ error: 'episodeId kiritilishi shart' }, { status: 422 });
  }

  // 1. Fetch user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, suspended_at')
    .eq('id', user.id)
    .maybeSingle();

  // 2. Fetch episode and anime metadata (only selects existing schema columns)
  const { data: episode, error: epErr } = await supabase
    .from('episodes')
    .select('id, anime_id, video_url, is_published, quality, animes(title)')
    .eq('id', episodeId)
    .maybeSingle();

  if (epErr || !episode) {
    return NextResponse.json({ error: 'Qism topilmadi' }, { status: 404 });
  }

  // 3. Fetch user subscriptions
  const { data: subsRaw } = await supabase
    .from('user_subscriptions')
    .select('id, plan_name, status, starts_at, expires_at')
    .eq('user_id', user.id);

  // 4. Server-Side VIP & Access Verification (Never trust frontend VIP state)
  const access = validatePlaybackAccess({
    user,
    profile,
    episode: {
      ...episode,
      requires_vip: episode?.requires_vip ?? false,
      animes: {
        ...episode?.animes,
        is_vip_only: episode?.animes?.is_vip_only ?? false,
      },
    },
    subscriptions: subsRaw || [],
  });

  if (!access.allowed) {
    const status = access.code === 'VIP_REQUIRED' ? 403
      : access.code === 'USER_SUSPENDED' ? 403
      : access.code === 'EPISODE_UNPUBLISHED' ? 404
      : 401;
    return NextResponse.json({ error: access.reason, code: access.code }, { status });
  }

  // 5. Calculate safe clamped TTL (Token expiry strictly cannot outlive subscription)
  const isVipRequired = Boolean(
    episode.requires_vip === true ||
    episode.quality === '4K' ||
    episode.animes?.is_vip_only === true
  );

  const ttlSeconds = calculatePlaybackTokenTtl({
    requestedTtl: 7200,
    subscriptionExpiresAt: access.subscriptionExpiresAt,
    isPrivileged: access.isPrivileged,
    isVipRequired,
  });

  if (isVipRequired && !access.isPrivileged && ttlSeconds <= 0) {
    return NextResponse.json({
      error: 'VIP obuna muddati tugagan (Subscription expired)',
      code: 'SUBSCRIPTION_EXPIRED',
    }, { status: 403 });
  }

  // 6. Generate signed HMAC playback token with clamped TTL
  const token = generatePlaybackToken({
    userId: user.id,
    episodeId: episode.id,
    animeId: episode.anime_id,
    isVip: access.isVip,
    ttlSeconds,
  });

  // 7. Build secure delivery config
  const delivery = buildDeliveryConfig(episode, token);

  return NextResponse.json({
    token,
    episodeId: episode.id,
    expiresIn: ttlSeconds,
    delivery,
  });
}

// GET /api/video/token?token=...&episodeId=...&userId=... — Verifies playback token
export async function GET(request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  const episodeId = url.searchParams.get('episodeId');
  const userId = url.searchParams.get('userId');
  const revalidate = url.searchParams.get('revalidate') === 'true';

  if (!token) {
    return NextResponse.json({ valid: false, reason: 'Token kiritilmagan' }, { status: 400 });
  }

  const supabase = await createClient();

  const verification = await verifyDeliveryToken({
    token,
    expectedUserId: userId,
    expectedEpisodeId: episodeId,
    revalidateSubscriptionFn: revalidate ? async (uid) => {
      const { data: subs } = await supabase
        .from('user_subscriptions')
        .select('id, status, starts_at, expires_at')
        .eq('user_id', uid);
      return Boolean(getCurrentSubscription(subs || []));
    } : null,
  });

  if (!verification.valid) {
    const status = verification.reason?.includes('expired') ? 401 : 403;
    return NextResponse.json({ valid: false, reason: verification.reason || 'Yaroqsiz token' }, { status });
  }

  return NextResponse.json({
    valid: true,
    payload: verification.payload,
  });
}
