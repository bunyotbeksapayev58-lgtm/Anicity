// Google Drive havolasini pleer uchun embed (preview) havolasiga aylantiradi.
// Qabul qilinadi (FAYL havolasi):
//   https://drive.google.com/file/d/FILE_ID/view?usp=sharing
//   https://drive.google.com/file/d/FILE_ID/preview
//   https://drive.google.com/open?id=FILE_ID
//   https://drive.google.com/uc?id=FILE_ID&export=download
//   drive:FILE_ID
// Qabul QILINMAYDI:
//   - Papka havolasi (/drive/folders/...), chunki u video emas
//   - Soxta domenlar (masalan: drive.google.com.attacker.com)

const DRIVE_HOST = /^(?:[a-zA-Z0-9-]+\.)*drive\.google\.com$/i;

export function isDriveUrl(raw) {
  try {
    const str = String(raw || '').trim();
    if (/^drive:[a-zA-Z0-9_-]+$/i.test(str)) return true;
    const u = new URL(str);
    return (u.protocol === 'https:' || u.protocol === 'http:') && DRIVE_HOST.test(u.hostname);
  } catch {
    return false;
  }
}

export function isDriveFolderUrl(raw) {
  try {
    const str = String(raw || '').trim();
    const u = new URL(str);
    if (!DRIVE_HOST.test(u.hostname)) return false;
    return u.pathname.includes('/folders/') || u.pathname.includes('/embeddedfolderview');
  } catch {
    return false;
  }
}

export function extractDriveFileId(raw) {
  const str = String(raw || '').trim();
  if (!str) return null;
  const prefixMatch = str.match(/^drive:([a-zA-Z0-9_-]+)$/i);
  if (prefixMatch) return prefixMatch[1];
  if (!isDriveUrl(str) || isDriveFolderUrl(str)) return null;
  const m = str.match(/\/file\/d\/([a-zA-Z0-9_-]+)/i) || str.match(/[?&]id=([a-zA-Z0-9_-]+)/i);
  return m ? m[1] : null;
}

export function toPlayableUrl(raw) {
  const str = String(raw || '').trim();
  const fileId = extractDriveFileId(str);
  if (fileId) {
    return `https://drive.google.com/file/d/${fileId}/preview`;
  }
  if (str.startsWith('bunny:')) {
    const rest = str.slice(6);
    const cdnHost = process.env.NEXT_PUBLIC_BUNNY_STREAM_CDN_HOSTNAME || process.env.BUNNY_STREAM_CDN_HOSTNAME || 'anicity.b-cdn.net';
    return `https://${cdnHost}/${rest}/playlist.m3u8`;
  }
  if (str.startsWith('r2:')) {
    const rest = str.slice(3);
    const r2Base = process.env.CLOUDFLARE_R2_PUBLIC_URL || '';
    return r2Base ? `${r2Base.replace(/\/$/, '')}/${rest.replace(/^\//, '')}` : str;
  }
  return str;
}

// Drive havolasi bo'lsa va u yaroqsiz bo'lsa, xato matnini qaytaradi; aks holda null
export function driveProblem(raw) {
  const url = String(raw || '').trim();
  if (!url) return 'Video havolasi kiritilmagan';
  if (isDriveFolderUrl(url)) {
    return 'Google Drive papka havolasi qabul qilinmaydi. Faqat bitta video fayl havolasini kiriting';
  }
  if (isDriveUrl(url)) {
    const fileId = extractDriveFileId(url);
    if (!fileId) {
      return 'Google Drive havolasi fayl havolasi bo‘lishi kerak (papka havolasi emas)';
    }
  }
  return null;
}
