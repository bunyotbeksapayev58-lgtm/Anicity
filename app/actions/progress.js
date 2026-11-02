'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function toggleEpisodeCompleted(formData) {
  const animeId = String(formData.get('animeId'));
  const episodeId = String(formData.get('episodeId'));
  const currentCompleted = formData.get('completed') === 'true';

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from('watch_progress').upsert({
    user_id: user.id,
    anime_id: animeId,
    episode_id: episodeId,
    completed: !currentCompleted,
    position_sec: 0,
    duration_sec: 0,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,episode_id' });

  revalidatePath(`/watch/${animeId}`);
  revalidatePath(`/anime/${animeId}`);
  revalidatePath('/');
  revalidatePath('/history');
}
