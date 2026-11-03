import { isAdminRole } from './roles.js';
import { canPerformAdminPermission } from './permission-policy.js';

export async function authorizeAdminOperation(supabase, permission) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, role: null, error: 'Kirish talab etiladi' };
  const { data: profile, error: profileError } = await supabase
    .from('profiles').select('role, suspended_at').eq('id', user.id).single();
  if (profileError || !profile || profile.suspended_at) {
    return { user, role: profile?.role || null, error: 'Ruxsat yo‘q' };
  }
  if (isAdminRole(profile.role)) {
    return canPerformAdminPermission(profile.role, permission, true)
      ? { user, role: profile.role, error: null }
      : { user, role: profile.role, error: 'Ruxsat yo‘q' };
  }
  if (profile.role !== 'assistant_admin' || !permission) {
    return { user, role: profile.role, error: 'Ruxsat yo‘q' };
  }
  const { data: allowed, error } = await supabase.rpc('assistant_has_permission', { p_permission: permission });
  return canPerformAdminPermission(profile.role, permission, !error && allowed === true)
    ? { user, role: profile.role, error: null }
    : { user, role: profile.role, error: 'Bu amal uchun ruxsat berilmagan' };
}

export async function requireMainAdmin(supabase) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, error: 'Kirish talab etiladi' };
  const { data: profile, error } = await supabase
    .from('profiles').select('role, suspended_at').eq('id', user.id).single();
  if (error || profile?.role !== 'owner' || profile.suspended_at) {
    return { user, error: 'Bu boshqaruv faqat asosiy admin uchun ochiq' };
  }
  return { user, error: null };
}
