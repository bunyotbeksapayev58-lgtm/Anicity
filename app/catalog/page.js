import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import AnimeCard from '@/components/AnimeCard';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Anime Katalogi — Barcha Animelar | Anicity',
  description: 'Anicity platformasidagi barcha anime seriallar va filmlar to‘liq katalogi. Janr, yil, studio va reyting bo‘yicha filtrlang.',
};

const escapeLike = (s) => s.replace(/[\\%_]/g, '\\$&');

const POPULAR_GENRES = [
  'Action',
  'Sarguzasht',
  'Komediya',
  'Drama',
  'Fantaziya',
  'Romantika',
  'Shounen',
  'Triller',
  'Isekai',
  'Psixologik',
  'Sci-Fi',
  'Supernatural',
];

const POPULAR_STUDIOS = [
  'MAPPA',
  'Ufotable',
  'Madhouse',
  'Wit Studio',
  'Bones',
  'A-1 Pictures',
  'CloverWorks',
  'Toei Animation',
  'Kyoto Animation',
  'CoMix Wave Films',
];

const YEARS = [2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018];

export default async function CatalogPage({ searchParams }) {
  const {
    q = '',
    g = '',
    y = '',
    studio = '',
    status = '',
    sort = 'newest',
    page = '1',
  } = (await searchParams) || {};

  const supabase = await createClient();

  let query = supabase
    .from('animes')
    .select('id, title, alt_title, description, year, status, genres, studio, poster_url, banner_url, rating_avg, view_count, created_at, release_day, fandub_team, episodes(id, number, title)', { count: 'exact' })
    .eq('is_published', true);

  if (q.trim()) {
    query = query.ilike('title', `%${escapeLike(q.trim().slice(0, 100))}%`);
  }
  if (g.trim()) {
    query = query.contains('genres', [g.trim()]);
  }
  if (y.trim()) {
    const parsedYear = parseInt(y.trim(), 10);
    if (!isNaN(parsedYear)) {
      query = query.eq('year', parsedYear);
    }
  }
  if (studio.trim()) {
    query = query.ilike('studio', `%${escapeLike(studio.trim())}%`);
  }
  if (status.trim()) {
    query = query.eq('status', status.trim());
  }

  // Sort
  if (sort === 'rating') {
    query = query.order('rating_avg', { ascending: false }).order('created_at', { ascending: false });
  } else if (sort === 'popular') {
    query = query.order('view_count', { ascending: false }).order('created_at', { ascending: false });
  } else {
    // newest default
    query = query.order('created_at', { ascending: false });
  }

  const pageSize = 24;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const start = (pageNum - 1) * pageSize;
  query = query.range(start, start + pageSize - 1);

  const { data: animesRaw, count } = await query;
  const animes = animesRaw || [];
  const totalCount = count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  // Helper to build filter URL
  function buildFilterUrl(newParams) {
    const current = { q, g, y, studio, status, sort };
    const merged = { ...current, ...newParams, page: 1 };
    const sp = new URLSearchParams();
    Object.entries(merged).forEach(([k, v]) => {
      if (v) sp.set(k, v);
    });
    return `/catalog?${sp.toString()}`;
  }

  return (
    <div className="catalog-page-container">
      {/* Top Banner Header */}
      <div className="catalog-hero-header">
        <h1 className="catalog-page-title">
          🎬 Anime <span className="grad">Katalogi</span>
        </h1>
        <p className="catalog-page-subtitle">
          Barcha fasllar, eng yangi seriyalar va durdona anime filmlari
        </p>
      </div>

      {/* Main Filter Bar (Anibla-style clean control panel) */}
      <div className="catalog-filters-card">
        {/* Search input row */}
        <form className="catalog-filter-search" action="/catalog" method="GET">
          {g && <input type="hidden" name="g" value={g} />}
          {y && <input type="hidden" name="y" value={y} />}
          {studio && <input type="hidden" name="studio" value={studio} />}
          {status && <input type="hidden" name="status" value={status} />}
          {sort && <input type="hidden" name="sort" value={sort} />}
          
          <div className="filter-search-wrap">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              name="q"
              defaultValue={q}
              placeholder="Anime nomini yozing..."
              className="filter-search-input"
            />
          </div>
          <button type="submit" className="btn-filter-submit">Qidirish</button>
        </form>

        {/* Dropdown Filters Row */}
        <div className="filter-dropdowns-row">
          {/* Status Filter */}
          <div className="filter-group">
            <label className="filter-label">Holati:</label>
            <div className="filter-chips-mini">
              <Link href={buildFilterUrl({ status: '' })} className={`chip-mini ${!status ? 'active' : ''}`}>
                Hammasi
              </Link>
              <Link href={buildFilterUrl({ status: 'Davom etmoqda' })} className={`chip-mini ${status === 'Davom etmoqda' ? 'active' : ''}`}>
                Davom etmoqda
              </Link>
              <Link href={buildFilterUrl({ status: 'Tugallangan' })} className={`chip-mini ${status === 'Tugallangan' ? 'active' : ''}`}>
                Tugallangan
              </Link>
            </div>
          </div>

          {/* Sort Filter */}
          <div className="filter-group">
            <label className="filter-label">Saralash:</label>
            <div className="filter-chips-mini">
              <Link href={buildFilterUrl({ sort: 'newest' })} className={`chip-mini ${sort === 'newest' ? 'active' : ''}`}>
                Eng yangi
              </Link>
              <Link href={buildFilterUrl({ sort: 'popular' })} className={`chip-mini ${sort === 'popular' ? 'active' : ''}`}>
                Mashhur
              </Link>
              <Link href={buildFilterUrl({ sort: 'rating' })} className={`chip-mini ${sort === 'rating' ? 'active' : ''}`}>
                Reyting
              </Link>
            </div>
          </div>
        </div>

        {/* Genres Pill Bar */}
        <div className="filter-genres-block">
          <label className="filter-label">Janrlar:</label>
          <div className="genres-horizontal-scroll">
            <Link href={buildFilterUrl({ g: '' })} className={`genre-tag-chip ${!g ? 'active' : ''}`}>
              Barcha janrlar
            </Link>
            {POPULAR_GENRES.map((genre) => (
              <Link
                key={genre}
                href={buildFilterUrl({ g: g === genre ? '' : genre })}
                className={`genre-tag-chip ${g === genre ? 'active' : ''}`}
              >
                {genre}
              </Link>
            ))}
          </div>
        </div>

        {/* Studio and Year Pills */}
        <div className="filter-extra-row">
          <div className="extra-group">
            <label className="filter-label">Studiyalar:</label>
            <div className="extra-chips-list">
              <Link href={buildFilterUrl({ studio: '' })} className={`chip-micro ${!studio ? 'active' : ''}`}>
                Barchasi
              </Link>
              {POPULAR_STUDIOS.map((st) => (
                <Link
                  key={st}
                  href={buildFilterUrl({ studio: studio === st ? '' : st })}
                  className={`chip-micro ${studio === st ? 'active' : ''}`}
                >
                  {st}
                </Link>
              ))}
            </div>
          </div>

          <div className="extra-group">
            <label className="filter-label">Yillar:</label>
            <div className="extra-chips-list">
              <Link href={buildFilterUrl({ y: '' })} className={`chip-micro ${!y ? 'active' : ''}`}>
                Barchasi
              </Link>
              {YEARS.map((yr) => (
                <Link
                  key={yr}
                  href={buildFilterUrl({ y: y === String(yr) ? '' : String(yr) })}
                  className={`chip-micro ${y === String(yr) ? 'active' : ''}`}
                >
                  {yr}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Active Filters Clear Button */}
        {(q || g || y || studio || status || sort !== 'newest') && (
          <div className="clear-filters-wrap">
            <Link href="/catalog" className="btn-clear-filters">
              ✕ Barcha filtrlarni tozalash
            </Link>
          </div>
        )}
      </div>

      {/* Catalog Results Header */}
      <div className="catalog-results-header">
        <h2 className="results-count-text">
          Topilgan animelar: <span className="highlight-count">{totalCount}</span> ta
        </h2>
      </div>

      {/* Anime Grid */}
      {animes.length > 0 ? (
        <div className="anime-catalog-grid">
          {animes.map((anime, i) => (
            <div key={anime.id} className="catalog-grid-item">
              <AnimeCard anime={anime} priority={i < 8} />
            </div>
          ))}
        </div>
      ) : (
        <div className="catalog-empty-state">
          <div className="empty-icon">🔍</div>
          <h3 className="empty-title">Hech qanday anime topilmadi</h3>
          <p className="empty-desc">
            Qidiruv mezonlarini o‘zgartiring yoki filtrlarni tozalang.
          </p>
          <Link href="/catalog" className="btn-hero-primary" style={{ marginTop: 16 }}>
            Barcha animelarga qaytish
          </Link>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination-bar">
          {pageNum > 1 && (
            <Link
              href={buildFilterUrl({ page: pageNum - 1 })}
              className="page-btn prev"
            >
              ← Oldingi
            </Link>
          )}
          <span className="page-indicator">
            Sahifa {pageNum} / {totalPages}
          </span>
          {pageNum < totalPages && (
            <Link
              href={buildFilterUrl({ page: pageNum + 1 })}
              className="page-btn next"
            >
              Keyingi →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
