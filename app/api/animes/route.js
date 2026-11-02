import { json, fail, readJson, requireAdmin, requireUser } from '@/lib/api';
import { validateAnime, validateEpisodes } from '@/lib/validate';

// GET /api/animes?q=nom&limit=24&offset=0
export async function GET(request) {
  const ctx = await requireUser();
  if (ctx.error) return ctx.error;

  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim().slice(0, 100);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 24, 1), 100);
  const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0);

  let query = ctx.supabase
    .from('animes')
    .select('id, title, year, status, genres, poster_url, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (q) query = query.ilike('title', `%${q.replace(/[\\%_]/g, '\\$&')}%`);

  const { data, error, count } = await query;
  if (error) return fail(error.message, 500);
  return json({ data, count, limit, offset });
}

// POST /api/animes (admin)
// body: { title, year, status, genres, description, poster_url, episodes: [...] }
export async function POST(request) {
  const ctx = await requireAdmin();
  if (ctx.error) return ctx.error;

  const body = await readJson(request);
  const a = validateAnime(body);
  const e = validateEpisodes(body?.episodes);
  const errors = [...a.errors, ...e.errors];
  if (errors.length) return fail('Ma’lumot noto‘g‘ri', 422, errors);

  const { data: anime, error } = await ctx.supabase
    .from('animes').insert(a.value).select('*').single();
  if (error) return fail(error.message, 500);

  const { error: epErr } = await ctx.supabase
    .from('episodes').insert(e.value.map((ep) => ({ ...ep, anime_id: anime.id })));
  if (epErr) {
    // Epizodlar yozilmasa, anime ham qolmasin (yarim yozilgan holat bo‘lmasin)
    await ctx.supabase.from('animes').delete().eq('id', anime.id);
    return fail(epErr.message, 500);
  }
  return json(anime, 201);
}
