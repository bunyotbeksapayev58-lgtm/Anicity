import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import Player from '@/components/Player';
import { toggleEpisodeCompleted } from '@/app/actions/progress';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const { animeId, num } = await params;
  const supabase = await createClient();
  const { data: anime } = await supabase.from('animes').select('title').eq('id', animeId).single();
  return {
    title: anime ? `${anime.title} — ${num}-qism — Yozora` : 'Tomosha — Yozora',
  };
}

export default async function WatchPage({ params }) {
  const { animeId, num } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: anime } = await supabase
    .from('animes')
    .select('id, title, episodes(id, number, title, video_url)')
    .eq('id', animeId)
    .single();
  if (!anime) notFound();

  const episodes = [...anime.episodes].sort((a, b) => a.number - b.number);
  const ep = episodes.find((e) => e.number === Number(num));
  if (!ep) notFound();

  const { data: progress } = await supabase
    .from('watch_progress')
    .select('episode_id, position_sec, completed')
    .eq('anime_id', animeId);
  const progMap = new Map((progress || []).map((p) => [p.episode_id, p]));
  const saved = progMap.get(ep.id);
  const isCompleted = Boolean(saved?.completed);

  const prev = episodes.find((e) => e.number === ep.number - 1);
  const next = episodes.find((e) => e.number === ep.number + 1);
  const isDirectVideo = /\.(mp4|webm|ogg)(\?|$)/i.test(ep.video_url);

  return (
    <>
      <Link href={`/anime/${animeId}`} className="back">← {anime.title}</Link>
      <div className="watch-wrap">
        <div>
          <div className="player">
            {isDirectVideo ? (
              <Player
                src={ep.video_url}
                userId={user?.id}
                animeId={animeId}
                episodeId={ep.id}
                startAt={saved && !saved.completed ? saved.position_sec : 0}
                nextHref={next ? `/watch/${animeId}/${next.number}` : null}
              />
            ) : (
              <iframe
                src={ep.video_url}
                allowFullScreen
                allow="autoplay; encrypted-media; picture-in-picture"
                title={`${anime.title} — ${ep.title || `${ep.number}-qism`}`}
              />
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginTop: 16 }}>
            <div>
              <h2 style={{ fontSize: 20 }}>{anime.title} — {ep.title || `${ep.number}-qism`}</h2>
              {!isDirectVideo && (
                <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                  Google Drive embed pleeri (avtomatik davomiylik iframe cheklovi sababli qo‘lda belgilanadi).
                </p>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {user && (
                <form action={toggleEpisodeCompleted}>
                  <input type="hidden" name="animeId" value={animeId} />
                  <input type="hidden" name="episodeId" value={ep.id} />
                  <input type="hidden" name="completed" value={String(isCompleted)} />
                  <button className={`btn sm ${isCompleted ? 'danger' : 'ghost'}`}>
                    {isCompleted ? '✓ Ko‘rilgan (Bekor qilish)' : '✓ Ko‘rildi deb belgilash'}
                  </button>
                </form>
              )}

              {prev && (
                <Link className="btn ghost sm" href={`/watch/${animeId}/${prev.number}`}>
                  ◀ Oldingi
                </Link>
              )}
              {next && (
                <Link className="btn sm" href={`/watch/${animeId}/${next.number}`}>
                  Keyingi ▶
                </Link>
              )}
            </div>
          </div>
        </div>

        <aside className="side">
          <h3 style={{ fontSize: 15, marginBottom: 10, color: 'var(--muted)' }}>Qismlar ro‘yxati</h3>
          {episodes.map((e) => {
            const p = progMap.get(e.id);
            return (
              <Link key={e.id} href={`/watch/${animeId}/${e.number}`}
                className={e.id === ep.id ? 'on' : ''}>
                {e.title || `${e.number}-qism`} {p?.completed ? '✓' : ''}
              </Link>
            );
          })}
        </aside>
      </div>
    </>
  );
}
