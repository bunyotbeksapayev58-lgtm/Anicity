import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import Player from '@/components/Player';
import { toggleEpisodeCompleted } from '@/app/actions/progress';
import { isDriveUrl } from '@/lib/drive';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const { animeId, num } = await params;
  const supabase = await createClient();
  const { data: anime } = await supabase.from('animes').select('title').eq('id', animeId).single();
  return {
    title: anime ? `${anime.title} — ${num}-qism — Anicity` : 'Tomosha — Anicity',
    description: anime ? `${anime.title} serialining ${num}-qismini yuqori sifatda tomosha qiling.` : 'Anicity anime streaming',
  };
}

export default async function WatchPage({ params }) {
  const { animeId, num } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/watch/${animeId}/${num}`);
  }

  // Fetch full anime details and episodes
  const { data: anime } = await supabase
    .from('animes')
    .select('id, title, alt_title, description, poster_url, banner_url, year, status, studio, genres, rating_avg, episodes(id, season_number, number, title, video_url, thumbnail_url, quality, is_published)')
    .eq('id', animeId)
    .single();

  if (!anime) notFound();

  const episodes = [...(anime.episodes || [])]
    .filter((e) => e.is_published !== false)
    .sort((a, b) => a.number - b.number);

  const ep = episodes.find((e) => e.number === Number(num));
  if (!ep) notFound();

  // Watch progress map
  const { data: progress } = await supabase
    .from('watch_progress')
    .select('episode_id, position_sec, completed')
    .eq('anime_id', animeId);

  const progMap = new Map((progress || []).map((p) => [p.episode_id, p]));
  const saved = progMap.get(ep.id);
  const isCompleted = Boolean(saved?.completed);

  const prev = episodes.find((e) => e.number === ep.number - 1);
  const next = episodes.find((e) => e.number === ep.number + 1);

  const isDrive = Boolean(ep.video_url && isDriveUrl(ep.video_url));

  // Fetch 4 related anime recommendations
  const { data: relatedRaw } = await supabase
    .from('animes')
    .select('id, title, poster_url, year, rating_avg, status')
    .neq('id', animeId)
    .eq('is_published', true)
    .limit(4);
  const relatedAnimes = relatedRaw || [];

  return (
    <div className="watch-page-pro">
      {/* 1. Header Navigation Bar */}
      <div className="watch-nav-header">
        <Link href={`/anime/${animeId}`} className="watch-back-link">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span>{anime.title}</span>
        </Link>
        <span className="watch-ep-pill">
          {ep.number}-qism
        </span>
      </div>

      {/* 2. Main Video Watching Grid Layout */}
      <div className="watch-wrap">
        {/* Left Column: Player, Video Meta, Controls, Info */}
        <div className="watch-main-col">
          {/* Video Player */}
          <div className="player">
            <Player
              src={ep.video_url}
              userId={user?.id}
              animeId={animeId}
              episodeId={ep.id}
              startAt={!isDrive && saved && !saved.completed ? saved.position_sec : 0}
              nextHref={next ? `/watch/${animeId}/${next.number}` : null}
              animeTitle={anime.title}
              episodeTitle={ep.title || `${ep.number}-qism`}
            />
          </div>

          {/* Under-player Meta and Actions */}
          <div className="watch-under-player-box">
            <div className="watch-title-meta">
              <h1 className="watch-main-title">
                {anime.title} — {ep.title || `${ep.number}-qism`}
              </h1>
              <div className="watch-badges-row">
                <span className="badge-quality">{ep.quality || '1080p Full HD'}</span>
                {anime.year && <span className="badge-year">{anime.year}</span>}
                {anime.status && <span className="badge-status">{anime.status}</span>}
                {anime.rating_avg && Number(anime.rating_avg) > 0 && (
                  <span className="badge-rating">⭐ {Number(anime.rating_avg).toFixed(1)}</span>
                )}
              </div>
            </div>

            {/* Action Buttons: Mark watched, Prev, Next */}
            <div className="watch-actions-bar">
              {user && (
                <form action={toggleEpisodeCompleted} style={{ display: 'inline' }}>
                  <input type="hidden" name="animeId" value={animeId} />
                  <input type="hidden" name="episodeId" value={ep.id} />
                  <input type="hidden" name="completed" value={String(isCompleted)} />
                  <button
                    type="submit"
                    className={`btn sm ${isCompleted ? 'ghost' : 'primary'} watch-action-btn`}
                    title="Ko‘rilganlik holatini o‘zgartirish"
                  >
                    {isCompleted ? '✓ Ko‘rilgan (Bekor qilish)' : '👁️ Ko‘rildi deb belgilash'}
                  </button>
                </form>
              )}

              <div className="watch-nav-btns-group">
                {prev ? (
                  <Link
                    href={`/watch/${animeId}/${prev.number}`}
                    className="btn ghost sm watch-nav-btn"
                    title={`Oldingi qism: ${prev.number}-qism`}
                  >
                    ◀ Oldingi
                  </Link>
                ) : (
                  <button className="btn ghost sm watch-nav-btn disabled" disabled aria-disabled="true" title="Oldingi qism mavjud emas">
                    ◀ Oldingi
                  </button>
                )}

                {next ? (
                  <Link
                    href={`/watch/${animeId}/${next.number}`}
                    className="btn primary sm watch-nav-btn"
                    title={`Keyingi qism: ${next.number}-qism`}
                  >
                    Keyingi ▶
                  </Link>
                ) : (
                  <button className="btn ghost sm watch-nav-btn disabled" disabled aria-disabled="true" title="Keyingi qism mavjud emas">
                    Keyingi ▶
                  </button>
                )}
              </div>
            </div>

            {/* Google Drive Watching Note */}
            {isDrive && (
              <div className="watch-drive-note">
                💡 <span>Google Drive player: Tomoshani yakunlagach, yuqoridagi <b>“Ko‘rildi deb belgilash”</b> tugmasini bosing.</span>
              </div>
            )}
          </div>

          {/* Mobile-Only Horizontal Episode Selector (Visible <= 1024px) */}
          <div className="watch-mobile-episodes-wrap">
            <div className="episodes-header-row">
              <h3 className="episodes-section-title">📺 Qismlar ({episodes.length})</h3>
              <span className="episodes-count-hint">Joriy: {ep.number}-qism</span>
            </div>
            <div className="mobile-episodes-scroll-track">
              {episodes.map((e) => {
                const isCurrent = e.id === ep.id;
                const p = progMap.get(e.id);
                return (
                  <Link
                    key={e.id}
                    href={`/watch/${animeId}/${e.number}`}
                    className={`mobile-ep-chip ${isCurrent ? 'active' : ''} ${p?.completed ? 'completed' : ''}`}
                  >
                    <span className="ep-chip-num">{e.number}</span>
                    {p?.completed && <span className="ep-chip-check">✓</span>}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Anime Synopsis and Details Card */}
          <div className="watch-info-card">
            <h3 className="watch-card-title">📖 Anime haqida</h3>
            <p className="watch-synopsis-text">
              {anime.description || 'Ushbu anime uchun qisqacha tavsif kiritilmagan.'}
            </p>

            {anime.genres && anime.genres.length > 0 && (
              <div className="watch-genres-row">
                {anime.genres.map((g) => (
                  <span key={g} className="watch-genre-pill">{g}</span>
                ))}
              </div>
            )}

            <div className="watch-specs-grid">
              {anime.studio && (
                <div className="spec-item">
                  <span className="spec-label">Studio:</span>
                  <span className="spec-val">{anime.studio}</span>
                </div>
              )}
              {anime.year && (
                <div className="spec-item">
                  <span className="spec-label">Yil:</span>
                  <span className="spec-val">{anime.year}</span>
                </div>
              )}
              <div className="spec-item">
                <span className="spec-label">Jami qismlar:</span>
                <span className="spec-val">{episodes.length} ta qism</span>
              </div>
            </div>
          </div>

          {/* Related Anime Recommendations */}
          {relatedAnimes.length > 0 && (
            <div className="watch-related-section">
              <h3 className="watch-card-title">🔥 Sizga yoqishi mumkin</h3>
              <div className="watch-related-grid">
                {relatedAnimes.map((rel) => (
                  <Link key={rel.id} href={`/anime/${rel.id}`} className="related-anime-card">
                    <div className="related-thumb-wrap">
                      <img
                        src={rel.poster_url || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=300&q=80'}
                        alt={rel.title}
                        loading="lazy"
                        className="related-thumb-img"
                      />
                      {rel.rating_avg && Number(rel.rating_avg) > 0 && (
                        <span className="related-rating-badge">⭐ {Number(rel.rating_avg).toFixed(1)}</span>
                      )}
                    </div>
                    <div className="related-title-wrap">
                      <span className="related-title">{rel.title}</span>
                      <span className="related-year">{rel.year || 'Anime'}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Desktop-Only Side Column: Episodes List */}
        <aside className="watch-side-col">
          <div className="desktop-episodes-panel">
            <div className="episodes-panel-header">
              <h3 className="episodes-panel-title">📺 Qismlar Ro‘yxati</h3>
              <span className="episodes-badge">{episodes.length} ta</span>
            </div>

            <div className="desktop-episodes-list">
              {episodes.map((e) => {
                const isCurrent = e.id === ep.id;
                const p = progMap.get(e.id);
                return (
                  <Link
                    key={e.id}
                    href={`/watch/${animeId}/${e.number}`}
                    className={`desktop-ep-item ${isCurrent ? 'active' : ''}`}
                  >
                    <div className="ep-item-thumb-box">
                      <span className="ep-num-pill">{e.number}</span>
                    </div>
                    <div className="ep-item-info">
                      <b className="ep-item-title">{e.title || `${e.number}-qism`}</b>
                      <span className="ep-item-sub">
                        {e.quality || '1080p HD'} {p?.completed ? '• ✓ Ko‘rilgan' : ''}
                      </span>
                    </div>
                    {isCurrent && <span className="ep-playing-dot">●</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
