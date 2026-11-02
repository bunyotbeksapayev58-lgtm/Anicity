import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Email tasdiqlash va parolni tiklash havolalari shu yerga qaytadi
export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') || '/';
  // Faqat ichki yo'llarga ruxsat (open redirect oldini olish)
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(safeNext, url.origin));
  }
  return NextResponse.redirect(new URL('/login?error=link', url.origin));
}
