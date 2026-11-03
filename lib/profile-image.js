const MAX_PROFILE_IMAGE_BYTES = 2 * 1024 * 1024;

const SIGNATURES = {
  'image/jpeg': { extension: 'jpg', matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/png': { extension: 'png', matches: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  'image/webp': { extension: 'webp', matches: (b) => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 },
};

export async function validateProfileImage(file) {
  if (!file || typeof file.arrayBuffer !== 'function' || !Number.isFinite(file.size) || file.size < 1) {
    return { error: 'Profil rasmi tanlanmadi.' };
  }
  if (file.size > MAX_PROFILE_IMAGE_BYTES) return { error: 'Rasm 2 MB dan kichik bo‘lishi kerak.' };
  const signature = SIGNATURES[String(file.type || '').toLowerCase()];
  if (!signature) return { error: 'Faqat JPEG, PNG yoki WebP rasmlar qabul qilinadi.' };
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!signature.matches(bytes)) return { error: 'Fayl turi mazmuniga mos kelmadi.' };
  return { bytes: Buffer.from(bytes), contentType: file.type.toLowerCase(), extension: signature.extension };
}

export function isSafeAvatarUrl(publicUrl, userId) {
  if (!publicUrl) return true;
  if (!userId || typeof publicUrl !== 'string') return false;
  try {
    const url = new URL(publicUrl);
    if (!['http:', 'https:'].includes(url.protocol)) return false;
    if (url.username || url.password || url.search || url.hash) return false;
    const marker = '/storage/v1/object/public/profile-avatars/';
    const offset = url.pathname.indexOf(marker);
    if (offset < 0) return false;
    const rawPath = url.pathname.slice(offset + marker.length);
    const decodedPath = decodeURIComponent(rawPath);
    if (decodedPath.includes('..') || decodedPath.includes('\\')) return false;
    const parts = decodedPath.split('/');
    if (parts.length !== 2) return false;
    if (parts[0] !== String(userId)) return false;
    const filename = parts[1];
    if (!/^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/i.test(filename)) return false;
    return true;
  } catch {
    return false;
  }
}

export function getOwnedAvatarPath(publicUrl, userId) {
  if (!isSafeAvatarUrl(publicUrl, userId) || !publicUrl || !userId) return null;
  try {
    const pathname = new URL(publicUrl).pathname;
    const marker = '/storage/v1/object/public/profile-avatars/';
    const offset = pathname.indexOf(marker);
    if (offset < 0) return null;
    return decodeURIComponent(pathname.slice(offset + marker.length));
  } catch {
    return null;
  }
}
