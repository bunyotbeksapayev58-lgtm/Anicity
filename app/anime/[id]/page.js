import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { toggleFavorite } from '@/app/actions/favorites';

export const dynamic = 'force-dynamic';

export default async function AnimePage({ params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: anime } = await supabase
    .from('animes')
    .select('*, episodes(id, number, title)')
    .eq('id', id)
    .single();
  if (!anime) notFound();

  const episodes = [...anime.episodes].sort((a, b) => a.number - b.number);

  const fav = user
    ? (await supabase.from('favorites').select('anime_id').eq('user_id', user.id).eq('anime_id', id).maybeSingle()).data
    : null;
  const isFav = !!fav;

  const { data: progress } = await supabase
    .from('watch_progress').select('episode_id, completed, position_sec').eq('anime_id', id);
  const progMap = new Map((progress || []).map((p) => [p.episode_id, p]));

  // Eng so'nggi ko'rilgan qism — "Davom ettirish" tugmasi uchun
  const resume = (progress || []).length ? episodes.find((e) => progMap.get(e.id) && !progMap.get(e.id).completed) : null;

  return (
    <>
      <Link href="/" className="back">← Orqaga</Link>
      <div className="detail">
        <div className="poster">
          {anime.poster_url ? <img src={anime.poster_url} alt={anime.title} /> : anime.title.charAt(0)}
        </div>
        <div>
          <h2 className="grad">{anime.title}</h2>
          <div className="muted" style={{ fontSize: 14 }}>
            {anime.year} • {anime.status} • {episodes.length} ta qism
          </div>
          <div style={{ margin: '12px 0' }}>
            {(anime.genres || []).map((g) => <span key={g} className="tag">{g}</span>)}
          </div>
          <p className="desc">{anime.description}</p>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {episodes[0] && (
              <Link className="btn" href={`/watch/${id}/${(resume ?? episodes[0]).number}`}>
                ▶ {resume ? 'Davom ettirish' : 'Tomosha qilish'}
              </Link>
            )}
            {user ? (
              <form action={toggleFavorite}>
                <input type="hidden" name="animeId" value={id} />
                <input type="hidden" name="isFav" value={String(isFav)} />
                <button className="btn ghost">{isFav ? '♥ Sevimlilardan olib tashlash' : '♡ Sevimlilarga qo‘shish'}</button>
              </form>
            ) : (
              <Link href={`/login?next=/anime/${id}`} className="btn ghost">
                ♡ Sevimlilarga qo‘shish
              </Link>
            )}
          </div>

          <h3 style={{ fontSize: 16, marginTop: 26 }}>Qismlar</h3>
          <div className="eps">
            {episodes.map((e) => {
              const p = progMap.get(e.id);
              return (
                <Link key={e.id} href={`/watch/${id}/${e.number}`}
                  className={p?.completed ? 'done' : ''}>
                  {e.title || `${e.number}-qism`}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
