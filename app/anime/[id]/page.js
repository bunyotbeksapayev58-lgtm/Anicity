import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { toggleFavorite } from '@/app/actions/favorites';
import AnimeRow from '@/components/AnimeRow';
import TrailersClips from '@/components/TrailersClips';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: anime } = await supabase.from('animes').select('title, description, poster_url').eq('id', id).single();
  if (!anime) return { title: 'Anime topilmadi — Anicity' };
  return {
    title: `${anime.title} — Anicity`,
    description: anime.description?.slice(0, 160) || 'Anicity platformasida tomosha qiling',
    openGraph: {
      title: `${anime.title} — Anicity`,
      description: anime.description?.slice(0, 160),
      images: anime.poster_url ? [{ url: anime.poster_url }] : [],
    },
  };
}

export default async function AnimeDetailsPage({ params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch Anime details
  const { data: anime } = await supabase
    .from('animes')
    .select('*, episodes(id, number, title, thumbnail_url, is_published)')
    .eq('id', id)
    .single();

  if (!anime) notFound();

  const episodes = [...(anime.episodes || [])].sort((a, b) => a.number - b.number);

  // Check Favorites
  const fav = user
    ? (await supabase.from('favorites').select('anime_id').eq('user_id', user.id).eq('anime_id', id).maybeSingle()).data
    : null;
  const isFav = !!fav;

  // Check Watch Progress
  const { data: progress } = user
    ? await supabase.from('watch_progress').select('episode_id, completed, position_sec, duration_sec').eq('anime_id', id)
    : { data: [] };
  const progMap = new Map((progress || []).map((p) => [p.episode_id, p]));

  // Resume episode
  const resume = (progress || []).length
    ? episodes.find((e) => progMap.get(e.id) && !progMap.get(e.id).completed)
    : null;
  const targetEpisode = resume ?? episodes[0];

  // Fetch Trailer for this anime
  const { data: trailers } = await supabase
    .from('trailers')
    .select('id, anime_id, title, description, video_url, thumbnail_url, duration_text, clip_type')
    .eq('anime_id', id)
    .eq('is_active', true);

  // Fetch Recommended / Similar Animes
  const { data: relatedAnimes } = await supabase
    .from('animes')
    .select('id, title, year, poster_url, rating_avg, status, genres, episodes(id, number, title)')
    .neq('id', id)
    .limit(8);

  const backdropImage = anime.banner_url || anime.poster_url;
  const watchUrl = user
    ? (targetEpisode ? `/watch/${id}/${targetEpisode.number}` : '#')
    : (targetEpisode ? `/login?next=/watch/${id}/${targetEpisode.number}` : `/login?next=/anime/${id}`);

  return (
    <div className="anime-details-page-pro">
      {/* 1. Cinematic Backdrop */}
      <div className="details-hero-backdrop-wrap">
        <div
          className="details-hero-backdrop-img"
          style={{ backgroundImage: `url(${backdropImage})` }}
        />
        <div className="details-backdrop-overlay-left" />
        <div className="details-backdrop-overlay-bottom" />
      </div>

      <div className="details-container-pro">
        <Link href="/" className="btn-back-pro">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span>Orqaga</span>
        </Link>

        {/* 2. Main Two-Column Showcase */}
        <div className="details-showcase-grid">
          {/* Left Column: Poster */}
          <div className="details-poster-col">
            <div className="details-poster-card">
              {anime.poster_url ? (
                <img src={anime.poster_url} alt={anime.title} className="details-poster-img" />
              ) : (
                <div className="details-poster-fallback">{anime.title.charAt(0)}</div>
              )}
              {Number(anime.rating_avg) > 0 && (
                <div className="details-rating-badge">
                  ★ {Number(anime.rating_avg).toFixed(1)} / 10
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Information */}
          <div className="details-info-col">
            <div className="details-tags-pills">
              <span className="info-pill quality">4K ULTRA HD</span>
              <span className="info-pill status">{anime.status || 'Tugallangan'}</span>
              <span className="info-pill year">{anime.year}</span>
              <span className="info-pill eps">{episodes.length} ta qism</span>
            </div>

            <h1 className="details-title">{anime.title}</h1>
            {anime.alt_title && <h2 className="details-alt-title">{anime.alt_title}</h2>}

            {/* Genres */}
            {anime.genres && anime.genres.length > 0 && (
              <div className="details-genres-list">
                {anime.genres.map((g) => (
                  <Link key={g} href={`/?g=${encodeURIComponent(g)}`} className="details-genre-chip">
                    {g}
                  </Link>
                ))}
              </div>
            )}

            {/* Synopsis */}
            <p className="details-synopsis">
              {anime.description || 'Ushbu anime uchun hali tavsif kiritilmagan.'}
            </p>

            {/* Meta Table */}
            <div className="details-meta-specs">
              {anime.studio && (
                <div className="meta-spec-item">
                  <span className="spec-label">Studiya:</span>
                  <span className="spec-val">{anime.studio}</span>
                </div>
              )}
              {anime.director && (
                <div className="meta-spec-item">
                  <span className="spec-label">Rejissyor:</span>
                  <span className="spec-val">{anime.director}</span>
                </div>
              )}
              <div className="meta-spec-item">
                <span className="spec-label">Davomiyligi:</span>
                <span className="spec-val">{episodes.length} qism</span>
              </div>
              <div className="meta-spec-item">
                <span className="spec-label">Ovoz:</span>
                <span className="spec-val">Asl yaponcha / O‘zbekcha subtitr</span>
              </div>
            </div>

            {/* Primary Action Buttons */}
            <div className="details-cta-buttons">
              {targetEpisode && (
                <Link href={watchUrl} className="btn-hero-primary">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  <span>
                    {user ? (resume ? `${resume.number}-qismni davom ettirish` : 'Tomosha qilish') : 'Tomosha qilish'}
                  </span>
                  {!user && <span className="btn-lock-indicator">🔒</span>}
                </Link>
              )}

              {user ? (
                <form action={toggleFavorite}>
                  <input type="hidden" name="animeId" value={id} />
                  <input type="hidden" name="isFav" value={String(isFav)} />
                  <button className={`btn-fav-pro ${isFav ? 'active' : ''}`}>
                    <span className="fav-heart">{isFav ? '❤️' : '🤍'}</span>
                    <span>{isFav ? 'Sevimlilardan o‘chirish' : 'Sevimlilarga qo‘shish'}</span>
                  </button>
                </form>
              ) : (
                <Link href={`/login?next=/anime/${id}`} className="btn-fav-pro">
                  <span className="fav-heart">🤍</span>
                  <span>Sevimlilarga qo‘shish</span>
                </Link>
              )}
            </div>

            {!user && (
              <div className="guest-watch-alert">
                <span className="alert-icon">🛡️</span>
                <span>
                  <strong>Diqqat:</strong> Filmni to‘liq tomosha qilish uchun hisobingizga kiring yoki bepul ro‘yxatdan o‘ting.
                </span>
                <Link href={`/login?next=/anime/${id}`} className="alert-login-link">
                  Kirish →
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* 3. Episodes Grid Section */}
        <section className="details-episodes-section">
          <div className="episodes-header-bar">
            <div>
              <h2 className="section-title-pro">Epizodlar va Qismlar</h2>
              <p className="section-subtitle-pro">Tomosha qilish uchun kerakli qismni tanlang</p>
            </div>
            <span className="episodes-counter-badge">{episodes.length} ta mavjud</span>
          </div>

          <div className="episodes-pro-grid">
            {episodes.map((ep) => {
              const p = progMap.get(ep.id);
              const href = user ? `/watch/${id}/${ep.number}` : `/login?next=/watch/${id}/${ep.number}`;
              const isFinished = p?.completed;
              const hasProgress = !isFinished && p?.duration_sec && p?.position_sec > 0;
              const pct = hasProgress ? Math.min(100, (p.position_sec / p.duration_sec) * 100) : 0;

              return (
                <Link key={ep.id} href={href} className={`episode-card-pro ${isFinished ? 'watched' : ''}`}>
                  <div className="episode-thumbnail-wrap">
                    <img
                      src={ep.thumbnail_url || anime.banner_url || anime.poster_url || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&auto=format&fit=crop'}
                      alt={ep.title}
                      className="episode-thumb-img"
                      loading="lazy"
                    />
                    <div className="episode-play-icon">
                      {user ? (
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      ) : (
                        <span className="episode-lock-icon">🔒</span>
                      )}
                    </div>
                    {isFinished && <div className="episode-badge-completed">✓ Ko‘rildi</div>}
                    {hasProgress && (
                      <div className="episode-progress-bar">
                        <div className="ep-progress-fill" style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </div>
                  <div className="episode-info-pane">
                    <span className="episode-num-label">{ep.number}-qism</span>
                    <h3 className="episode-title-label">{ep.title || `${ep.number}-qism`}</h3>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* 4. Trailer section if exists */}
        {trailers && trailers.length > 0 && (
          <TrailersClips trailers={trailers.map((t) => ({ ...t, anime }))} />
        )}

        {/* 5. Recommended Animes */}
        {relatedAnimes && relatedAnimes.length > 0 && (
          <AnimeRow
            title="O‘xshash va Tavsiya Etilgan Animelar"
            subtitle="Ushbu animeni yoqtirganlar uchun maxsus tavsiyalar"
            icon="✨"
            items={relatedAnimes}
            viewAllHref="/#catalog"
          />
        )}
      </div>
    </div>
  );
}
