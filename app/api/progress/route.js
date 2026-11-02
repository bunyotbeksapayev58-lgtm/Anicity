import { json, fail, readJson, requireUser } from '@/lib/api';
import { validateProgress } from '@/lib/validate';

// GET /api/progress?animeId=... — ko'rish holati (animeId berilmasa — hammasi, so'nggisi birinchi)
export async function GET(request) {
  const ctx = await requireUser();
  if (ctx.error) return ctx.error;

  const animeId = new URL(request.url).searchParams.get('animeId');
  let query = ctx.supabase
    .from('watch_progress')
    .select('episode_id, anime_id, position_sec, duration_sec, completed, updated_at, episodes(number, title, animes(id, title, poster_url))')
    .order('updated_at', { ascending: false })
    .limit(100);
  if (animeId) query = query.eq('anime_id', animeId);

  const { data, error } = await query;
  if (error) return fail(error.message, 500);
  return json(data || []);
}

// POST /api/progress — ko'rish holatini saqlash (player har ~5 soniyada chaqiradi)
// body: { episode_id, anime_id, position_sec, duration_sec, completed? }
export async function POST(request) {
  const ctx = await requireUser();
  if (ctx.error) return ctx.error;

  const body = await readJson(request);
  if (!body?.episode_id || !body?.anime_id) return fail('episode_id va anime_id kerak', 422);

  const v = validateProgress(body);
  if (v.errors.length) return fail('Ma’lumot noto‘g‘ri', 422, v.errors);

  // Qism haqiqatan shu animega tegishli ekanini tekshiramiz
  const { data: ep } = await ctx.supabase
    .from('episodes').select('id').eq('id', body.episode_id).eq('anime_id', body.anime_id).maybeSingle();
  if (!ep) return fail('Qism topilmadi', 404);

  const { data, error } = await ctx.supabase
    .from('watch_progress')
    .upsert({
      user_id: ctx.user.id,
      episode_id: body.episode_id,
      anime_id: body.anime_id,
      ...v.value,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,episode_id' })
    .select()
    .single();
  if (error) return fail(error.message, 500);
  return json(data);
}
