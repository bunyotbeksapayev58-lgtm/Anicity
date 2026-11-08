'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function AnimeCard({ anime, priority = false }) {
  if (!anime) return null;

  const [imgError, setImgError] = useState(false);
  const rating = Number(anime.rating_avg);
  const episodesCount = anime.episodes?.length || (Array.isArray(anime.episodes) ? anime.episodes[0]?.count : 0) || 1;

  // Robust genre parser (handles arrays, comma-separated, space-separated)
  const genresList = Array.isArray(anime.genres)
    ? anime.genres.flatMap((g) => String(g).split(/[,\s]+/)).map((s) => s.trim()).filter(Boolean)
    : String(anime.genres || '').split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);

  return (
    <Link href={`/anime/${anime.id}`} className="anime-card-pro" title={anime.title}>
      <div className="card-poster-wrap">
        {anime.poster_url && !imgError ? (
          <Image
            src={anime.poster_url}
            alt={anime.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 220px"
            className="card-poster-img"
            priority={priority}
            onError={() => setImgError(true)}
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
            {genresList.slice(0, 2).map((g) => (
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
