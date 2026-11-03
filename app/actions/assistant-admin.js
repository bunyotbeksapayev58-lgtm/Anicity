'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { authorizeAdminOperation, requireMainAdmin } from '@/lib/admin-access';
import { driveProblem, extractDriveFileId, isDriveUrl } from '@/lib/drive';

export async function searchAssistantCandidates(search) {
  const supabase = await createClient();
  const access = await requireMainAdmin(supabase);
  if (access.error) return { error: access.error };
  const { data, error } = await supabase.rpc('main_admin_search_assistant_candidates', {
    p_search: String(search || '').trim().slice(0, 100),
  });
  if (error) return { error: 'Foydalanuvchilar qidirilmadi.' };
  return { candidates: data || [] };
}

export async function appointAssistant(formData) {
  const supabase = await createClient();
  const access = await requireMainAdmin(supabase);
  if (access.error) return { error: access.error };
  const targetId = String(formData.get('target_user_id') || '').trim();
  if (!targetId) return { error: 'Foydalanuvchini tanlang.' };
  const { error } = await supabase.rpc('main_admin_appoint_assistant', { p_target_user_id: targetId });
  if (error) return { error: 'Assistant tayinlanmadi: ' + error.message };
  revalidatePath('/admin');
  return { success: true };
}

export async function updateAssistantPermissions(formData) {
  const supabase = await createClient();
  const access = await requireMainAdmin(supabase);
  if (access.error) return { error: access.error };
  const targetId = String(formData.get('target_user_id') || '').trim();
  let permissions;
  try { permissions = JSON.parse(String(formData.get('permissions') || '')); }
  catch { return { error: 'Ruxsatlar ro‘yxati noto‘g‘ri.' }; }
  const { error } = await supabase.rpc('main_admin_set_assistant_permissions', {
    p_target_user_id: targetId,
    p_permissions: permissions,
  });
  if (error) return { error: 'Ruxsatlar saqlanmadi: ' + error.message };
  revalidatePath('/admin');
  revalidatePath('/assistant-admin');
  return { success: true };
}

export async function removeAssistant(formData) {
  const supabase = await createClient();
  const access = await requireMainAdmin(supabase);
  if (access.error) return { error: access.error };
  const targetId = String(formData.get('target_user_id') || '').trim();
  const { error } = await supabase.rpc('main_admin_remove_assistant', { p_target_user_id: targetId });
  if (error) return { error: 'Assistant olib tashlanmadi: ' + error.message };
  revalidatePath('/admin');
  revalidatePath('/assistant-admin');
  return { success: true };
}

export async function revokeAllAssistantPermissions() {
  const supabase = await createClient();
  const access = await requireMainAdmin(supabase);
  if (access.error) return { error: access.error };
  const { data, error } = await supabase.rpc('main_admin_revoke_all_assistant_permissions');
  if (error) return { error: 'Ruxsatlar bekor qilinmadi: ' + error.message };
  revalidatePath('/admin');
  revalidatePath('/assistant-admin');
  return { success: true, message: `${data || 0} ta ruxsat bekor qilindi.` };
}

export async function analyzeVideoSource(sourceUrl) {
  const supabase = await createClient();
  const access = await authorizeAdminOperation(supabase, 'video_analyze');
  if (access.error) return { error: access.error };
  const source = String(sourceUrl || '').trim();
  const issue = driveProblem(source);
  if (issue) return { error: issue };
  let parsed;
  try { parsed = new URL(source); }
  catch { return { error: 'Video manbasi URL formatida emas.' }; }
  if (!['http:', 'https:'].includes(parsed.protocol)) return { error: 'Faqat HTTP(S) manbasi tekshiriladi.' };

  const extension = parsed.pathname.match(/\.([a-z0-9]{2,5})$/i)?.[1]?.toLowerCase() || null;
  return {
    report: {
      analysisType: 'technical_source_validation',
      sourceHost: parsed.hostname,
      sourceType: isDriveUrl(source) ? 'google_drive' : 'direct_or_external',
      driveFileId: isDriveUrl(source) ? extractDriveFileId(source) : null,
      fileFormat: extension,
      durationSeconds: null,
      resolution: null,
      accessibility: 'not_checked',
      note: 'Texnik URL tekshiruvi. Masofaviy manbaga so‘rov yuborilmadi; AI kontent tahlili bajarilmaydi.',
    },
  };
}
