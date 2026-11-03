'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { toPlayableUrl, driveProblem } from '@/lib/drive';
import { removePosterByUrl, removeFileByUrl, uploadImageToBucket, uploadMediaToBucket, validateImageFile, validateVideoFile } from '@/lib/storage';
import { validateSingleEpisode, validateAnime } from '@/lib/validate';
import { authorizeAdminOperation } from '@/lib/admin-access';
import { logAssistantContentFailure } from '@/lib/assistant-audit';

async function assertAdmin(supabase, permission = null) {
  const access = await authorizeAdminOperation(supabase, permission);
  if (access.error) throw new Error(access.error);
  return { user: access.user, role: access.role };
}

// Qismlar matnida papka havolasi yoki boshqa yaroqsiz Drive havolasi bormi (ommaviy import uchun)
function driveErrors(text) {
  return String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const parts = l.split('|');
      return (parts.length > 1 ? parts.slice(1).join('|') : parts[0]).trim();
    })
    .map((url) => driveProblem(url))
    .filter(Boolean);
}

// "Nomi | havola" qatorlarini epizodlarga aylantiradi (agar mavjud bo'lsa)
function parseEpisodes(text, animeId) {
  return String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line, i) => {
      const parts = line.split('|');
      return {
        anime_id: animeId,
        season_number: 1,
        number: i + 1,
        title: parts.length > 1 ? parts[0].trim() : `${i + 1}-qism`,
        video_url: toPlayableUrl(parts.length > 1 ? parts.slice(1).join('|') : parts[0]),
        is_published: true,
      };
    });
}

// ==========================================
// 1. ANIME YARATISH VA TAHRIRLASH
// ==========================================

export async function createAnime(prevState, formData) {
  try {
    const supabase = await createClient();
    const actor = await assertAdmin(supabase, 'anime_create');

    const title = String(formData.get('title') || '').trim();
    if (!title) return { error: 'Anime nomi kiritilishi shart' };
    if (actor.role === 'assistant_admin' && (formData.get('poster')?.size > 0 || formData.get('banner')?.size > 0)) {
      return { error: 'Assistantlar rasm faylini yuklay olmaydi. Poster va banner uchun URL manzilidan foydalaning.' };
    }

    // Kompyuterdan poster va banner yuklash (maks 5MB)
    let posterUrl = null;
    let bannerUrl = null;

    try {
      posterUrl = await uploadImageToBucket(supabase, formData.get('poster'), 'posters', { maxSizeMB: 5 });
    } catch (uploadErr) {
      return { error: `Poster yuklashda xatolik: ${uploadErr.message}` };
    }
    if (!posterUrl) {
      posterUrl = String(formData.get('posterUrl') || '').trim() || null;
    }

    try {
      bannerUrl = await uploadImageToBucket(supabase, formData.get('banner'), 'anime-banners', { maxSizeMB: 5 });
    } catch (bannerErr) {
      await removeFileByUrl(supabase, 'posters', posterUrl);
      return { error: `Banner yuklashda xatolik: ${bannerErr.message}` };
    }
    if (!bannerUrl) {
      bannerUrl = String(formData.get('bannerUrl') || '').trim() || null;
    }

    const altTitle = String(formData.get('alt_title') || '').trim() || null;
    const description = String(formData.get('description') || '').trim();
    const year = Number(formData.get('year')) || new Date().getFullYear();
    const status = String(formData.get('status') || 'Davom etmoqda');
    const ageRating = String(formData.get('age_rating') || '12+');
    const studio = String(formData.get('studio') || '').trim() || null;
    const director = String(formData.get('director') || '').trim() || null;
    const releaseDay = String(formData.get('releaseDay') || '').trim().toLowerCase() || null;
    const fandubTeam = String(formData.get('fandubTeam') || 'Anicity Dub').trim();
    const isFeatured = formData.get('is_featured') === 'on' || formData.get('is_featured') === 'true';
    const isPublished = formData.get('is_published') !== 'false' && formData.get('is_published') !== 'draft';

    const rawGenres = String(formData.get('genres') || '');
    const genres = rawGenres
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const episodesRaw = formData.get('episodes');
    let episodes = [];
    if (episodesRaw && String(episodesRaw).trim()) {
      if (actor.role === 'assistant_admin') {
        const [episodeAccess, videoAccess] = await Promise.all([
          authorizeAdminOperation(supabase, 'episode_create'),
          authorizeAdminOperation(supabase, 'video_upload'),
        ]);
        if (episodeAccess.error || videoAccess.error) return { error: 'Boshlang‘ich qism uchun episode_create va video_upload ruxsatlari kerak.' };
      }
      const driveIssues = driveErrors(episodesRaw);
      if (driveIssues.length) {
        await Promise.all([
          removeFileByUrl(supabase, 'posters', posterUrl),
          removeFileByUrl(supabase, 'anime-banners', bannerUrl),
        ]);
        return { error: 'Qism havolasi noto‘g‘ri: ' + driveIssues[0] };
      }
      episodes = parseEpisodes(episodesRaw, null);
    }

    const rpcName = actor.role === 'assistant_admin' ? 'assistant_create_anime_with_episodes' : 'admin_create_anime_with_episodes';
    const { data: anime, error: animeErr } = await supabase.rpc(rpcName, {
      p_anime: {
        title, alt_title: altTitle, description, year, status, age_rating: ageRating, genres,
        studio, director, poster_url: posterUrl, banner_url: bannerUrl,
        is_featured: isFeatured, is_published: actor.role === 'assistant_admin' ? false : isPublished, release_day: releaseDay, fandub_team: fandubTeam,
      },
      p_episodes: episodes,
    });
    if (animeErr || !anime) {
      if (actor.role === 'assistant_admin') await logAssistantContentFailure(supabase, 'anime_create', null, null);
      await Promise.all([
        removeFileByUrl(supabase, 'posters', posterUrl),
        removeFileByUrl(supabase, 'anime-banners', bannerUrl),
      ]);
      return { error: 'Bazada saqlashda xatolik: ' + (animeErr?.message || 'Javob olinmadi') };
    }

    revalidatePath('/');
    revalidatePath('/admin');
    revalidatePath('/catalog');

    return {
      success: true,
      animeId: anime.id,
      animeTitle: anime.title,
      message: `“${title}” muvaffaqiyatli saqlandi ✔ Endi qismlarni qo‘shishingiz mumkin.`,
    };
  } catch (e) {
    return { error: e.message || 'Kutilmagan xatolik yuz berdi' };
  }
}

