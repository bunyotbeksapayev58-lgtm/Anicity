import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAdminRole } from '@/lib/roles';
import { authorizeAdminOperation } from '@/lib/admin-access';

export const json = (data, status = 200) => NextResponse.json(data, { status });
export const fail = (message, status = 400, details) =>
  NextResponse.json(details ? { error: message, details } : { error: message }, { status });

export const isUuid = (s) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s));

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

// Ommaviy va ixtiyoriy sessiya konteksti: { supabase, user: User | null }
export async function getPublicContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user: user || null };
}

// Kirgan foydalanuvchini tekshiradi. Natija: { supabase, user } yoki { error: Response }
export async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: fail('Kirish kerak', 401) };
  return { supabase, user };
}

// Faqat admin yoki owner (profiles.role)
export async function requireAdmin() {
  const ctx = await requireUser();
  if (ctx.error) return ctx;
  const { data: profile } = await ctx.supabase
    .from('profiles').select('role').eq('id', ctx.user.id).single();
  if (!isAdminRole(profile?.role)) return { error: fail('Ruxsat yo‘q', 403) };
  return ctx;
}

export async function requireAdminPermission(permission) {
  const supabase = await createClient();
  const access = await authorizeAdminOperation(supabase, permission);
  if (access.error) return { error: fail(access.error, access.user ? 403 : 401) };
  return { supabase, user: access.user, role: access.role };
}
