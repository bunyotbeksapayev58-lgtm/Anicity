'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getOwnedAvatarPath, validateProfileImage, isSafeAvatarUrl } from '@/lib/profile-image';

export async function updateOwnProfile(_previousState, formData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Profilni o‘zgartirish uchun tizimga kiring.' };

  const displayNameInput = String(formData.get('display_name') || '').trim();
  if (displayNameInput.length > 80) return { error: 'Ism 80 belgidan oshmasligi kerak.' };
  const displayName = displayNameInput || null;
  const avatarAction = formData.get('avatarAction') === 'remove' ? 'remove' : 'save';
  const file = formData.get('avatar');

  const { data: currentProfile, error: profileReadError } = await supabase
    .from('profiles').select('avatar_url').eq('id', user.id).single();
  if (profileReadError || !currentProfile) return { error: 'Profil ma’lumotlari topilmadi.' };

  let nextAvatarUrl = currentProfile.avatar_url || null;
  if (nextAvatarUrl && !isSafeAvatarUrl(nextAvatarUrl, user.id)) {
    nextAvatarUrl = null;
  }

  let uploadedPath = null;
  if (avatarAction === 'remove') {
    nextAvatarUrl = null;
  } else if (file && typeof file !== 'string' && file.size > 0) {
    const validated = await validateProfileImage(file);
    if (validated.error) return { error: validated.error };
    uploadedPath = `${user.id}/${randomUUID()}.${validated.extension}`;
    const { error: uploadError } = await supabase.storage.from('profile-avatars').upload(uploadedPath, validated.bytes, {
      contentType: validated.contentType,
      upsert: false,
    });
    if (uploadError) return { error: `Rasm yuklanmadi: ${uploadError.message}` };
    nextAvatarUrl = supabase.storage.from('profile-avatars').getPublicUrl(uploadedPath).data?.publicUrl || null;
    if (!nextAvatarUrl || !isSafeAvatarUrl(nextAvatarUrl, user.id)) {
      await supabase.storage.from('profile-avatars').remove([uploadedPath]);
      return { error: 'Yuklangan rasm manzili yaroqsiz.' };
    }
  }

  if (!isSafeAvatarUrl(nextAvatarUrl, user.id)) {
    if (uploadedPath) await supabase.storage.from('profile-avatars').remove([uploadedPath]);
    return { error: 'Rasm manzili xavfsizlik talablariga javob bermaydi.' };
  }

  const { error: updateError } = await supabase.from('profiles').update({
    display_name: displayName,
    avatar_url: nextAvatarUrl,
  }).eq('id', user.id);

  if (updateError) {
    if (uploadedPath) await supabase.storage.from('profile-avatars').remove([uploadedPath]);
    return { error: 'Profil saqlanmadi: ' + updateError.message };
  }

  const previousPath = getOwnedAvatarPath(currentProfile.avatar_url, user.id);
  if (previousPath && previousPath !== uploadedPath && nextAvatarUrl !== currentProfile.avatar_url) {
    await supabase.storage.from('profile-avatars').remove([previousPath]);
  }

  revalidatePath('/profile');
  revalidatePath('/', 'layout');
  return { success: true, message: 'Profilingiz yangilandi.' };
}
