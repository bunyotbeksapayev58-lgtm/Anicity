'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { toPlayableUrl, driveProblem } from '@/lib/drive';
import { removePosterByUrl, uploadImageToBucket, validateImageFile } from '@/lib/storage';
import { validateSingleEpisode, validateAnime } from '@/lib/validate';
import { isAdminRole } from '@/lib/roles';

async function assertAdmin(supabase) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Kirish talab etiladi');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!isAdminRole(profile?.role)) throw new Error('Ushbu amalni bajarish uchun admin ruxsati yo‘q');
  return user;
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
    await assertAdmin(supabase);

    const title = String(formData.get('title') || '').trim();
    if (!title) return { error: 'Anime nomi kiritilishi shart' };

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

    // Animeni saqlash
    const { data: anime, error: animeErr } = await supabase
      .from('animes')
      .insert({
        title,
        alt_title: altTitle,
        description,
        year,
        status,
        age_rating: ageRating,
        genres,
        studio,
        director,
        poster_url: posterUrl,
        banner_url: bannerUrl,
        is_featured: isFeatured,
        is_published: isPublished,
        release_day: releaseDay,
        fandub_team: fandubTeam,
      })
      .select('id, title, poster_url')
      .single();

    if (animeErr) {
      return { error: `Bazada saqlashda xatolik: ${animeErr.message}` };
    }

    // Agar ixtiyoriy ravishda ommaviy epizodlar kiritilgan bo'lsa (ixtiyoriy, majburiy emas!)
    const episodesRaw = formData.get('episodes');
    if (episodesRaw && String(episodesRaw).trim()) {
      const driveIssues = driveErrors(episodesRaw);
      if (driveIssues.length) {
        return {
          success: true,
          animeId: anime.id,
          animeTitle: anime.title,
          message: `“${title}” saqlandi, ammo ba'zi qismlarda xatolik bor: ${driveIssues[0]}`,
        };
      }
      const parsed = parseEpisodes(episodesRaw, anime.id);
      if (parsed.length) {
        await supabase.from('episodes').insert(parsed);
      }
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
    await assertAdmin(supabase);

    const id = String(formData.get('id') || '').trim();
    if (!id) return { error: 'Anime ID si topilmadi' };

    const title = String(formData.get('title') || '').trim();
    if (!title) return { error: 'Anime nomi kiritilishi shart' };

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

    const { error } = await supabase.from('animes').update(updatePayload).eq('id', id);
    if (error) return { error: error.message };

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
  await assertAdmin(supabase);
  const id = String(formData.get('id'));

  const { data: anime } = await supabase.from('animes').select('poster_url').eq('id', id).single();
  await supabase.from('animes').delete().eq('id', id);
  if (anime?.poster_url) await removePosterByUrl(supabase, anime.poster_url);

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
    await assertAdmin(supabase);

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
        is_published: isPublished,
      })
      .select('id, number, title')
      .single();

    if (insertErr) {
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
    await assertAdmin(supabase);

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
    if (updateErr) return { error: updateErr.message };

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
    await assertAdmin(supabase);

    const episodeId = String(formData.get('episode_id') || '').trim();
    const animeId = String(formData.get('anime_id') || '').trim();
    if (!episodeId) throw new Error('Qism ID si topilmadi');

    const { error } = await supabase.from('episodes').delete().eq('id', episodeId);
    if (error) throw new Error(error.message);

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
    let imageUrl = null;
    try {
      imageUrl = await uploadImageToBucket(supabase, formData.get('image'), 'anime-banners', { maxSizeMB: 5 });
    } catch (bannerErr) {
      return { error: `Banner rasmi yuklashda xatolik: ${bannerErr.message}` };
    }
    if (!imageUrl) {
      imageUrl = String(formData.get('imageUrl') || '').trim() || null;
    }
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
  const userId = String(formData.get('userId'));
  const currentPlan = String(formData.get('currentPlan') || 'free');
  const newPlan = currentPlan === 'vip' ? 'free' : 'vip';
  const expiresAt = newPlan === 'vip' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : null;

  await supabase
    .from('profiles')
    .update({
      subscription_plan: newPlan,
      subscription_expires_at: expiresAt,
    })
    .eq('id', userId);

  revalidatePath('/admin');
}

export async function toggleUserSuspension(formData) {
  const supabase = await createClient();
  await assertAdmin(supabase);
  const userId = String(formData.get('userId'));
  const isSuspended = formData.get('isSuspended') === 'true';
  const suspendedAt = isSuspended ? null : new Date().toISOString();

  await supabase
    .from('profiles')
    .update({
      suspended_at: suspendedAt,
    })
    .eq('id', userId);

  revalidatePath('/admin');
}
