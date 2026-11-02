import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Ko‘rilganlar — Anizoom' };

export default async function HistoryPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('watch_progress')
    .select('position_sec, duration_sec, completed, updated_at, episodes(number, title, anime_id, animes(id, title, poster_url))')
    .order('updated_at', { ascending: false })
    .limit(100);
  const list = (data || []).filter((r) => r.episodes?.animes);

  return (
    <>
      <h1 className="grad" style={{ fontSize: 26, marginBottom: 20 }}>Ko‘rilganlar</h1>
      {list.length ? list.map((r) => {
        const a = r.episodes.animes;
        const pct = r.duration_sec ? Math.min(100, (r.position_sec / r.duration_sec) * 100) : 0;
        const mins = Math.floor(r.position_sec / 60);
        const secs = String(Math.floor(r.position_sec % 60)).padStart(2, '0');
        return (
          <Link key={`${r.episodes.anime_id}-${r.episodes.number}`} href={`/watch/${a.id}/${r.episodes.number}`}
            className="li">
            <div className="thumb">{a.poster_url ? <img src={a.poster_url} alt="" /> : a.title.charAt(0)}</div>
            <div className="t">
              <b>{a.title} — {r.episodes.number}-qism</b>
              <small>
                {r.completed ? 'Tugallangan' : `${mins}:${secs} da to‘xtagan`} • {new Date(r.updated_at).toLocaleDateString('uz-UZ')}
              </small>
              <div className="bar"><i style={{ width: `${pct}%` }} /></div>
            </div>
          </Link>
        );
      }) : <div className="empty">Hali hech narsa ko‘rilmagan</div>}
    </>
  );
}