export async function updateAnime(prevState, formData) {
  try {
    const supabase = await createClient();
    const actor = await assertAdmin(supabase, 'anime_edit');

    const id = String(formData.get('id') || '').trim();
    if (!id) return { error: 'Anime ID si topilmadi' };

    const title = String(formData.get('title') || '').trim();
    if (!title) return { error: 'Anime nomi kiritilishi shart' };
    if (actor.role === 'assistant_admin' && (formData.get('poster')?.size > 0 || formData.get('banner')?.size > 0)) {
      return { error: 'Assistantlar rasm faylini yuklay olmaydi. Rasm URL manzilidan foydalaning.' };
    }

    // Yangi rasm yuklangan bo'lsa
    let posterUrl = null;
    let bannerUrl = null;

    try {
      posterUrl = await uploadImageToBucket(supabase, formData.get('poster'), 'posters', { maxSizeMB: 5 });
    } catch (uploadErr) {
      return { error: `Poster yuklashda xatolik: ${uploadErr.message}` };
    }
    if (!posterUrl) {
      posterUrl = String(formData.get('posterUrl') || '').trim() || null;
    }

    try {
      bannerUrl = await uploadImageToBucket(supabase, formData.get('banner'), 'anime-banners', { maxSizeMB: 5 });
    } catch (bannerErr) {
      return { error: `Banner yuklashda xatolik: ${bannerErr.message}` };
    }
    if (!bannerUrl) {
      bannerUrl = String(formData.get('bannerUrl') || '').trim() || null;
    }

    const altTitle = String(formData.get('alt_title') || '').trim() || null;
    const description = String(formData.get('description') || '').trim();
    const year = Number(formData.get('year')) || new Date().getFullYear();
    const status = String(formData.get('status') || 'Davom etmoqda');
    const ageRating = String(formData.get('age_rating') || '12+');
    const studio = String(formData.get('studio') || '').trim() || null;
    const director = String(formData.get('director') || '').trim() || null;
    const releaseDay = String(formData.get('releaseDay') || '').trim().toLowerCase() || null;
    const fandubTeam = String(formData.get('fandubTeam') || 'Anicity Dub').trim();
    const isFeatured = formData.get('is_featured') === 'on' || formData.get('is_featured') === 'true';
    const isPublished = formData.get('is_published') !== 'false' && formData.get('is_published') !== 'draft';

    const rawGenres = String(formData.get('genres') || '');
    const genres = rawGenres
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const updatePayload = {
      title,
      alt_title: altTitle,
      description,
      year,
      status,
      age_rating: ageRating,
      genres,
      studio,
      director,
      is_featured: isFeatured,
      is_published: isPublished,
      release_day: releaseDay,
      fandub_team: fandubTeam,
    };

    if (posterUrl) updatePayload.poster_url = posterUrl;
    if (bannerUrl) updatePayload.banner_url = bannerUrl;
    if (actor.role === 'assistant_admin') delete updatePayload.is_published;

    const { error } = await supabase.from('animes').update(updatePayload).eq('id', id);
    if (error) {
      if (actor.role === 'assistant_admin') await logAssistantContentFailure(supabase, 'anime_update', id);
      return { error: error.message };
    }

    // Agar yangi poster yuklangan bo'lsa va eskisi bo'lsa
    if (posterUrl && formData.get('oldPoster')) {
      await removePosterByUrl(supabase, String(formData.get('oldPoster')));
    }

    revalidatePath('/');
    revalidatePath(`/anime/${id}`);
    revalidatePath('/admin');
    revalidatePath('/catalog');

    return { success: true, message: `“${title}” ma’lumotlari muvaffaqiyatli saqlandi ✔` };
  } catch (e) {
    return { error: e.message || 'Kutilmagan xatolik yuz berdi' };
  }
}

