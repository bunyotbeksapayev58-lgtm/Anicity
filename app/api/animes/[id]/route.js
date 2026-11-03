import { json, fail, isUuid, readJson, requireAdmin, getPublicContext } from '@/lib/api';
import { validateAnime, validateEpisodes } from '@/lib/validate';
import { removePosterByUrl } from '@/lib/storage';

// GET /api/animes/:id
export async function GET(request, { params }) {
  const { id } = await params;
  if (!isUuid(id)) return fail('ID noto‘g‘ri', 400);
  const { supabase } = await getPublicContext();

  const { data, error } = await supabase
    .from('animes')
    .select('*, episodes(id, number, title, video_url)')
    .eq('id', id)
    .single();
  if (error || !data) return fail('Topilmadi', 404);
  if (Array.isArray(data.episodes)) {
    data.episodes.sort((x, y) => x.number - y.number);
  }
  return json(data);
}

// PATCH /api/animes/:id (admin) — maydonlar va ixtiyoriy episodes ro'yxati
export async function PATCH(request, { params }) {
  const { id } = await params;
  if (!isUuid(id)) return fail('ID noto‘g‘ri', 400);
  const ctx = await requireAdmin();
  if (ctx.error) return ctx.error;

  const body = await readJson(request);
  const a = validateAnime(body, { partial: true });
  const errors = [...a.errors];
  let eps = null;
  if (body?.episodes !== undefined) {
    const e = validateEpisodes(body.episodes);
    errors.push(...e.errors);
    eps = e.value;
  }
  if (errors.length) return fail('Ma’lumot noto‘g‘ri', 422, errors);

  if (Object.keys(a.value).length) {
    const { error } = await ctx.supabase.from('animes').update(a.value).eq('id', id);
    if (error) return fail(error.message, 500);
  }
  if (eps) {
    // Qismlar to‘liq almashtiriladi
    await ctx.supabase.from('episodes').delete().eq('anime_id', id);
    const { error } = await ctx.supabase.from('episodes').insert(eps.map((ep) => ({ ...ep, anime_id: id })));
    if (error) return fail(error.message, 500);
  }
  return json({ ok: true });
}

// DELETE /api/animes/:id (admin)
export async function DELETE(request, { params }) {
  const { id } = await params;
  if (!isUuid(id)) return fail('ID noto‘g‘ri', 400);
  const ctx = await requireAdmin();
  if (ctx.error) return ctx.error;

  const { data: anime } = await ctx.supabase.from('animes').select('poster_url').eq('id', id).single();
  const { error } = await ctx.supabase.from('animes').delete().eq('id', id);
  if (error) return fail(error.message, 500);
  if (anime?.poster_url) await removePosterByUrl(ctx.supabase, anime.poster_url);
  return json({ ok: true });
}
