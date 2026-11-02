'use client';

import { useRef } from 'react';
import Link from 'next/link';
import AnimeCard from './AnimeCard';

export default function AnimeRow({ title, subtitle, items = [], viewAllHref, icon }) {
  const scrollRef = useRef(null);

  if (!items || items.length === 0) return null;

  const scroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -650 : 650;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <section className="anime-row-section">
      <div className="row-header">
        <div className="row-title-group">
          {icon && <span className="row-title-icon">{icon}</span>}
          <div>
            <h2 className="row-title-text">{title}</h2>
            {subtitle && <p className="row-subtitle-text">{subtitle}</p>}
          </div>
        </div>
        {viewAllHref && (
          <Link href={viewAllHref} className="row-view-all-link">
            <span>Barchasi</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Link>
        )}
      </div>

      <div className="row-carousel-wrap">
        <button
          type="button"
          className="row-arrow left"
          onClick={() => scroll('left')}
          aria-label="Chapga varaqlash"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <div className="row-scroll-container" ref={scrollRef}>
          {items.map((anime, index) => (
            <div key={anime.id || index} className="row-card-item">
              <AnimeCard anime={anime} priority={index < 4} />
            </div>
          ))}
        </div>

        <button
          type="button"
          className="row-arrow right"
          onClick={() => scroll('right')}
          aria-label="O‘ngga varaqlash"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </section>
  );
}
