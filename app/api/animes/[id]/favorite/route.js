import { json, fail, isUuid, requireUser } from '@/lib/api';

// POST   /api/animes/:id/favorite  — sevimlilarga qo'shish (idempotent)
// DELETE /api/animes/:id/favorite  — sevimlilardan olib tashlash
export async function POST(request, { params }) {
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
  const { id } = await params;
  if (!isUuid(id)) return fail('ID noto‘g‘ri', 400);
  const ctx = await requireUser();
  if (ctx.error) return ctx.error;

  const { error } = await ctx.supabase
    .from('favorites').delete().eq('user_id', ctx.user.id).eq('anime_id', id);
  if (error) return fail(error.message, 500);
  return json({ favorite: false });
}