export async function deleteAnime(formData) {
  const supabase = await createClient();
  const actor = await assertAdmin(supabase, 'anime_delete');
  const id = String(formData.get('id'));

  const { data: anime } = await supabase.from('animes').select('poster_url').eq('id', id).single();
  const { error } = await supabase.from('animes').delete().eq('id', id);
  if (error && actor.role === 'assistant_admin') await logAssistantContentFailure(supabase, 'anime_delete', id);
  if (error) throw new Error(error.message);
  if (actor.role !== 'assistant_admin' && anime?.poster_url) await removePosterByUrl(supabase, anime.poster_url);

  revalidatePath('/');
  revalidatePath('/admin');
  revalidatePath('/catalog');
}

// ==========================================
// 2. MUSTAQIL QISMLAR (EPISODES) BOSHQARUVI
// ==========================================

export async function createEpisode(prevState, formData) {
  try {
    const supabase = await createClient();
    const actor = await assertAdmin(supabase, 'episode_create');

    const animeId = String(formData.get('anime_id') || '').trim();
    if (!animeId) return { error: 'Anime tanlanishi shart' };

    const seasonNumber = parseInt(formData.get('season_number') || '1', 10) || 1;
    const episodeNumber = parseInt(formData.get('number'), 10);
    if (!episodeNumber || episodeNumber < 1) {
      return { error: 'Qism raqami 1 yoki undan katta musbat son bo‘lishi kerak' };
    }

    const videoUrlRaw = String(formData.get('video_url') || '').trim();
    if (!videoUrlRaw) {
      return { error: 'Google Drive yoki to‘g‘ridan-to‘g‘ri video havolasini kiriting' };
    }

    // Google Drive URL formati va papka tekshiruvi
    const driveIssue = driveProblem(videoUrlRaw);
    if (driveIssue) {
      return { error: driveIssue };
    }
    if (actor.role === 'assistant_admin') {
      const videoAccess = await authorizeAdminOperation(supabase, 'video_upload');
      if (videoAccess.error) return { error: 'Video manbasini qo‘shish uchun video_upload ruxsati kerak.' };
      if (formData.get('thumbnail')?.size > 0) return { error: 'Assistantlar qism muqovasini URL orqali kiritishi mumkin.' };
    }
    const playableUrl = toPlayableUrl(videoUrlRaw);

    // Bir fasl ichida takroriy qism raqamini tekshirish (Duplicate check)
    const { data: duplicate } = await supabase
      .from('episodes')
      .select('id, number')
      .eq('anime_id', animeId)
      .eq('season_number', seasonNumber)
      .eq('number', episodeNumber)
      .maybeSingle();

    if (duplicate) {
      return {
        error: `${seasonNumber}-faslda ${episodeNumber}-raqamli qism allaqachon mavjud! Boshqa qism raqamini kiriting yoki mavjud qismni tahrirlang.`,
      };
    }

    // Muqova rasmi (thumbnail) yuklash
    let thumbnailUrl = null;
    try {
      thumbnailUrl = await uploadImageToBucket(supabase, formData.get('thumbnail'), 'episode-thumbnails', { maxSizeMB: 5 });
    } catch (uploadErr) {
      return { error: `Muqova yuklashda xatolik: ${uploadErr.message}` };
    }
    if (!thumbnailUrl) {
      thumbnailUrl = String(formData.get('thumbnail_url') || '').trim() || null;
    }

    const title = String(formData.get('title') || '').trim() || `${episodeNumber}-qism`;
    const description = String(formData.get('description') || '').trim() || null;
    const quality = String(formData.get('quality') || '1080p').trim();
    const isPublished = formData.get('is_published') !== 'false' && formData.get('is_published') !== 'off';

    const { data: newEp, error: insertErr } = await supabase
      .from('episodes')
      .insert({
        anime_id: animeId,
        season_number: seasonNumber,
        number: episodeNumber,
        title,
        description,
        video_url: playableUrl,
        thumbnail_url: thumbnailUrl,
        quality,
        is_published: actor.role === 'assistant_admin' ? false : isPublished,
      })
      .select('id, number, title')
      .single();

    if (insertErr) {
      if (actor.role === 'assistant_admin') await logAssistantContentFailure(supabase, 'episode_create', null, animeId);
      return { error: `Qismni saqlashda xatolik: ${insertErr.message}` };
    }

    revalidatePath('/');
    revalidatePath('/admin');
    revalidatePath(`/anime/${animeId}`);

    return {
      success: true,
      episodeId: newEp.id,
      message: `${seasonNumber}-fasl, ${episodeNumber}-qism muvaffaqiyatli qo‘shildi ✔`,
    };
  } catch (e) {
    return { error: e.message || 'Qism qo‘shishda kutilmagan xatolik yuz berdi' };
  }
}

