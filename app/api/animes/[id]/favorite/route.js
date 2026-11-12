import { json, fail, isUuid, requireUser } from '@/lib/api';
import { rateLimit } from '@/lib/rate-limit';

// POST   /api/animes/:id/favorite  — sevimlilarga qo'shish (idempotent)
// DELETE /api/animes/:id/favorite  — sevimlilardan olib tashlash
export async function POST(request, { params }) {
  const rl = rateLimit('api:favorite:toggle', request.headers, 30, 60);
  if (!rl.allowed) return fail(rl.error, 429);

  const { id } = await params;
  if (!isUuid(id)) return fail('ID noto‘g‘ri', 400);
  const ctx = await requireUser();
  if (ctx.error) return ctx.error;

  const { error } = await ctx.supabase
    .from('favorites')
    .upsert({ user_id: ctx.user.id, anime_id: id }, { onConflict: 'user_id,anime_id', ignoreDuplicates: true });
  if (error) return fail(error.message, 500);
  return json({ favorite: true }, 201);
}

export async function DELETE(request, { params }) {
  const rl = rateLimit('api:favorite:toggle', request.headers, 30, 60);
  if (!rl.allowed) return fail(rl.error, 429);

  const { id } = await params;
  if (!isUuid(id)) return fail('ID noto‘g‘ri', 400);
  const ctx = await requireUser();
  if (ctx.error) return ctx.error;

  const { error } = await ctx.supabase
    .from('favorites').delete().eq('user_id', ctx.user.id).eq('anime_id', id);
  if (error) return fail(error.message, 500);
  return json({ favorite: false });
}
