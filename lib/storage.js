// Supabase Storage vositalari: Rasm tekshirish, yuklash va o'chirish
const MARKER_POSTERS = '/storage/v1/object/public/posters/';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
const ALLOWED_VIDEO_MIME_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska'];

/**
 * Video faylini tekshirish (hajmi va formati)
 */
export function validateVideoFile(file, { maxSizeMB = 50 } = {}) {
  if (!file || typeof file === 'string' || !file.size) {
    return { valid: true, file: null };
  }
  const maxBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxBytes) {
    return {
      valid: false,
      error: `Video hajmi ${maxSizeMB} MB dan katta bo‘lmasin (hozirgi: ${(file.size / (1024 * 1024)).toFixed(1)} MB)`,
    };
  }
  const mime = String(file.type || '').toLowerCase();
  const name = String(file.name || '').toLowerCase();
  const isVideoExt = /\.(mp4|webm|mov|mkv)$/i.test(name);
  if (mime && !ALLOWED_VIDEO_MIME_TYPES.includes(mime) && !isVideoExt) {
    return {
      valid: false,
      error: 'Faqat MP4, WebM yoki MOV formatidagi video fayllar qabul qilinadi',
    };
  }
  return { valid: true, file };
}

/**
 * Rasm faylini tekshirish (hajmi va formati)
 */
export function validateImageFile(file, { maxSizeMB = 5 } = {}) {
  if (!file || typeof file === 'string' || !file.size) {
    return { valid: true, file: null };
  }
  const maxBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxBytes) {
    return {
      valid: false,
      error: `Rasm hajmi ${maxSizeMB} MB dan katta bo‘lmasin (hozirgi: ${(file.size / (1024 * 1024)).toFixed(1)} MB)`,
    };
  }
  const mime = String(file.type || '').toLowerCase();
  if (mime && !ALLOWED_MIME_TYPES.includes(mime)) {
    return {
      valid: false,
      error: 'Faqat JPG, JPEG, PNG yoki WebP formatidagi rasmlar qabul qilinadi',
    };
  }
  return { valid: true, file };
}

/**
 * Rasm faylining haqiqiy baytlarini (magic bytes) tekshirish
 */
export function verifyImageMagicBytes(buffer) {
  if (!buffer || buffer.length < 12) return false;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) return true;
  // WebP: RIFF....WEBP
  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) return true;
  return false;
}

/**
 * Video faylining haqiqiy baytlarini (magic bytes) tekshirish
 */
export function verifyVideoMagicBytes(buffer) {
  if (!buffer || buffer.length < 12) return false;
  // MP4 / MOV (ftyp box at offset 4)
  if (buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) return true;
  // WebM / MKV (EBML header 1A 45 DF A3)
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) return true;
  return false;
}

/**
 * Rasmni Supabase Storage bucketiga Node Buffer orqali xavfsiz yuklash
 */
export async function uploadImageToBucket(supabase, file, bucketName, { maxSizeMB = 5 } = {}) {
  if (!file || typeof file === 'string' || !file.size || file.size === 0) {
    return null;
  }

  const check = validateImageFile(file, { maxSizeMB });
  if (!check.valid) {
    throw new Error(check.error);
  }

  // Fayl kengaytmasini xavfsiz ajratib olish
  const rawExt = String(file.name || '').split('.').pop() || 'webp';
  const cleanExt = rawExt.toLowerCase().replace(/[^a-z0-9]/g, '') || 'webp';
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${cleanExt}`;

  // Next.js Server Action File obyektini Node.js Buffer ga o'tkazish
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Haqiqiy rasm formatini magic baytlar orqali tekshirish
  if (!verifyImageMagicBytes(buffer)) {
    throw new Error('Fayl formati yaroqsiz: Fayl mazmuni haqiqiy rasmga (JPEG, PNG yoki WebP) mos kelmadi');
  }

  const contentType = file.type || (cleanExt === 'png' ? 'image/png' : cleanExt === 'webp' ? 'image/webp' : 'image/jpeg');

  const { error } = await supabase.storage.from(bucketName).upload(path, buffer, {
    contentType,
    upsert: true,
  });

  if (error) {
    throw new Error(`Storage yuklashda xatolik (${bucketName}): ${error.message}`);
  }

  const { data } = supabase.storage.from(bucketName).getPublicUrl(path);
  return data?.publicUrl || null;
}

/**
 * Media (Rasm yoki Video) faylini Supabase Storage bucketiga yuklash
 */
export async function uploadMediaToBucket(supabase, file, bucketName, { maxSizeMB = 50 } = {}) {
  if (!file || typeof file === 'string' || !file.size || file.size === 0) {
    return null;
  }

  const isVideo = String(file.type || '').startsWith('video/') || /\.(mp4|webm|mov|mkv)$/i.test(file.name || '');
  const check = isVideo ? validateVideoFile(file, { maxSizeMB }) : validateImageFile(file, { maxSizeMB: 10 });
  if (!check.valid) {
    throw new Error(check.error);
  }

  const rawExt = String(file.name || '').split('.').pop() || (isVideo ? 'mp4' : 'webp');
  const cleanExt = rawExt.toLowerCase().replace(/[^a-z0-9]/g, '') || (isVideo ? 'mp4' : 'webp');
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${cleanExt}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Haqiqiy media formatini magic baytlar orqali tekshirish
  const isValidContent = isVideo ? verifyVideoMagicBytes(buffer) : verifyImageMagicBytes(buffer);
  if (!isValidContent) {
    throw new Error(`Fayl formati yaroqsiz: Fayl mazmuni haqiqiy ${isVideo ? 'video' : 'rasm'} formatiga mos kelmadi`);
  }

  const contentType = file.type || (cleanExt === 'mp4' ? 'video/mp4' : cleanExt === 'webm' ? 'video/webm' : cleanExt === 'png' ? 'image/png' : 'image/jpeg');

  const { error } = await supabase.storage.from(bucketName).upload(path, buffer, {
    contentType,
    upsert: true,
  });

  if (error) {
    throw new Error(`Storage yuklashda xatolik (${bucketName}): ${error.message}`);
  }

  const { data } = supabase.storage.from(bucketName).getPublicUrl(path);
  return data?.publicUrl || null;
}

/**
 * Storage'dan eski rasmni o'chirish (public URL dan yo'lni ajratib olib)
 */
export async function removePosterByUrl(supabase, url) {
  if (!url || typeof url !== 'string') return;
  const marker = '/storage/v1/object/public/posters/';
  if (!url.includes(marker)) return;
  const path = decodeURIComponent(url.slice(url.indexOf(marker) + marker.length).split('?')[0]);
  if (path) {
    await supabase.storage.from('posters').remove([path]);
  }
}

export async function removeFileByUrl(supabase, bucketName, url) {
  if (!url || typeof url !== 'string' || !bucketName) return;
  const marker = `/storage/v1/object/public/${bucketName}/`;
  if (!url.includes(marker)) return;
  const path = decodeURIComponent(url.slice(url.indexOf(marker) + marker.length).split('?')[0]);
  if (path) {
    await supabase.storage.from(bucketName).remove([path]);
  }
}
