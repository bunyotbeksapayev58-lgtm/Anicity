import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import Player from '@/components/Player';

export const dynamic = 'force-dynamic';

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
                userId={user.id}
                animeId={animeId}
                episodeId={ep.id}
                startAt={saved && !saved.completed ? saved.position_sec : 0}
                nextHref={next ? `/watch/${animeId}/${next.number}` : null}
              />
            ) : (
              <iframe src={ep.video_url} allowFullScreen allow="autoplay; encrypted-media" />
            )}
          </div>
          <h2 style={{ fontSize: 20, marginTop: 16 }}>{anime.title} — {ep.title || `${ep.number}-qism`}</h2>
          {!isDirectVideo && (
            <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
              Ushbu pleer uchun ko‘rish holati saqlanmaydi (tashqi embed).
            </p>
          )}
        </div>

        <aside className="side">
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
