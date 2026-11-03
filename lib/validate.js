import { toPlayableUrl, driveProblem } from './drive.js';

const STATUSES = ['Tugallangan', 'Davom etmoqda'];
const AGE_RATINGS = ['0+', '6+', '12+', '16+', '18+', 'PG-13', 'R-17'];
const isHttp = (s) => /^https?:\/\/[^\s]+$/i.test(s);

// Anime maydonlarini tekshiradi va tozalaydi
export function validateAnime(body, { partial = false } = {}) {
  const errors = [];
  const value = {};
  if (!body || typeof body !== 'object') return { errors: ['JSON body kerak'], value };

  if ('title' in body || !partial) {
    const title = String(body.title ?? '').trim();
    if (!title || title.length > 200) errors.push('title: 1–200 belgi bo‘lishi kerak');
    value.title = title;
  }
  if ('alt_title' in body) {
    value.alt_title = String(body.alt_title ?? '').trim().slice(0, 200) || null;
  }
  if ('year' in body || !partial) {
    const year = Number(body.year ?? new Date().getFullYear());
    if (!Number.isInteger(year) || year < 1960 || year > 2100) errors.push('year: 1960–2100 oralig‘ida bo‘lsin');
    value.year = year;
  }
  if ('status' in body || !partial) {
    const status = body.status ?? 'Tugallangan';
    if (!STATUSES.includes(status)) errors.push(`status: ${STATUSES.join(' yoki ')}`);
    value.status = status;
  }
  if ('age_rating' in body) {
    const age = String(body.age_rating ?? '12+').trim();
    value.age_rating = AGE_RATINGS.includes(age) ? age : '12+';
  }
  if ('studio' in body) {
    value.studio = String(body.studio ?? '').trim().slice(0, 100) || null;
  }
  if ('director' in body) {
    value.director = String(body.director ?? '').trim().slice(0, 100) || null;
  }
  if ('genres' in body || !partial) {
    const raw = Array.isArray(body.genres) ? body.genres : String(body.genres ?? '').split(',');
    value.genres = raw.map((g) => String(g).trim()).filter(Boolean).slice(0, 20);
  }
  if ('description' in body || !partial) {
    value.description = String(body.description ?? '').trim().slice(0, 5000);
  }
  if ('poster_url' in body || !partial) {
    const poster = body.poster_url ? String(body.poster_url).trim() : null;
    if (poster && !isHttp(poster)) errors.push('poster_url: http(s) havola bo‘lishi kerak');
    value.poster_url = poster;
  }
  if ('banner_url' in body) {
    const banner = body.banner_url ? String(body.banner_url).trim() : null;
    if (banner && !isHttp(banner)) errors.push('banner_url: http(s) havola bo‘lishi kerak');
    value.banner_url = banner;
  }
  if ('is_featured' in body) {
    value.is_featured = Boolean(body.is_featured);
  }
  if ('is_published' in body) {
    value.is_published = body.is_published !== false && body.is_published !== 'false';
  }
  if ('release_day' in body) {
    value.release_day = String(body.release_day ?? '').trim().toLowerCase() || null;
  }
  if ('fandub_team' in body) {
    value.fandub_team = String(body.fandub_team ?? 'Anicity Dub').trim().slice(0, 100);
  }

  return { errors, value };
}

// Bitta qismni mustaqil tekshirish
export function validateSingleEpisode(body) {
  const errors = [];
  if (!body || typeof body !== 'object') return { errors: ['Qism ma’lumotlari kerak'], value: null };

  const seasonNumber = parseInt(body.season_number ?? 1, 10);
  if (isNaN(seasonNumber) || seasonNumber < 1) {
    errors.push('Fasl raqami 1 yoki undan katta musbat son bo‘lishi kerak');
  }

  const number = parseInt(body.number, 10);
  if (isNaN(number) || number < 1) {
    errors.push('Qism raqami 1 yoki undan katta musbat son bo‘lishi kerak');
  }

  const rawUrl = String(body.video_url ?? '').trim();
  if (!rawUrl) {
    errors.push('Video havolasi kiritilishi shart');
  } else {
    const problem = driveProblem(rawUrl);
    if (problem) {
      errors.push(problem);
    } else if (!isHttp(rawUrl)) {
      errors.push('Video havolasi yaroqli http(s) formatida bo‘lishi kerak');
    }
  }

  const title = String(body.title ?? '').trim() || `${number || 1}-qism`;
  const description = String(body.description ?? '').trim().slice(0, 3000) || null;
  const quality = String(body.quality ?? '1080p').trim();
  const isPublished = body.is_published !== false && body.is_published !== 'false';
  const thumbnailUrl = body.thumbnail_url ? String(body.thumbnail_url).trim() : null;

  const value = {
    season_number: seasonNumber || 1,
    number: number || 1,
    title: title.slice(0, 200),
    description,
    video_url: toPlayableUrl(rawUrl),
    thumbnail_url: thumbnailUrl,
    is_published: isPublished,
    quality,
  };

  return { errors, value };
}

// Epizodlar: ["1-qism | https://...", ...] yoki [{ title, url }, ...] (eski/ommaviy import uchun)
export function validateEpisodes(list) {
  const errors = [];
  if (!Array.isArray(list) || list.length === 0) {
    return { errors: ['episodes: kamida bitta qism kerak'], value: [] };
  }
  if (list.length > 500) return { errors: ['episodes: 500 tadan ko‘p bo‘lmasin'], value: [] };

  const value = list.map((item, i) => {
    let title;
    let url;
    if (typeof item === 'string') {
      const parts = item.split('|');
      title = parts.length > 1 ? parts[0].trim() : `${i + 1}-qism`;
      url = (parts.length > 1 ? parts.slice(1).join('|') : parts[0]).trim();
    } else {
      title = String(item?.title ?? `${i + 1}-qism`).trim();
      url = String(item?.url ?? '').trim();
    }
    const problem = driveProblem(url);
    if (problem) errors.push(`episode ${i + 1}: ${problem}`);
    url = toPlayableUrl(url);
    if (!isHttp(url)) errors.push(`episode ${i + 1}: havola noto‘g‘ri`);
    return {
      season_number: 1,
      number: i + 1,
      title: title.slice(0, 200) || `${i + 1}-qism`,
      description: typeof item === 'object' && item ? String(item.description ?? '').trim().slice(0, 3000) || null : null,
      video_url: url,
      thumbnail_url: typeof item === 'object' && item ? String(item.thumbnail_url ?? '').trim() || null : null,
      is_published: typeof item === 'object' && item ? item.is_published !== false && item.is_published !== 'false' : true,
      quality: typeof item === 'object' && item ? String(item.quality ?? '1080p').trim() : '1080p',
    };
  });
  return { errors, value };
}

// Ko'rish holati: vaqtlarni tekshiradi, tugallanganini serverda hisoblaydi
export function validateProgress(body) {
  const pos = Number(body?.position_sec);
  const dur = Number(body?.duration_sec);
  if (!Number.isFinite(pos) || !Number.isFinite(dur) || pos < 0 || dur < 0) {
    return { errors: ['position_sec va duration_sec musbat son bo‘lishi kerak'] };
  }
  const position = Math.min(pos, dur || pos);
  const completed = Boolean(body.completed) || (dur > 0 && position / dur > 0.92);
  return { errors: [], value: { position_sec: position, duration_sec: dur, completed } };
}