export async function updateEpisode(prevState, formData) {
  try {
    const supabase = await createClient();
    const actor = await assertAdmin(supabase, 'episode_edit');

    const episodeId = String(formData.get('episode_id') || '').trim();
    const animeId = String(formData.get('anime_id') || '').trim();
    if (!episodeId) return { error: 'Qism ID topilmadi' };

    const seasonNumber = parseInt(formData.get('season_number') || '1', 10) || 1;
    const episodeNumber = parseInt(formData.get('number'), 10);
    if (!episodeNumber || episodeNumber < 1) {
      return { error: 'Qism raqami musbat son bo‘lishi kerak' };
    }

    const videoUrlRaw = String(formData.get('video_url') || '').trim();
    if (!videoUrlRaw) return { error: 'Video havolasi kiritilishi shart' };

    const driveIssue = driveProblem(videoUrlRaw);
    if (driveIssue) return { error: driveIssue };
    if (actor.role === 'assistant_admin' && formData.get('thumbnail')?.size > 0) {
      return { error: 'Assistantlar qism muqovasini URL orqali kiritishi mumkin.' };
    }
    const playableUrl = toPlayableUrl(videoUrlRaw);

    // Agar raqam o'zgartirilayotgan bo'lsa, boshqa qism bilan to'qnashuvni tekshirish
    if (animeId) {
      const { data: duplicate } = await supabase
        .from('episodes')
        .select('id')
        .eq('anime_id', animeId)
        .eq('season_number', seasonNumber)
        .eq('number', episodeNumber)
        .neq('id', episodeId)
        .maybeSingle();

      if (duplicate) {
        return {
          error: `${seasonNumber}-faslda ${episodeNumber}-raqamli qism allaqachon mavjud! Boshqa raqam tanlang.`,
        };
      }
    }

    let thumbnailUrl = null;
    try {
      thumbnailUrl = await uploadImageToBucket(supabase, formData.get('thumbnail'), 'episode-thumbnails', { maxSizeMB: 5 });
    } catch (uploadErr) {
      return { error: `Muqova yuklashda xatolik: ${uploadErr.message}` };
    }
    if (!thumbnailUrl) {
      thumbnailUrl = String(formData.get('thumbnail_url') || '').trim() || null;
    }

    const title = String(formData.get('title') || '').trim() || `${episodeNumber}-qism`;
    const description = String(formData.get('description') || '').trim() || null;
    const quality = String(formData.get('quality') || '1080p').trim();
    const isPublished = formData.get('is_published') !== 'false' && formData.get('is_published') !== 'off';

    const updatePayload = {
      season_number: seasonNumber,
      number: episodeNumber,
      title,
      description,
      video_url: playableUrl,
      quality,
      is_published: isPublished,
    };
    if (thumbnailUrl) {
      updatePayload.thumbnail_url = thumbnailUrl;
    }

    const { error: updateErr } = await supabase.from('episodes').update(updatePayload).eq('id', episodeId);
    if (updateErr) {
      if (actor.role === 'assistant_admin') await logAssistantContentFailure(supabase, 'episode_update', episodeId, animeId);
      return { error: updateErr.message };
    }

    revalidatePath('/');
    revalidatePath('/admin');
    if (animeId) revalidatePath(`/anime/${animeId}`);

    return { success: true, message: `${episodeNumber}-qism muvaffaqiyatli yangilandi ✔` };
  } catch (e) {
    return { error: e.message || 'Qismni yangilashda xatolik yuz berdi' };
  }
}

