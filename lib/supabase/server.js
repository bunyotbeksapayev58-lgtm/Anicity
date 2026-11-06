import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, {
                ...options,
                sameSite: options?.sameSite || 'lax',
                secure: process.env.NODE_ENV === 'production' ? true : options?.secure,
              })
            );
          } catch {
            // Server Component ichida cookie yozib bo'lmaydi; middleware yangilaydi
          }
        },
      },
    }
  );
}
