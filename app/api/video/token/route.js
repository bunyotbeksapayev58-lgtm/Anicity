import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generatePlaybackToken, verifyPlaybackToken } from '@/lib/video/provider';

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

  const { episodeId, animeId } = body || {};
  if (!episodeId) {
    return NextResponse.json({ error: 'episodeId kiritilishi shart' }, { status: 422 });
  }

  // Verify episode exists and is published
  const { data: episode, error: epErr } = await supabase
    .from('episodes')
    .select('id, anime_id, video_url, is_published')
    .eq('id', episodeId)
    .maybeSingle();

  if (epErr || !episode || episode.is_published === false) {
    return NextResponse.json({ error: 'Qism topilmadi yoki e’lon qilinmagan' }, { status: 404 });
  }

  const token = generatePlaybackToken({
    userId: user.id,
    episodeId: episode.id,
    ttlSeconds: 7200, // Valid for 2 hours
  });

  return NextResponse.json({
    token,
    episodeId: episode.id,
    expiresIn: 7200,
  });
}

// GET /api/video/token?token=...&episodeId=... — Verifies playback token at streaming boundary
export async function GET(request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  const episodeId = url.searchParams.get('episodeId');

  if (!token) {
    return NextResponse.json({ valid: false, reason: 'Token kiritilmagan' }, { status: 400 });
  }

  const verification = verifyPlaybackToken(token);
  if (!verification.valid) {
    return NextResponse.json({ valid: false, reason: verification.reason || 'Yaroqsiz token' }, { status: 401 });
  }

  // Check resource binding
  if (episodeId && verification.payload?.episodeId !== episodeId) {
    return NextResponse.json({ valid: false, reason: 'Token boshqa video resursiga tegishli' }, { status: 403 });
  }

  return NextResponse.json({
    valid: true,
    payload: verification.payload,
  });
}
