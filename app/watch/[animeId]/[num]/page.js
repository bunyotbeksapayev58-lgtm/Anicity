import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import Player from '@/components/Player';
import { toggleEpisodeCompleted } from '@/app/actions/progress';
import { isDriveUrl } from '@/lib/drive';
import { validatePlaybackAccess } from '@/lib/video/secure-delivery';
import { applyAnimeIdentifierFilter } from '@/lib/anime-lookup';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const { animeId, num } = await params;
  const supabase = await createClient();
  const query = applyAnimeIdentifierFilter(supabase.from('animes').select('title'), animeId);
  const { data: anime } = await query.maybeSingle();
  if (!anime) notFound();
  return {
    title: anime ? `${anime.title} — ${num}-qism — Anicity` : 'Tomosha — Anicity',
    description: anime ? `${anime.title} serialining ${num}-qismini yuqori sifatda tomosha qiling.` : 'Anicity anime streaming',
  };
}

export default async function WatchPage({ params }) {
  const { animeId, num } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Guest viewing enabled for free episodes

  // Fetch full anime details and episodes (resolves UUID or slug safely without non-existent DB column crash)
  const query = applyAnimeIdentifierFilter(
    supabase
      .from('animes')
      .select('id, title, alt_title, description, poster_url, banner_url, year, status, studio, genres, rating_avg, is_vip_only, created_at, episodes(id, season_number, number, title, thumbnail_url, quality, is_published, requires_vip)'),
    animeId
  );
  const { data: anime } = await query.maybeSingle();

  if (!anime) notFound();

  const episodes = [...(anime.episodes || [])]
    .filter((e) => e.is_published !== false)
    .sort((a, b) => a.number - b.number);

  const ep = episodes.find((e) => e.number === Number(num));
  if (!ep) notFound();

  // Server-Side VIP & Access Verification on Watch page
  const isVipRequired = Boolean(
    ep.requires_vip === true ||
    ep.quality === '4K' ||
    anime.is_vip_only === true
  );

  if (isVipRequired && !user) {
    redirect('/premium?vip_required=true&next=/watch/' + anime.id + '/' + num);
  }

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, suspended_at')
      .eq('id', user.id)
      .maybeSingle();

    const { data: subsRaw } = await supabase
      .from('user_subscriptions')
      .select('id, plan_name, status, starts_at, expires_at')
      .eq('user_id', user.id);

    const access = validatePlaybackAccess({
      user,
      profile,
      episode: {
        ...ep,
        requires_vip: ep.requires_vip ?? false,
        animes: {
          ...anime,
          is_vip_only: anime.is_vip_only ?? false,
        },
      },
      subscriptions: subsRaw || [],
    });

    if (!access.allowed) {
      if (access.code === 'VIP_REQUIRED') {
        redirect(`/premium?vip_required=true&next=/watch/${anime.id}/${num}`);
      }
      if (access.code === 'USER_SUSPENDED') {
        redirect('/?suspended=true');
      }
      notFound();
    }
  }

  // Retrieve video_url server-side using service-role after access verification (avoids anon column RLS block)
  let videoUrl = null;
  const adminClient = createAdminClient();
  if (adminClient) {
    const { data: epVideo } = await adminClient
      .from('episodes')
      .select('video_url')
      .eq('id', ep.id)
      .maybeSingle();
    videoUrl = epVideo?.video_url || null;
  } else if (user) {
    const { data: epVideo } = await supabase
      .from('episodes')
      .select('video_url')
      .eq('id', ep.id)
      .maybeSingle();
    videoUrl = epVideo?.video_url || null;
  }
  ep.video_url = videoUrl;

  // Watch progress map (for logged-in users)
  let progMap = new Map();
  let saved = null;
  if (user) {
    const { data: progress } = await supabase
      .from('watch_progress')
      .select('episode_id, position_sec, completed')
      .eq('anime_id', anime.id)
      .eq('user_id', user.id);
    progMap = new Map((progress || []).map((p) => [p.episode_id, p]));
    saved = progMap.get(ep.id);
  }
  const isCompleted = Boolean(saved?.completed);

  const prev = episodes.find((e) => e.number === ep.number - 1);
  const next = episodes.find((e) => e.number === ep.number + 1);

  const isDrive = Boolean(ep.video_url && isDriveUrl(ep.video_url));

  // Fetch 4 related anime recommendations
  const { data: relatedRaw } = await supabase
    .from('animes')
    .select('id, title, poster_url, year, rating_avg, status')
    .neq('id', anime.id)
    .eq('is_published', true)
    .limit(4);
  const relatedAnimes = relatedRaw || [];

  const episodeJsonLd = {
    '@context': 'https://schema.org',
    '@type': ['TVEpisode', 'VideoObject'],
    name: ep.title || `${anime.title} ${ep.number}-qism`,
    episodeNumber: ep.number,
    partOfSeries: {
      '@type': 'TVSeries',
      name: anime.title,
    },
    thumbnailUrl: ep.thumbnail_url || anime.banner_url || anime.poster_url,
    uploadDate: anime.created_at,
    description: anime.description?.slice(0, 200),
  };

  return (
    <div className="watch-page-pro">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(episodeJsonLd).replace(/</g, '\\u003c') }}
      />
      {/* 1. Header Navigation Bar */}
      <div className="watch-nav-header">
        <Link href={`/anime/${anime.id}`} className="watch-back-link">
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
              animeId={anime.id}
              episodeId={ep.id}
              startAt={!isDrive && saved && !saved.completed ? saved.position_sec : 0}
              nextHref={next ? `/watch/${anime.id}/${next.number}` : null}
              animeTitle={anime.title}
              episodeTitle={ep.title || `${ep.number}-qism`}
            />
          </div>

          {!user && (
            <div className="watch-guest-banner" style={{ background: 'rgba(108, 92, 231, 0.1)', border: '1px solid rgba(108, 92, 231, 0.25)', borderRadius: '12px', padding: '12px 16px', margin: '14px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#c4b5fd' }}>
                <span>💡</span>
                <span>Siz mehmon rejimida tomosha qilmoqdasiz. Ko‘rish tarixini saqlash va fikr bildirish uchun tizimga kiring.</span>
              </div>
              <Link href={`/login?next=/watch/${anime.id}/${ep.number}`} className="btn ghost sm" style={{ padding: '5px 12px', fontSize: '12px' }}>
                Kirish / Ro‘yxatdan o‘tish
              </Link>
            </div>
          )}

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
                  <input type="hidden" name="animeId" value={anime.id} />
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
                    href={`/watch/${anime.id}/${prev.number}`}
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
                    href={`/watch/${anime.id}/${next.number}`}
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
                    href={`/watch/${anime.id}/${e.number}`}
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
                    href={`/watch/${anime.id}/${e.number}`}
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
