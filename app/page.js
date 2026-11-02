import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const escapeLike = (s) => s.replace(/[\\%_]/g, '\\$&');

export default async function HomePage({ searchParams }) {
  const { q = '', g = '' } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from('animes')
    .select('id, title, year, status, poster_url, genres')
    .order('created_at', { ascending: false });
  if (q) query = query.ilike('title', `%${escapeLike(q.slice(0, 100))}%`);
  if (g) query = query.contains('genres', [g.slice(0, 50)]);
  const { data: animes } = await query;

  // Janr filtri uchun barcha janrlar
  const { data: genreRows } = await supabase.from('animes').select('genres');
  const genres = [...new Set((genreRows || []).flatMap((a) => a.genres || []))].sort();

  // Davom ettirish: tugallanmagan, so'nggi ko'rilganlar
  const { data: continueRaw } = await supabase
    .from('watch_progress')
    .select('position_sec, duration_sec, updated_at, episodes(number, title, anime_id, animes(id, title, poster_url))')
    .eq('completed', false)
    .order('updated_at', { ascending: false })
    .limit(10);
  const continueList = (continueRaw || []).filter((r) => r.episodes?.animes);

  const filtered = Boolean(q || g);
  const hero = !filtered ? animes?.[0] : null;

  return (
    <>
      {hero && (
        <section className="hero">
          <div className="info">
            <h1 className="grad">{hero.title}</h1>
            <div>{(hero.genres || []).map((x) => <span key={x} className="tag">{x}</span>)}</div>
            <p>{hero.year} • {hero.status}</p>
            <Link className="btn" href={`/anime/${hero.id}`}>▶ Tomosha qilish</Link>
          </div>
        </section>
      )}

      {continueList.length > 0 && !filtered && (
        <>
          <h2 className="sec">Davom ettirish</h2>
          <div className="grid">
            {continueList.map((r, i) => {
              const a = r.episodes.animes;
              const pct = r.duration_sec ? Math.min(100, (r.position_sec / r.duration_sec) * 100) : 0;
              return (
                <Link key={`${a.id}-${r.episodes.number}`} className="item"
                  style={{ animationDelay: `${i * 60}ms` }}
                  href={`/watch/${a.id}/${r.episodes.number}`}>
                  <div className="poster">
                    {a.poster_url ? <img src={a.poster_url} alt="" /> : a.title.charAt(0)}
                  </div>
                  <div className="meta">
                    <h3>{a.title}</h3>
                    <small>{r.episodes.number}-qism</small>
                    <div className="bar"><i style={{ width: `${pct}%` }} /></div>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}

      <div className="toolbar" style={{ marginTop: 28 }}>
        <h2 className="sec" style={{ margin: 0 }}>
          {q ? `“${q}” bo‘yicha natijalar` : g ? `${g} janri` : 'Barcha animelar'}
        </h2>
        <form style={{ marginLeft: 'auto' }}>
          {g && <input type="hidden" name="g" value={g} />}
          <input name="q" defaultValue={q} placeholder="Anime qidirish..." />
        </form>
      </div>

      <div className="chips">
        <Link href="/" className={`chip ${!g ? 'on' : ''}`}>Barchasi</Link>
        {genres.map((x) => (
          <Link key={x} href={`/?g=${encodeURIComponent(x)}`} className={`chip ${g === x ? 'on' : ''}`}>{x}</Link>
        ))}
      </div>

      {animes?.length ? (
        <div className="grid">
          {animes.map((a, i) => (
            <Link key={a.id} className="item" style={{ animationDelay: `${Math.min(i, 14) * 50}ms` }}
              href={`/anime/${a.id}`}>
              <div className="poster">
                {a.poster_url ? <img src={a.poster_url} alt={a.title} loading="lazy" /> : a.title.charAt(0)}
              </div>
              <div className="meta">
                <h3>{a.title}</h3>
                <small>{a.year} • {a.status}</small>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty">Hech narsa topilmadi</div>
      )}
    </>
  );
}
