'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, escapeLike } from '@/lib/supabase/admin';
import { getSiteUrl } from '@/lib/siteUrl';
import { rateLimit, checkDistributedRateLimit } from '@/lib/rate-limit';

const LOGIN_ERR = 'Login yoki parol noto‘g‘ri';

export async function login(prevState, formData) {
  const reqHeaders = await headers().catch(() => null);
  const supabase = await createClient();
  const limit = await checkDistributedRateLimit('auth:login', reqHeaders, 5, 60, supabase);
  if (!limit.allowed) return { error: limit.error };

  const input = String(formData.get('login') || '').trim();
  const password = String(formData.get('password') || '');
  if (!input || !password) return { error: 'Login va parolni kiriting' };

  let email = input;

  // Username kiritilgan bo'lsa, emailni serverning o'zida topamiz
  if (!input.includes('@')) {
    const admin = createAdminClient();
    if (!admin) {
      return { error: 'Username orqali kirish server kalitini talab qiladi. Iltimos, ro‘yxatdan o‘tgan emailingiz bilan kiring (masalan: misol@gmail.com)' };
    }
    const { data: profile } = await admin
      .from('profiles').select('id').ilike('username', escapeLike(input)).maybeSingle();
    if (!profile) return { error: LOGIN_ERR };
    const { data: found } = await admin.auth.admin.getUserById(profile.id);
    if (!found?.user?.email) return { error: LOGIN_ERR };
    email = found.user.email;
  }

  const next = String(formData.get('next') || '/');
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/';

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const msg = String(error.message || '').toLowerCase();
    if (msg.includes('email not confirmed') || msg.includes('not confirmed')) {
      return {
        error: 'Emailingiz hali tasdiqlanmagan. Iltimos, emailingizga yuborilgan tasdiqlash havolasini bosing.',
      };
    }
    return { error: LOGIN_ERR };
  }
  redirect(safeNext);
}

export async function register(prevState, formData) {
  const reqHeaders = await headers().catch(() => null);
  const supabase = await createClient();
  const limit = await checkDistributedRateLimit('auth:register', reqHeaders, 3, 60, supabase);
  if (!limit.allowed) return { error: limit.error };

  const username = String(formData.get('username') || '').trim();
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');

  if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
    return { error: 'Username 3–20 ta harf, raqam yoki _ dan iborat bo‘lsin' };
  }
  if (password.length < 6) return { error: 'Parol kamida 6 ta belgi bo‘lsin' };

  // Username band emasligini oldindan tekshiramiz (agar admin client mavjud bo'lsa)
  const admin = createAdminClient();
  if (admin) {
    const { data: taken } = await admin
      .from('profiles').select('id').ilike('username', escapeLike(username)).maybeSingle();
    if (taken) return { error: 'Bu username band' };
  }

  const next = String(formData.get('next') || '/');
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/';

  const siteUrl = getSiteUrl();
  const emailRedirectTo = `${siteUrl}/auth/callback?next=${encodeURIComponent(safeNext)}`;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username },
      emailRedirectTo,
    },
  });
  if (error) {
    const msg = String(error.message || '');
    if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('user already exists')) {
      return { error: 'Ushbu email bilan allaqachon ro‘yxatdan o‘tilgan' };
    }
    return { error: error.message };
  }

  // Email tasdiqlash yoqilgan bo'lsa sessiya bo'lmaydi
  if (!data.session) {
    return {
      message: 'Emailingizga tasdiqlash havolasi yuborildi. Iltimos, pochtangizni tekshirib, havolani tasdiqlang.',
    };
  }
  redirect(safeNext);
}

export async function forgotPassword(prevState, formData) {
  const reqHeaders = await headers().catch(() => null);
  const supabase = await createClient();
  const limit = await checkDistributedRateLimit('auth:forgot', reqHeaders, 3, 60, supabase);
  if (!limit.allowed) return { error: limit.error };

  const email = String(formData.get('email') || '').trim();
  const siteUrl = getSiteUrl();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/callback?next=/reset-password`,
  });
  // Email mavjudligini oshkor qilmaslik uchun har doim bir xil javob
  return { message: 'Agar bu email ro‘yxatda bo‘lsa, tiklash havolasi yuborildi.' };
}

export async function resetPassword(prevState, formData) {
  const reqHeaders = await headers().catch(() => null);
  const supabase = await createClient();
  const limit = await checkDistributedRateLimit('auth:reset', reqHeaders, 5, 60, supabase);
  if (!limit.allowed) return { error: limit.error };

  const password = String(formData.get('password') || '');
  const confirm = String(formData.get('confirm') || '');
  if (password.length < 6) return { error: 'Parol kamida 6 ta belgi bo‘lsin' };
  if (password !== confirm) return { error: 'Parollar bir xil emas' };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };
  redirect('/');
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