export async function deleteEpisode(formData) {
  try {
    const supabase = await createClient();
    const actor = await assertAdmin(supabase, 'episode_delete');

    const episodeId = String(formData.get('episode_id') || '').trim();
    const animeId = String(formData.get('anime_id') || '').trim();
    if (!episodeId) throw new Error('Qism ID si topilmadi');

    const { error } = await supabase.from('episodes').delete().eq('id', episodeId);
    if (error) {
      if (actor.role === 'assistant_admin') await logAssistantContentFailure(supabase, 'episode_delete', episodeId, animeId);
      throw new Error(error.message);
    }

    revalidatePath('/');
    revalidatePath('/admin');
    if (animeId) revalidatePath(`/anime/${animeId}`);

    return { success: true };
  } catch (e) {
    throw new Error(e.message);
  }
}

export async function toggleEpisodePublished(formData) {
  const supabase = await createClient();
  await assertAdmin(supabase);

  const episodeId = String(formData.get('episode_id') || '').trim();
  const currentStatus = formData.get('current_status') === 'true';
  const animeId = String(formData.get('anime_id') || '').trim();

  await supabase.from('episodes').update({ is_published: !currentStatus }).eq('id', episodeId);

  revalidatePath('/');
  revalidatePath('/admin');
  if (animeId) revalidatePath(`/anime/${animeId}`);
}

// ==========================================
// 3. BANNER BOSHQARUVI
// ==========================================

export async function createBanner(prevState, formData) {
  try {
    const supabase = await createClient();
    await assertAdmin(supabase);

    const title = String(formData.get('title') || '').trim();
    if (!title) return { error: 'Banner sarlavhasi kiritilishi shart' };

    const animeId = String(formData.get('anime_id') || '').trim() || null;

    // 1. Video upload or URL
    let videoUrl = String(formData.get('videoUrl') || '').trim() || null;
    const videoFile = formData.get('video');
    if (videoFile && typeof videoFile !== 'string' && videoFile.size > 0) {
      try {
        videoUrl = await uploadMediaToBucket(supabase, videoFile, 'anime-banners', { maxSizeMB: 50 });
      } catch (vidErr) {
        return { error: `Video banner yuklashda xatolik: ${vidErr.message}` };
      }
    }

    // 2. Image upload or URL
    let imageUrl = null;
    const imgFile = formData.get('image');
    if (imgFile && typeof imgFile !== 'string' && imgFile.size > 0) {
      try {
        imageUrl = await uploadMediaToBucket(supabase, imgFile, 'anime-banners', { maxSizeMB: 10 });
      } catch (bannerErr) {
        return { error: `Banner rasmi yuklashda xatolik: ${bannerErr.message}` };
      }
    }
    if (!imageUrl) {
      imageUrl = String(formData.get('imageUrl') || '').trim() || null;
    }

    // Banner must have either image or video
    if (!imageUrl && !videoUrl) {
      return { error: 'Banner rasmi yoki video banner (fayl yoki havola) kiritilishi shart' };
    }

    const linkUrl = String(formData.get('linkUrl') || '').trim() || (animeId ? `/anime/${animeId}` : null);
    const subtitle = String(formData.get('subtitle') || '').trim();
    const sortOrder = Number(formData.get('sort_order')) || 0;
    const isActive = formData.get('is_active') === 'on' || formData.get('is_active') === 'true';

    const { error } = await supabase.from('banners').insert({
      title,
      subtitle: subtitle || null,
      image_url: imageUrl,
      video_url: videoUrl,
      link_url: linkUrl,
      anime_id: animeId,
      sort_order: sortOrder,
      is_active: isActive,
    });

    if (error) return { error: `Banner saqlashda xatolik: ${error.message}` };

    revalidatePath('/');
    revalidatePath('/admin');
    return { success: true, message: `Banner “${title}” muvaffaqiyatli saqlandi ✔` };
  } catch (e) {
    return { error: e.message || 'Xatolik yuz berdi' };
  }
}

