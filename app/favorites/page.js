import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sevimlilar — Anicity' };

export default async function FavoritesPage() {
  const supabase = await createClient();
  const { data: favs } = await supabase
    .from('favorites')
    .select('created_at, animes(id, title, year, status, poster_url)')
    .order('created_at', { ascending: false });
  const list = (favs || []).filter((f) => f.animes);

  return (
    <>
      <h1 className="grad" style={{ fontSize: 26, marginBottom: 20 }}>Sevimlilar</h1>
      {list.length ? (
        <div className="grid">
          {list.map(({ animes: a }) => (
            <Link key={a.id} className="item" href={`/anime/${a.id}`}>
              <div className="poster">{a.poster_url ? <img src={a.poster_url} alt="" /> : a.title.charAt(0)}</div>
              <div className="meta"><h3>{a.title}</h3><small>{a.year} • {a.status}</small></div>
            </Link>
          ))}
        </div>
      ) : <div className="empty">Hali sevimli anime yo‘q</div>}
    </>
  );
}
