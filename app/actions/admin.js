'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { toPlayableUrl, driveProblem } from '@/lib/drive';
import { removePosterByUrl } from '@/lib/storage';
import { isAdminRole } from '@/lib/roles';

async function assertAdmin(supabase) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Kirish kerak');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!isAdminRole(profile?.role)) throw new Error('Ruxsat yo‘q');
}

// Qismlar matnida papka havolasi yoki boshqa yaroqsiz Drive havolasi bormi
function driveErrors(text) {
  return String(text || '')
    .split('\n').map((l) => l.trim()).filter(Boolean)
    .map((l) => { const parts = l.split('|'); return (parts.length > 1 ? parts.slice(1).join('|') : parts[0]).trim(); })
    .map((url) => driveProblem(url))
    .filter(Boolean);
}

// "Nomi | havola" qatorlarini epizodlarga aylantiradi
function parseEpisodes(text, animeId) {
  return String(text || '')
    .split('\n').map((l) => l.trim()).filter(Boolean)
    .map((line, i) => {
      const parts = line.split('|');
      return {
        anime_id: animeId,
        number: i + 1,
        title: parts.length > 1 ? parts[0].trim() : `${i + 1}-qism`,
        video_url: toPlayableUrl(parts.length > 1 ? parts.slice(1).join('|') : parts[0]),
      };
    });
}

async function uploadPoster(supabase, file) {
  if (!file || typeof file === 'string' || file.size === 0) return null;
  if (file.size > 3 * 1024 * 1024) throw new Error('Poster 3 MB dan katta bo‘lmasin');
  const path = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const { error } = await supabase.storage.from('posters').upload(path, file, { contentType: file.type });
  if (error) throw new Error(error.message);
  return supabase.storage.from('posters').getPublicUrl(path).data.publicUrl;
}

export async function createAnime(prevState, formData) {
  try {
    const supabase = await createClient();
    await assertAdmin(supabase);

    const title = String(formData.get('title') || '').trim();
    if (!title) return { error: 'Nom kiritilishi shart' };
    const episodes = parseEpisodes(formData.get('episodes'), null);
    if (!episodes.length) return { error: 'Kamida bitta qism kiriting' };
    const driveIssues = driveErrors(formData.get('episodes'));
    if (driveIssues.length) return { error: driveIssues[0] };

    const posterUrl = (await uploadPoster(supabase, formData.get('poster')))
      || (String(formData.get('posterUrl') || '').trim() || null);

    const { data: anime, error } = await supabase.from('animes').insert({
      title,
      description: String(formData.get('description') || '').trim(),
      year: Number(formData.get('year')) || new Date().getFullYear(),
      status: String(formData.get('status') || 'Tugallangan'),
      genres: String(formData.get('genres') || '').split(',').map((s) => s.trim()).filter(Boolean),
      poster_url: posterUrl,
    }).select('id').single();
    if (error) return { error: error.message };

    const { error: epErr } = await supabase.from('episodes').insert(parseEpisodes(formData.get('episodes'), anime.id));
    if (epErr) {
      await supabase.from('animes').delete().eq('id', anime.id);
      return { error: epErr.message };
    }

    revalidatePath('/');
    revalidatePath('/admin');
    return { message: `“${title}” qo‘shildi ✔` };
  } catch (e) {
    return { error: e.message };
  }
}

export async function updateAnime(prevState, formData) {
  try {
    const supabase = await createClient();
    await assertAdmin(supabase);

    const id = String(formData.get('id'));
    const title = String(formData.get('title') || '').trim();
    if (!title) return { error: 'Nom kiritilishi shart' };

    const newPoster = await uploadPoster(supabase, formData.get('poster'));
    const posterUrl = newPoster || (String(formData.get('posterUrl') || '').trim() || null);

    const { error } = await supabase.from('animes').update({
      title,
      description: String(formData.get('description') || '').trim(),
      year: Number(formData.get('year')) || new Date().getFullYear(),
      status: String(formData.get('status') || 'Tugallangan'),
      genres: String(formData.get('genres') || '').split(',').map((s) => s.trim()).filter(Boolean),
      poster_url: posterUrl,
    }).eq('id', id);
    if (error) return { error: error.message };

    // Yangi poster yuklangan bo'lsa, eskisini o'chiramiz
    if (newPoster && formData.get('oldPoster')) {
      await removePosterByUrl(supabase, String(formData.get('oldPoster')));
    }

    // Qismlar matni o'zgargan bo'lsa, ro'yxatni to'liq almashtiramiz
    const episodesText = String(formData.get('episodes') || '').trim();
    if (episodesText && driveErrors(episodesText).length) {
      return { error: driveErrors(episodesText)[0] };
    }
    if (episodesText) {
      const episodes = parseEpisodes(episodesText, id);
      if (!episodes.length) return { error: 'Kamida bitta qism kerak' };
      await supabase.from('episodes').delete().eq('anime_id', id);
      const { error: epErr } = await supabase.from('episodes').insert(episodes);
      if (epErr) return { error: epErr.message };
    }

    revalidatePath('/');
    revalidatePath(`/anime/${id}`);
    revalidatePath('/admin');
    return { message: 'Saqlandi ✔' };
  } catch (e) {
    return { error: e.message };
  }
}

export async function deleteAnime(formData) {
  const supabase = await createClient();
  await assertAdmin(supabase);
  const id = String(formData.get('id'));

  const { data: anime } = await supabase.from('animes').select('poster_url').eq('id', id).single();
  await supabase.from('animes').delete().eq('id', id);
  if (anime?.poster_url) await removePosterByUrl(supabase, anime.poster_url);

  revalidatePath('/');
  revalidatePath('/admin');
}