export async function updateBanner(prevState, formData) {
  try {
    const supabase = await createClient();
    await assertAdmin(supabase);

    const id = String(formData.get('id') || '').trim();
    if (!id) return { error: 'Banner ID topilmadi' };

    const title = String(formData.get('title') || '').trim();
    if (!title) return { error: 'Banner sarlavhasi kiritilishi shart' };

    const animeId = String(formData.get('anime_id') || '').trim() || null;

    let videoUrl = String(formData.get('videoUrl') || '').trim() || null;
    const videoFile = formData.get('video');
    if (videoFile && typeof videoFile !== 'string' && videoFile.size > 0) {
      try {
        videoUrl = await uploadMediaToBucket(supabase, videoFile, 'anime-banners', { maxSizeMB: 50 });
      } catch (vidErr) {
        return { error: `Video banner yuklashda xatolik: ${vidErr.message}` };
      }
    }

    let imageUrl = null;
    const imgFile = formData.get('image');
    if (imgFile && typeof imgFile !== 'string' && imgFile.size > 0) {
      try {
        imageUrl = await uploadMediaToBucket(supabase, imgFile, 'anime-banners', { maxSizeMB: 10 });
      } catch (bannerErr) {
        return { error: `Banner rasmi yuklashda xatolik: ${bannerErr.message}` };
      }
    }
    if (!imageUrl) {
      imageUrl = String(formData.get('imageUrl') || '').trim() || null;
    }

    const linkUrl = String(formData.get('linkUrl') || '').trim() || (animeId ? `/anime/${animeId}` : null);
    const subtitle = String(formData.get('subtitle') || '').trim();
    const sortOrder = Number(formData.get('sort_order')) || 0;
    const isActive = formData.get('is_active') === 'on' || formData.get('is_active') === 'true';

    const updates = {
      title,
      subtitle: subtitle || null,
      link_url: linkUrl,
      anime_id: animeId,
      sort_order: sortOrder,
      is_active: isActive,
    };
    if (imageUrl) updates.image_url = imageUrl;
    if (videoUrl !== undefined && videoUrl !== null) updates.video_url = videoUrl;

    const { error } = await supabase.from('banners').update(updates).eq('id', id);
    if (error) return { error: error.message };

    revalidatePath('/');
    revalidatePath('/admin');
    return { success: true, message: `Banner “${title}” yangilandi ✔` };
  } catch (e) {
    return { error: e.message || 'Xatolik yuz berdi' };
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

// ==========================================
// 4. TRAILER VA CLIPS BOSHQARUVI
// ==========================================

export async function createTrailer(prevState, formData) {
  try {
    const supabase = await createClient();
    await assertAdmin(supabase);

    const title = String(formData.get('title') || '').trim();
    if (!title) return { error: 'Treyler nomi kiritilishi shart' };

    const videoUrl = String(formData.get('video_url') || '').trim();
    if (!videoUrl) return { error: 'Video havolasi kiritilishi shart (YouTube yoki to‘g‘ridan-to‘g‘ri havola)' };

    const animeId = String(formData.get('anime_id') || '').trim() || null;
    let thumbnailUrl = null;
    try {
      thumbnailUrl = await uploadImageToBucket(supabase, formData.get('thumbnail'), 'episode-thumbnails', { maxSizeMB: 5 });
    } catch (thumbErr) {
      return { error: `Muqova rasmi yuklashda xatolik: ${thumbErr.message}` };
    }
    if (!thumbnailUrl) {
      thumbnailUrl = String(formData.get('thumbnailUrl') || '').trim() || null;
    }

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

// ==========================================
// 5. FOYDALANUVCHILAR VA XAVFSIZLIK
// ==========================================

export async function toggleUserVip(formData) {
  const supabase = await createClient();
  await assertAdmin(supabase);
  const userId = String(formData.get('userId') || '').trim();
  if (!userId) throw new Error('Foydalanuvchi ID topilmadi');
  const { error } = await supabase.rpc('admin_toggle_user_vip', { p_user_id: userId });
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
  revalidatePath('/profile');
  revalidatePath('/premium');
}

export async function toggleUserSuspension(formData) {
  const supabase = await createClient();
  await assertAdmin(supabase);
  const userId = String(formData.get('userId') || '').trim();
  if (!userId) throw new Error('Foydalanuvchi ID topilmadi');
  const currentlySuspended = formData.get('isSuspended') === 'true';
  const { error } = await supabase.rpc('set_user_suspended', {
    p_target: userId,
    p_suspended: !currentlySuspended,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
}

// ==========================================
// 6. OBUNA PLANLARI VA BOSHQARUVI (SUBSCRIPTIONS)
// ==========================================

export async function createSubscriptionPlan(prevState, formData) {
  try {
    const supabase = await createClient();
    await assertAdmin(supabase);

    const name = String(formData.get('name') || '').trim();
    if (!name) return { error: 'Plan nomi kiritilishi shart' };

    const slug = String(formData.get('slug') || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_') || `plan_${Date.now()}`;
    const description = String(formData.get('description') || '').trim();
    const priceUzs = Math.max(0, parseInt(formData.get('price_uzs') || '0', 10));
    const durationDays = Math.max(1, parseInt(formData.get('duration_days') || '30', 10));
    const isPopular = formData.get('is_popular') === 'true' || formData.get('is_popular') === 'on';
    const isActive = formData.get('is_active') !== 'false';
    const sortOrder = parseInt(formData.get('sort_order') || '0', 10) || 0;

    const rawBenefits = String(formData.get('benefits') || '');
    const benefits = rawBenefits
      .split('\n')
      .map((b) => b.trim())
      .filter(Boolean);

    const { error } = await supabase.from('subscription_plans').insert({
      name,
      slug,
      description: description || null,
      price_uzs: priceUzs,
      duration_days: durationDays,
      benefits,
      is_popular: isPopular,
      is_active: isActive,
      sort_order: sortOrder,
    });

    if (error) return { error: `Plan yaratishda xatolik: ${error.message}` };

    revalidatePath('/admin');
    revalidatePath('/premium');
    return { success: true, message: `“${name}” tarifi muvaffaqiyatli yaratildi ✔` };
  } catch (e) {
    return { error: e.message || 'Kutilmagan xatolik yuz berdi' };
  }
}

export async function updateSubscriptionPlan(prevState, formData) {
  try {
    const supabase = await createClient();
    await assertAdmin(supabase);

    const id = String(formData.get('id') || '').trim();
    if (!id) return { error: 'Plan ID topilmadi' };

    const name = String(formData.get('name') || '').trim();
    if (!name) return { error: 'Plan nomi kiritilishi shart' };

    const description = String(formData.get('description') || '').trim();
    const priceUzs = Math.max(0, parseInt(formData.get('price_uzs') || '0', 10));
    const durationDays = Math.max(1, parseInt(formData.get('duration_days') || '30', 10));
    const isPopular = formData.get('is_popular') === 'true' || formData.get('is_popular') === 'on';
    const isActive = formData.get('is_active') !== 'false' && formData.get('is_active') !== 'off';
    const sortOrder = parseInt(formData.get('sort_order') || '0', 10) || 0;

    const rawBenefits = String(formData.get('benefits') || '');
    const benefits = rawBenefits
      .split('\n')
      .map((b) => b.trim())
      .filter(Boolean);

    const { error } = await supabase.from('subscription_plans').update({
      name,
      description: description || null,
      price_uzs: priceUzs,
      duration_days: durationDays,
      benefits,
      is_popular: isPopular,
      is_active: isActive,
      sort_order: sortOrder,
      updated_at: new Date().toISOString(),
    }).eq('id', id);

    if (error) return { error: `Plan yangilashda xatolik: ${error.message}` };

    revalidatePath('/admin');
    revalidatePath('/premium');
    return { success: true, message: `“${name}” tarifi muvaffaqiyatli yangilandi ✔` };
  } catch (e) {
    return { error: e.message || 'Kutilmagan xatolik yuz berdi' };
  }
}

export async function togglePlanActive(formData) {
  const supabase = await createClient();
  await assertAdmin(supabase);
  const id = String(formData.get('id') || '').trim();
  if (!id) throw new Error('Plan ID topilmadi');
  const currentActive = formData.get('active') === 'true';

  const { error } = await supabase.from('subscription_plans').update({
    is_active: !currentActive,
    updated_at: new Date().toISOString(),
  }).eq('id', id);
  if (error) throw new Error(error.message);

  revalidatePath('/admin');
  revalidatePath('/premium');
}

export async function deleteSubscriptionPlan(formData) {
  const supabase = await createClient();
  await assertAdmin(supabase);
  const id = String(formData.get('id') || '').trim();
  if (!id) throw new Error('Plan ID topilmadi');

  const { error } = await supabase.from('subscription_plans').delete().eq('id', id);
  if (error) throw new Error(error.message);

  revalidatePath('/admin');
  revalidatePath('/premium');
}

// 7. FOYDALANUVCHILARGA OBUNANI QO'LDA BERISH VA BEKOR QILISH
export async function grantUserSubscription(prevState, formData) {
  try {
    const supabase = await createClient();
    await assertAdmin(supabase);

    const userId = String(formData.get('user_id') || '').trim();
    if (!userId) return { error: 'Foydalanuvchi tanlanishi shart' };
    const planId = String(formData.get('plan_id') || '').trim();
    const customDays = Number.parseInt(String(formData.get('duration_days') || '0'), 10);
    const notes = String(formData.get('notes') || 'Admin tomonidan taqdim etildi').trim().slice(0, 1000);
    const { data, error } = await supabase.rpc('admin_grant_user_subscription', {
      p_user_id: userId,
      p_plan_id: planId || null,
      p_duration_days: customDays || null,
      p_notes: notes,
    });
    if (error || !data) return { error: 'Obuna berilmadi: ' + (error?.message || 'Javob olinmadi') };

    revalidatePath('/admin');
    revalidatePath('/profile');
    revalidatePath('/premium');
    return {
      success: true,
      message: '@' + (data.username || 'Foydalanuvchi') + ' ga “' + data.plan_name + '” obunasi berildi.',
    };
  } catch (e) {
    return { error: e.message || 'Kutilmagan xatolik yuz berdi' };
  }
}

export async function extendUserSubscription(prevState, formData) {
  try {
    const supabase = await createClient();
    await assertAdmin(supabase);
    const userId = String(formData.get('user_id') || '').trim();
    const extendDays = parseInt(formData.get('extend_days') || '30', 10);
    const reason = String(formData.get('reason') || 'Admin tomonidan uzaytirildi').trim();
    if (!userId || !Number.isInteger(extendDays)) return { error: 'Foydalanuvchi va muddat kerak' };
    const { data, error } = await supabase.rpc('admin_extend_user_subscription', {
      p_user_id: userId,
      p_duration_days: extendDays,
      p_reason: reason.slice(0, 1000),
    });
    if (error || !data) return { error: 'Obuna uzaytirilmadi: ' + (error?.message || 'Javob olinmadi') };

    revalidatePath('/admin');
    revalidatePath('/profile');
    revalidatePath('/premium');
    return {
      success: true,
      message: '@' + (data.username || 'Foydalanuvchi') + ' obunasi ' + extendDays + ' kunga uzaytirildi.',
    };
  } catch (e) {
    return { error: e.message || 'Kutilmagan xatolik yuz berdi' };
  }
}

export async function revokeUserSubscription(prevState, formData) {
  try {
    const supabase = await createClient();
    await assertAdmin(supabase);
    const userId = String(formData.get('user_id') || '').trim();
    const reason = String(formData.get('reason') || 'Admin tomonidan bekor qilindi').trim();
    if (!userId) return { error: 'Foydalanuvchi ID topilmadi' };
    const { data, error } = await supabase.rpc('admin_revoke_user_subscription', {
      p_user_id: userId,
      p_reason: reason.slice(0, 1000),
    });
    if (error || !data) return { error: 'Obuna bekor qilinmadi: ' + (error?.message || 'Javob olinmadi') };

    revalidatePath('/admin');
    revalidatePath('/profile');
    revalidatePath('/premium');
    return {
      success: true,
      message: '@' + (data.username || 'Foydalanuvchi') + ' ning obunasi bekor qilindi.',
    };
  } catch (e) {
    return { error: e.message || 'Kutilmagan xatolik yuz berdi' };
  }
}
