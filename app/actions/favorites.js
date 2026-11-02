'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function toggleFavorite(formData) {
  const animeId = String(formData.get('animeId'));
  const isFav = formData.get('isFav') === 'true';
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  if (isFav) {
    await supabase.from('favorites').delete().eq('user_id', user.id).eq('anime_id', animeId);
  } else {
    await supabase.from('favorites').insert({ user_id: user.id, anime_id: animeId });
  }
  revalidatePath(`/anime/${animeId}`);
  revalidatePath('/favorites');
}
