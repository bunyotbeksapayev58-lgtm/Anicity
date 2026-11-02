'use client';

import Link from 'next/link';

export default function AnimeCard({ anime, priority = false }) {
  if (!anime) return null;

  const rating = Number(anime.rating_avg);
  const episodesCount = anime.episodes?.length || (Array.isArray(anime.episodes) ? anime.episodes[0]?.count : 0) || 1;

  return (
    <Link href={`/anime/${anime.id}`} className="anime-card-pro" title={anime.title}>
      <div className="card-poster-wrap">
        {anime.poster_url ? (
          <img
            src={anime.poster_url}
            alt={anime.title}
            className="card-poster-img"
            loading={priority ? 'eager' : 'lazy'}
          />
        ) : (
          <div className="card-poster-fallback">
            <span className="fallback-letter">{anime.title?.charAt(0) || 'A'}</span>
          </div>
        )}

        {/* Top Badges */}
        <div className="card-top-badges">
          {rating > 0 && (
            <span className="badge-rating">
              <span className="star-icon">★</span>
              <span>{rating.toFixed(1)}</span>
            </span>
          )}
          <span className="badge-quality">HD</span>
        </div>

        {/* Hover Quick Action Overlay */}
        <div className="card-hover-overlay">
          <div className="hover-play-btn">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          {anime.description && (
            <p className="hover-synopsis">
              {anime.description.slice(0, 95)}...
            </p>
          )}
          <div className="hover-meta-tags">
            {anime.genres?.slice(0, 2).map((g) => (
              <span key={g} className="hover-tag">{g}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Card Info */}
      <div className="card-info-pane">
        <h3 className="card-title">{anime.title}</h3>
        <div className="card-sub-meta">
          <span className="card-year">{anime.year || '2024'}</span>
          <span className="card-dot">•</span>
          <span className="card-status">{anime.status || 'Tugallangan'}</span>
          <span className="card-dot">•</span>
          <span className="card-eps">{episodesCount} qism</span>
        </div>
      </div>
    </Link>
  );
}