// --- BANNER BOSHQARUVI ---

async function uploadBannerImage(supabase, file) {
  if (!file || typeof file === 'string' || file.size === 0) return null;
  if (file.size > 5 * 1024 * 1024) throw new Error('Banner rasmi 5 MB dan katta bo‘lmasin');
  const path = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const { error } = await supabase.storage.from('anime-banners').upload(path, file, { contentType: file.type });
  if (error) throw new Error(error.message);
  return supabase.storage.from('anime-banners').getPublicUrl(path).data.publicUrl;
}

export async function createBanner(prevState, formData) {
  try {
    const supabase = await createClient();
    await assertAdmin(supabase);

    const title = String(formData.get('title') || '').trim();
    if (!title) return { error: 'Banner sarlavhasi kiritilishi shart' };

    const animeId = String(formData.get('anime_id') || '').trim() || null;
    const uploadedImage = await uploadBannerImage(supabase, formData.get('image'));
    const imageUrl = uploadedImage || (String(formData.get('imageUrl') || '').trim() || null);
    if (!imageUrl) return { error: 'Banner rasmi (fayl yoki havola) kiritilishi shart' };

    const linkUrl = String(formData.get('linkUrl') || '').trim() || (animeId ? `/anime/${animeId}` : null);
    const subtitle = String(formData.get('subtitle') || '').trim();
    const sortOrder = Number(formData.get('sort_order')) || 0;
    const isActive = formData.get('is_active') === 'on' || formData.get('is_active') === 'true';

    const { error } = await supabase.from('banners').insert({
      title,
      subtitle: subtitle || null,
      image_url: imageUrl,
      link_url: linkUrl,
      anime_id: animeId,
      sort_order: sortOrder,
      is_active: isActive,
    });

    if (error) return { error: error.message };

    revalidatePath('/');
    revalidatePath('/admin');
    return { message: `Banner “${title}” muvaffaqiyatli saqlandi ✔` };
  } catch (e) {
    return { error: e.message };
  }
}

export async function deleteBanner(formData) {
  const supabase = await createClient();
  await assertAdmin(supabase);
  const id = String(formData.get('id'));
  await supabase.from('banners').delete().eq('id', id);
  revalidatePath('/');
  revalidatePath('/admin');
}

export async function toggleBannerActive(formData) {
  const supabase = await createClient();
  await assertAdmin(supabase);
  const id = String(formData.get('id'));
  const currentActive = formData.get('active') === 'true';
  await supabase.from('banners').update({ is_active: !currentActive }).eq('id', id);
  revalidatePath('/');
  revalidatePath('/admin');
}

// --- TRAILER VA CLIPS BOSHQARUVI ---

async function uploadTrailerThumb(supabase, file) {
  if (!file || typeof file === 'string' || file.size === 0) return null;
  if (file.size > 3 * 1024 * 1024) throw new Error('Muqova rasmi 3 MB dan katta bo‘lmasin');
  const path = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const { error } = await supabase.storage.from('episode-thumbnails').upload(path, file, { contentType: file.type });
  if (error) throw new Error(error.message);
  return supabase.storage.from('episode-thumbnails').getPublicUrl(path).data.publicUrl;
}

export async function createTrailer(prevState, formData) {
  try {
    const supabase = await createClient();
    await assertAdmin(supabase);

    const title = String(formData.get('title') || '').trim();
    if (!title) return { error: 'Treyler nomi kiritilishi shart' };

    const videoUrl = String(formData.get('video_url') || '').trim();
    if (!videoUrl) return { error: 'Video havolasi kiritilishi shart (YouTube yoki to‘g‘ridan-to‘g‘ri havola)' };

    const animeId = String(formData.get('anime_id') || '').trim() || null;
    const uploadedThumb = await uploadTrailerThumb(supabase, formData.get('thumbnail'));
    const thumbnailUrl = uploadedThumb || (String(formData.get('thumbnailUrl') || '').trim() || null);

    const description = String(formData.get('description') || '').trim();
    const durationText = String(formData.get('duration_text') || '').trim() || '02:00';
    const clipType = String(formData.get('clip_type') || 'trailer');
    const sortOrder = Number(formData.get('sort_order')) || 0;
    const isActive = formData.get('is_active') === 'on' || formData.get('is_active') === 'true';

    const { error } = await supabase.from('trailers').insert({
      title,
      description: description || null,
      video_url: videoUrl,
      thumbnail_url: thumbnailUrl,
      duration_text: durationText,
      clip_type: clipType,
      anime_id: animeId,
      sort_order: sortOrder,
      is_active: isActive,
    });

    if (error) return { error: error.message };

    revalidatePath('/');
    revalidatePath('/admin');
    return { message: `Treyler “${title}” qo‘shildi ✔` };
  } catch (e) {
    return { error: e.message };
  }
}

export async function deleteTrailer(formData) {
  const supabase = await createClient();
  await assertAdmin(supabase);
  const id = String(formData.get('id'));
  await supabase.from('trailers').delete().eq('id', id);
  revalidatePath('/');
  revalidatePath('/admin');
}

export async function toggleTrailerActive(formData) {
  const supabase = await createClient();
  await assertAdmin(supabase);
  const id = String(formData.get('id'));
  const currentActive = formData.get('active') === 'true';
  await supabase.from('trailers').update({ is_active: !currentActive }).eq('id', id);
  revalidatePath('/');
  revalidatePath('/admin');
}
