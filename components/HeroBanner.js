'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

export default function HeroBanner({ banners = [], fallbackAnime, user, onWatchTrailer }) {
  const [index, setIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  // If no custom banners in database, fallback to fallbackAnime
  const slides = banners.length > 0 ? banners : fallbackAnime ? [{
    id: fallbackAnime.id,
    title: fallbackAnime.title,
    subtitle: fallbackAnime.description,
    image_url: fallbackAnime.banner_url || fallbackAnime.poster_url,
    link_url: `/anime/${fallbackAnime.id}`,
    anime_id: fallbackAnime.id,
    anime: fallbackAnime
  }] : [];

  const total = slides.length;

  useEffect(() => {
    if (total <= 1 || isPaused) return;
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % total);
    }, 6500);
    return () => clearInterval(timer);
  }, [total, isPaused]);

  const handlePrev = () => {
    setIndex((prev) => (prev - 1 + total) % total);
  };

  const handleNext = () => {
    setIndex((prev) => (prev + 1) % total);
  };

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 50) {
      if (diff > 0) handleNext();
      else handlePrev();
    }
  };

  if (!slides.length) return null;

  const current = slides[index];
  const anime = current.anime;
  const animeId = current.anime_id || anime?.id;
  const watchHref = animeId ? (user ? `/watch/${animeId}/1` : `/login?next=/watch/${animeId}/1`) : (current.link_url || '#');
  const detailHref = animeId ? `/anime/${animeId}` : (current.link_url || '#');

  return (
    <section
      className="hero-pro-section"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Background Slides */}
      <div className="hero-pro-backdrop-container">
        {slides.map((slide, i) => (
          <div
            key={slide.id || i}
            className={`hero-pro-backdrop ${i === index ? 'active' : ''}`}
            style={{ backgroundImage: `url(${slide.image_url || slide.anime?.banner_url || slide.anime?.poster_url})` }}
          />
        ))}
        {/* Cinematic Vignette Overlays */}
        <div className="hero-gradient-overlay-left" />
        <div className="hero-gradient-overlay-bottom" />
        <div className="hero-gradient-overlay-radial" />
      </div>

      {/* Main Content Info */}
      <div className="hero-pro-content">
        <div className="hero-pro-inner">
          {/* Metadata badges */}
          <div className="hero-badges-row">
            <span className="hero-pill-badge quality">4K ULTRA HD</span>
            {anime?.rating_avg && Number(anime.rating_avg) > 0 && (
              <span className="hero-pill-badge rating">
                ⭐ {Number(anime.rating_avg).toFixed(1)}
              </span>
            )}
            {anime?.year && (
              <span className="hero-pill-badge year">{anime.year}</span>
            )}
            <span className="hero-pill-badge status">{anime?.status || 'Mashhur'}</span>
            {anime?.studio && (
              <span className="hero-pill-badge studio">{anime.studio}</span>
            )}
          </div>

          {/* Title */}
          <h1 className="hero-pro-title">
            {current.title}
          </h1>

          {/* Subtitle / Description */}
          <p className="hero-pro-desc">
            {current.subtitle || anime?.description || 'Tomosha qilish uchun ajoyib anime to‘plami.'}
          </p>

          {/* Genres row */}
          {anime?.genres && anime.genres.length > 0 && (
            <div className="hero-genres-row">
              {anime.genres.slice(0, 4).map((g) => (
                <span key={g} className="hero-genre-tag">{g}</span>
              ))}
            </div>
          )}

          {/* CTA Buttons */}
          <div className="hero-actions-row">
            <Link href={watchHref} className="btn-hero-primary">
              <span className="btn-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
              <span>Hozir tomosha qilish</span>
            </Link>

            <Link href={detailHref} className="btn-hero-secondary">
              <span className="btn-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              </span>
              <span>Batafsil ma’lumot</span>
            </Link>

            {onWatchTrailer && (
              <button
                type="button"
                onClick={() => onWatchTrailer(animeId || current.id)}
                className="btn-hero-trailer"
                title="Treylerni ko‘rish"
              >
                <span className="btn-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
                    <line x1="7" y1="2" x2="7" y2="22" />
                    <line x1="17" y1="2" x2="17" y2="22" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <line x1="2" y1="7" x2="7" y2="7" />
                    <line x1="2" y1="17" x2="7" y2="17" />
                    <line x1="17" y1="17" x2="22" y2="17" />
                    <line x1="17" y1="7" x2="22" y2="7" />
                  </svg>
                </span>
                <span>Treyler</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Controls (Prev / Next) */}
      {total > 1 && (
        <>
          <button
            type="button"
            className="hero-nav-arrow left"
            onClick={handlePrev}
            aria-label="Oldingi banner"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            type="button"
            className="hero-nav-arrow right"
            onClick={handleNext}
            aria-label="Keyingi banner"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>

          {/* Dots Indicator */}
          <div className="hero-indicators-container">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                className={`hero-indicator-dot ${i === index ? 'active' : ''}`}
                onClick={() => setIndex(i)}
                aria-label={`Slayd ${i + 1}`}
              >
                <span className="dot-fill" />
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
