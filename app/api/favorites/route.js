import { json, fail, requireUser } from '@/lib/api';

// GET /api/favorites — joriy foydalanuvchining sevimlilari
export async function GET() {
  const ctx = await requireUser();
  if (ctx.error) return ctx.error;

  const { data, error } = await ctx.supabase
    .from('favorites')
    .select('created_at, animes(id, title, year, status, poster_url)')
    .order('created_at', { ascending: false });
  if (error) return fail(error.message, 500);
  return json((data || []).filter((f) => f.animes));
}
