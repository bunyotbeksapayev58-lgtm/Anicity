// Supabase Storage dagi poster rasmini o'chiradi (public URL dan yo'lni ajratib olib)
const MARKER = '/storage/v1/object/public/posters/';

export async function removePosterByUrl(supabase, url) {
  if (!url || !url.includes(MARKER)) return;
  const path = decodeURIComponent(url.slice(url.indexOf(MARKER) + MARKER.length).split('?')[0]);
  await supabase.storage.from('posters').remove([path]);
}
