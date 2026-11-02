import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import HeroBanner from '@/components/HeroBanner';
import AnimeRow from '@/components/AnimeRow';
import AnimeCard from '@/components/AnimeCard';
import TrailersClips from '@/components/TrailersClips';

export const dynamic = 'force-dynamic';

const escapeLike = (s) => s.replace(/[\\%_]/g, '\\$&');

export default async function HomePage({ searchParams }) {
  const { q = '', g = '', sort = '' } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // 1. Fetch Active Hero Banners with joined anime details
  const { data: bannersRaw } = await supabase
    .from('banners')
    .select('id, title, subtitle, image_url, link_url, anime_id, sort_order, anime:animes(id, title, description, poster_url, banner_url, genres, rating_avg, year, status, studio)')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  // 2. Fetch Active Trailers & Clips
  const { data: trailersRaw } = await supabase
    .from('trailers')
    .select('id, anime_id, title, description, video_url, thumbnail_url, duration_text, clip_type, sort_order, anime:animes(id, title, poster_url)')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  // 3. User's "Continue Watching" progress
  let continueList = [];
  if (user) {
    const { data: continueRaw } = await supabase
      .from('watch_progress')
      .select('position_sec, duration_sec, updated_at, episodes(number, title, anime_id, animes(id, title, poster_url))')
      .eq('user_id', user.id)
      .eq('completed', false)
      .order('updated_at', { ascending: false })
      .limit(10);
    continueList = (continueRaw || []).filter((r) => r.episodes?.animes);
  }

  // 4. Fetch All Animes for catalog & sections
  let catalogQuery = supabase
    .from('animes')
    .select('id, title, alt_title, description, year, status, genres, studio, poster_url, banner_url, rating_avg, view_count, created_at, episodes(id, number, title)')
    .eq('is_published', true);

  if (q) {
    catalogQuery = catalogQuery.ilike('title', `%${escapeLike(q.slice(0, 100))}%`);
  }
  if (g) {
    catalogQuery = catalogQuery.contains('genres', [g.slice(0, 50)]);
  }

  if (sort === 'rating') {
    catalogQuery = catalogQuery.order('rating_avg', { ascending: false });
  } else if (sort === 'popular') {
    catalogQuery = catalogQuery.order('view_count', { ascending: false });
  } else {
    catalogQuery = catalogQuery.order('created_at', { ascending: false });
  }

  const { data: catalogAnimes } = await catalogQuery;

  // 5. Get all available genres
  const { data: genreRows } = await supabase.from('animes').select('genres').eq('is_published', true);
  const allGenres = [...new Set((genreRows || []).flatMap((a) => a.genres || []))].sort();

  // 6. Section Categorizations
  const allAnimes = catalogAnimes || [];
  const trendingList = [...allAnimes].sort((a, b) => (Number(b.view_count) || 0) - (Number(a.view_count) || 0));
  const topRatedList = [...allAnimes].sort((a, b) => (Number(b.rating_avg) || 0) - (Number(a.rating_avg) || 0));
  const recentList = [...allAnimes].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const recommendedList = [...allAnimes].sort(() => 0.5 - Math.random());

  const isFiltering = Boolean(q || g);
  const fallbackAnime = allAnimes[0] || null;

  return (
    <div className="home-container-pro">
      {/* 1. Cinematic Hero Banner (when not searching/filtering) */}
      {!isFiltering && (
        <HeroBanner
          banners={bannersRaw || []}
          fallbackAnime={fallbackAnime}
          user={user}
        />
      )}

      {/* 2. User Continue Watching (if logged in and has progress) */}
      {continueList.length > 0 && !isFiltering && (
        <section className="continue-watching-section">
          <div className="row-header">
            <div className="row-title-group">
              <span className="row-title-icon">🍿</span>
              <div>
                <h2 className="row-title-text">Davom ettirish</h2>
                <p className="row-subtitle-text">Ko‘rishni to‘xtagan joyingizdan bir zumda davom eting</p>
              </div>
            </div>
          </div>
          <div className="continue-grid">
            {continueList.map((r, i) => {
              const a = r.episodes.animes;
              const pct = r.duration_sec ? Math.min(100, (r.position_sec / r.duration_sec) * 100) : 0;
              return (
                <Link
                  key={`${a.id}-${r.episodes.number}`}
                  href={`/watch/${a.id}/${r.episodes.number}`}
                  className="continue-card-pro"
                >
                  <div className="continue-thumb-wrap">
                    {a.poster_url ? (
                      <img src={a.poster_url} alt={a.title} className="continue-thumb-img" />
                    ) : (
                      <div className="continue-fallback">{a.title?.charAt(0)}</div>
                    )}
                    <div className="continue-play-icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                    <div className="continue-progress-bar">
                      <div className="progress-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="continue-info">
                    <h3 className="continue-title">{a.title}</h3>
                    <span className="continue-ep">{r.episodes.number}-qism</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* 3. Section Rows (when not actively searching) */}
      {!isFiltering && (
        <>
          {/* Trending */}
          <AnimeRow
            title="Trenddagi Animelar"
            subtitle="Eng ko‘p tomosha qilinayotgan va muhokama qilinayotgan seriallar"
            icon="🔥"
            items={trendingList}
            viewAllHref="/#catalog"
          />

          {/* Trailers & Clips */}
          <TrailersClips trailers={trailersRaw || []} />

          {/* Recently Added */}
          <AnimeRow
            title="Yangi Qo‘shilgan Animelar"
            subtitle="Platformaga yaqinda qo‘shilgan eng so‘nggi premyeralar"
            icon="✨"
            items={recentList}
            viewAllHref="/#catalog"
          />

          {/* Top Rated */}
          <AnimeRow
            title="Eng Yuqori Baholanganlar"
            subtitle="Tomoshabinlar va tanqidchilar tomonidan yuqori baholangan durdonalar"
            icon="⭐"
            items={topRatedList}
            viewAllHref="/#catalog"
          />

          {/* Recommended for You */}
          <AnimeRow
            title="Sizga Tavsiya Etiladi"
            subtitle="Anicity muharrirlari tomonidan tanlab olingan sara filmlar"
            icon="🎯"
            items={recommendedList}
            viewAllHref="/#catalog"
          />
        </>
      )}

      {/* 4. Full Catalog & Genre Explorer */}
      <section id="catalog" className="catalog-section-pro">
        <div className="catalog-header-bar">
          <div>
            <h2 className="catalog-heading">
              {q ? `“${q}” bo‘yicha qidiruv natijalari` : g ? `“${g}” janridagi animelar` : 'To‘liq Anime Katalogi'}
            </h2>
            <p className="catalog-subheading">
              {allAnimes.length} ta anime mavjud
            </p>
          </div>

          {/* Inline Filter Tools */}
          <div className="catalog-filters-group">
            <form className="catalog-search-form">
              {g && <input type="hidden" name="g" value={g} />}
              <div className="search-input-wrapper">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  name="q"
                  defaultValue={q}
                  placeholder="Katalogdan qidirish..."
                  className="catalog-search-field"
                />
              </div>
            </form>
          </div>
        </div>

        {/* Genre Filter Chips */}
        <div id="genres" className="genre-chips-container">
          <Link href="/#catalog" className={`genre-chip ${!g ? 'active' : ''}`}>
            Barchasi
          </Link>
          {allGenres.map((genre) => (
            <Link
              key={genre}
              href={`/?g=${encodeURIComponent(genre)}#catalog`}
              className={`genre-chip ${g === genre ? 'active' : ''}`}
            >
              {genre}
            </Link>
          ))}
        </div>

        {/* Grid display */}
        {allAnimes.length > 0 ? (
          <div className="anime-catalog-grid">
            {allAnimes.map((anime, i) => (
              <div key={anime.id} className="catalog-grid-item" style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}>
                <AnimeCard anime={anime} priority={i < 8} />
              </div>
            ))}
          </div>
        ) : (
          <div className="catalog-empty-state">
            <div className="empty-icon">🔍</div>
            <h3 className="empty-title">Hech qanday anime topilmadi</h3>
            <p className="empty-desc">
              Boshqa so‘z yoki boshqa janr tanlab ko‘ring.
            </p>
            <Link href="/" className="btn-hero-primary" style={{ marginTop: 16 }}>
              Barcha animelarga qaytish
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
