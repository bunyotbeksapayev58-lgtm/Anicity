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
