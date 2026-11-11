import { json, fail, readJson, requireAdminPermission, getPublicContext } from '@/lib/api';
import { validateAnime, validateEpisodes } from '@/lib/validate';
import { logAssistantContentFailure } from '@/lib/assistant-audit';
import { rateLimit } from '@/lib/rate-limit';

// GET /api/animes?q=nom&limit=24&offset=0
export async function GET(request) {
  const rl = rateLimit('api:animes:get', request.headers, 60, 60);
  if (!rl.allowed) return fail(rl.error, 429);
  const { supabase } = await getPublicContext();

  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim().slice(0, 100);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 24, 1), 100);
  const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0);

  let query = supabase
    .from('animes')
    .select('id, title, year, status, genres, poster_url, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (q) query = query.ilike('title', `%${q.replace(/[\\%_]/g, '\\$&')}%`);

  const { data, error, count } = await query;
  if (error) return fail(error.message, 500);
  return json({ data, count, limit, offset }, 200, {
    'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
  });
}

// POST /api/animes (admin)
// body: { title, year, status, genres, description, poster_url, episodes: [...] }
export async function POST(request) {
  const rlPost = rateLimit('api:animes:post', request.headers, 20, 60);
  if (!rlPost.allowed) return fail(rlPost.error, 429);
  const ctx = await requireAdminPermission('anime_create');
  if (ctx.error) return ctx.error;

  const body = await readJson(request);
  const a = validateAnime(body);
  const e = validateEpisodes(body?.episodes);
  const errors = [...a.errors, ...e.errors];
  if (errors.length) return fail('Ma’lumot noto‘g‘ri', 422, errors);

  if (ctx.role === 'assistant_admin') {
    for (const permission of ['episode_create', 'video_upload']) {
      const access = await requireAdminPermission(permission);
      if (access.error) return access.error;
    }
  }

  const rpcName = ctx.role === 'assistant_admin'
    ? 'assistant_create_anime_with_episodes'
    : 'admin_create_anime_with_episodes';
  const { data: anime, error } = await ctx.supabase.rpc(rpcName, {
    p_anime: a.value,
    p_episodes: e.value,
  });
  if (error || !anime) {
    if (ctx.role === 'assistant_admin') await logAssistantContentFailure(ctx.supabase, 'anime_create');
    const status = error?.code === '42501' ? 403 : error?.code === '23505' ? 409 : error?.code === 'P0001' ? 422 : 500;
    return fail(error?.message || 'Anime saqlanmadi', status);
  }
  return json(anime, 201);
}
