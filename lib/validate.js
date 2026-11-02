import { toPlayableUrl, driveProblem } from '@/lib/drive';

const STATUSES = ['Tugallangan', 'Davom etmoqda'];
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
  return { errors, value };
}

// Epizodlar: ["1-qism | https://...", ...] yoki [{ title, url }, ...]
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
    return { number: i + 1, title: title.slice(0, 200) || `${i + 1}-qism`, video_url: url };
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
