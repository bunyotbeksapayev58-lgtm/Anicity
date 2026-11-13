import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

// /watch allows guest playback for free episodes (VIP episodes gated at page level)
const PROTECTED_PATHS = ['/admin', '/assistant-admin', '/favorites', '/history', '/profile', '/settings'];
const AUTH_PAGES = ['/login', '/register', '/forgot-password', '/reset-password'];

export async function proxy(request) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, {
              ...options,
              sameSite: options?.sameSite || 'lax',
              secure: process.env.NODE_ENV === 'production' ? true : options?.secure,
            })
          );
        },
      },
    }
  );

  // Sessiyani yangilaydi, shu tufayli login doimiy saqlanadi
  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  // API o'zi 401/403 JSON qaytaradi, login sahifasiga yo'naltirmaymiz
  if (path.startsWith('/api')) return response;

  const isProtected = PROTECTED_PATHS.some((p) => path === p || path.startsWith(p + '/'));
  if (!user && isProtected) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', path);
    return NextResponse.redirect(loginUrl);
  }

  const isAuthPage = AUTH_PAGES.some((p) => path === p || path.startsWith(p + '/'));
  if (user && isAuthPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
