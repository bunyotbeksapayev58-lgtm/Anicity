import { json, fail, isUuid, readJson, requireAdmin, requireAdminPermission, getPublicContext } from '@/lib/api';
import { validateAnime, validateEpisodes } from '@/lib/validate';
import { removePosterByUrl } from '@/lib/storage';
import { logAssistantContentFailure } from '@/lib/assistant-audit';
import { applyAnimeIdentifierFilter } from '@/lib/anime-lookup';

// GET /api/animes/:id
export async function GET(request, { params }) {
  const { id } = await params;
  const { supabase } = await getPublicContext();

  const query = applyAnimeIdentifierFilter(
    supabase.from('animes').select('*, episodes(id, number, title, video_url)'),
    id
  );
  const { data, error } = await query.maybeSingle();
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

  const hasAnimeChanges = Object.keys(a.value).length > 0;
  const hasEpisodeReplacement = eps !== null;
  if (!hasAnimeChanges && !hasEpisodeReplacement) {
    const ctx = await requireAdmin();
    if (ctx.error) return ctx.error;
    return json({ ok: true });
  }

  const requiredPermissions = [];
  if (hasAnimeChanges) requiredPermissions.push('anime_edit');
  // PATCH replaces the episode collection atomically, which includes edits,
  // inserts, and deletion of the previous collection.
  if (hasEpisodeReplacement) {
    requiredPermissions.push('episode_edit', 'episode_create', 'episode_delete', 'video_upload');
  }
  let ctx;
  for (const permission of [...new Set(requiredPermissions)]) {
    const access = await requireAdminPermission(permission);
    if (access.error) return access.error;
    ctx = access;
  }

  if (hasAnimeChanges || hasEpisodeReplacement) {
    const rpcName = ctx.role === 'assistant_admin'
      ? 'assistant_update_anime_and_episodes_authorized'
      : 'admin_update_anime_and_episodes';
    const { error } = await ctx.supabase.rpc(rpcName, {
      p_anime_id: id,
      p_anime: a.value,
      p_episodes: eps,
    });
    if (error) {
      if (ctx.role === 'assistant_admin') await logAssistantContentFailure(
        ctx.supabase, hasEpisodeReplacement ? 'episode_replace' : 'anime_update', id, id,
      );
      const status = error.code === '42501' ? 403
        : error.code === 'P0002' ? 404
          : error.code === 'P0001' ? 422
            : error.code === '23505' ? 409 : 500;
      return fail(error.message, status);
    }
  }
  return json({ ok: true });
}

// DELETE /api/animes/:id (admin)
export async function DELETE(request, { params }) {
  const { id } = await params;
  if (!isUuid(id)) return fail('ID noto‘g‘ri', 400);
  const ctx = await requireAdminPermission('anime_delete');
  if (ctx.error) return ctx.error;

  const { data: anime } = await ctx.supabase.from('animes').select('poster_url').eq('id', id).single();
  const { error } = await ctx.supabase.from('animes').delete().eq('id', id);
  if (error) {
    if (ctx.role === 'assistant_admin') await logAssistantContentFailure(ctx.supabase, 'anime_delete', id);
    return fail(error.message, 500);
  }
  if (ctx.role !== 'assistant_admin' && anime?.poster_url) await removePosterByUrl(ctx.supabase, anime.poster_url);
  return json({ ok: true });
}
