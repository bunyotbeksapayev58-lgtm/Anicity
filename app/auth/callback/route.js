import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSiteUrl } from '@/lib/siteUrl';

function getSafeNext(next, fallback = '/') {
  if (!next || typeof next !== 'string') return fallback;
  const trimmed = next.trim();
  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.startsWith('/\\')) {
    return trimmed;
  }
  return fallback;
}

// Email tasdiqlash, parolni tiklash va OAuth havolalari shu yerga keladi
export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const token_hash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');
  const errorParam = url.searchParams.get('error') || url.searchParams.get('error_description');

  // Origin'ni xavfsiz aniqlaymiz (x-forwarded headers yoki canonical production domain)
  const origin = getSiteUrl(request.headers);

  // Supabase xato bilan qaytargan bo'lsa (masalan havola muddati tugagan yoki OAuth bekor qilingan)
  if (errorParam) {
    console.error('[Auth Callback] Provider error:', errorParam);
    const isOAuth = url.searchParams.get('error') === 'access_denied' ||
      String(errorParam).toLowerCase().includes('oauth') ||
      String(errorParam).toLowerCase().includes('denied');
    return NextResponse.redirect(new URL(isOAuth ? '/login?error=oauth' : '/login?error=link', origin));
  }

  // Qaytish yo'li: agar parolni tiklash bo'lsa /reset-password ga yo'naltiramiz
  const defaultNext = type === 'recovery' ? '/reset-password' : '/';
  const safeNext = getSafeNext(url.searchParams.get('next'), defaultNext);

  const supabase = await createClient();

  // 1. PKCE flow (OAuth va PKCE email tasdiqlash)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(safeNext, origin));
    }
    console.error('[Auth Callback] exchangeCodeForSession error:', error.message);
  }

  // 2. Token hash OTP flow (Email verification / recovery token hash)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });
    if (!error) {
      return NextResponse.redirect(new URL(safeNext, origin));
    }
    console.error('[Auth Callback] verifyOtp error:', error.message);
  }

  // 3. Agar foydalanuvchi allaqachon tizimga kirgan bo'lsa (masalan brauzerda avvaldan faol sessiya bor)
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    return NextResponse.redirect(new URL(safeNext, origin));
  }

  // Agar hech biri mos kelmasa yoki xatolik yuz bersa
  return NextResponse.redirect(new URL('/login?error=link', origin));
}
