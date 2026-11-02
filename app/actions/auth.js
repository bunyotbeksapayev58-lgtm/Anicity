'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, escapeLike } from '@/lib/supabase/admin';

const LOGIN_ERR = 'Login yoki parol noto‘g‘ri';
const SITE_URL = () => process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export async function login(prevState, formData) {
  const input = String(formData.get('login') || '').trim();
  const password = String(formData.get('password') || '');
  if (!input || !password) return { error: 'Login va parolni kiriting' };

  const supabase = await createClient();
  let email = input;

  // Username kiritilgan bo'lsa, emailni serverning o'zida topamiz (ochiq funksiya yo'q)
  if (!input.includes('@')) {
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from('profiles').select('id').ilike('username', escapeLike(input)).maybeSingle();
    if (!profile) return { error: LOGIN_ERR };
    const { data: found } = await admin.auth.admin.getUserById(profile.id);
    if (!found?.user?.email) return { error: LOGIN_ERR };
    email = found.user.email;
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: LOGIN_ERR };
  redirect('/');
}

export async function register(prevState, formData) {
  const username = String(formData.get('username') || '').trim();
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');

  if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
    return { error: 'Username 3–20 ta harf, raqam yoki _ dan iborat bo‘lsin' };
  }
  if (password.length < 6) return { error: 'Parol kamida 6 ta belgi bo‘lsin' };

  // Username band emasligini oldindan tekshiramiz (aniq xabar uchun)
  const admin = createAdminClient();
  const { data: taken } = await admin
    .from('profiles').select('id').ilike('username', escapeLike(username)).maybeSingle();
  if (taken) return { error: 'Bu username band' };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username },
      emailRedirectTo: `${SITE_URL()}/auth/callback?next=/`,
    },
  });
  if (error) return { error: error.message };

  // Email tasdiqlash yoqilgan bo'lsa sessiya bo'lmaydi
  if (!data.session) {
    return { message: 'Emailingizga tasdiqlash xati yuborildi. Tasdiqlab, keyin kiring.' };
  }
  redirect('/');
}

export async function forgotPassword(prevState, formData) {
  const email = String(formData.get('email') || '').trim();
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${SITE_URL()}/auth/callback?next=/reset-password`,
  });
  // Email mavjudligini oshkor qilmaslik uchun har doim bir xil javob
  return { message: 'Agar bu email ro‘yxatda bo‘lsa, tiklash havolasi yuborildi.' };
}

export async function resetPassword(prevState, formData) {
  const password = String(formData.get('password') || '');
  const confirm = String(formData.get('confirm') || '');
  if (password.length < 6) return { error: 'Parol kamida 6 ta belgi bo‘lsin' };
  if (password !== confirm) return { error: 'Parollar bir xil emas' };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };
  redirect('/');
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
