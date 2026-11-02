'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

// Converts YouTube URL (watch, shorts, youtu.be) into an embed URL
function getEmbedUrl(url) {
  if (!url) return null;
  try {
    if (url.includes('youtube.com/embed/')) return url;
    
    // https://www.youtube.com/watch?v=XYZ
    const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (ytMatch && ytMatch[1]) {
      return `https://www.youtube-nocookie.com/embed/${ytMatch[1]}?autoplay=1&rel=0`;
    }

    // Google Drive preview
    const driveMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (driveMatch && driveMatch[1]) {
      return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
    }

    return url;
  } catch {
    return url;
  }
}

function isDirectVideo(url) {
  return /\.(mp4|webm|ogg)($|\?)/i.test(url);
}

export default function TrailersClips({ trailers = [] }) {
  const [activeVideo, setActiveVideo] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setActiveVideo(null);
    };
    if (activeVideo) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeVideo]);

  if (!trailers || trailers.length === 0) return null;

  const scroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -600 : 600;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <section id="trailers" className="trailers-pro-section">
      <div className="row-header">
        <div className="row-title-group">
          <span className="row-title-icon">🎞️</span>
          <div>
            <h2 className="row-title-text">Anime Treylerlari va Qisqa Lavhalar</h2>
            <p className="row-subtitle-text">Eng so‘nggi rasmiy preverlar, tizerlar va lavhalarni tomosha qiling</p>
          </div>
        </div>
      </div>

      <div className="trailers-carousel-wrap">
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

        <div className="trailers-scroll-container" ref={scrollRef}>
          {trailers.map((item) => (
            <div
              key={item.id}
              className="trailer-card-pro"
              onClick={() => setActiveVideo(item)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setActiveVideo(item)}
            >
              <div className="trailer-thumb-wrap">
                <img
                  src={item.thumbnail_url || item.anime?.poster_url || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop'}
                  alt={item.title}
                  className="trailer-thumb-img"
                  loading="lazy"
                />
                <div className="trailer-play-overlay">
                  <div className="trailer-play-circle">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
                {item.duration_text && (
                  <span className="trailer-duration-badge">{item.duration_text}</span>
                )}
                <span className="trailer-type-badge">
                  {item.clip_type === 'clip' ? 'Lavha' : item.clip_type === 'pv' ? 'PV' : 'Treyler'}
                </span>
              </div>

              <div className="trailer-meta-pane">
                <h3 className="trailer-card-title">{item.title}</h3>
                {item.anime && (
                  <span className="trailer-anime-name">
                    {item.anime.title}
                  </span>
                )}
              </div>
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

      {/* Video Modal Popup */}
      {activeVideo && (
        <div className="video-modal-backdrop" onClick={() => setActiveVideo(null)}>
          <div className="video-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="video-modal-header">
              <div className="video-modal-title-wrap">
                <span className="video-modal-tag">Treyler / Lavha</span>
                <h3 className="video-modal-title">{activeVideo.title}</h3>
                {activeVideo.anime && (
                  <Link
                    href={`/anime/${activeVideo.anime.id}`}
                    className="video-modal-anime-link"
                    onClick={() => setActiveVideo(null)}
                  >
                    Anime sahifasiga o‘tish →
                  </Link>
                )}
              </div>
              <button
                type="button"
                className="video-modal-close-btn"
                onClick={() => setActiveVideo(null)}
                aria-label="Yopish"
              >
                ✕
              </button>
            </div>

            <div className="video-modal-player-wrap">
              {isDirectVideo(activeVideo.video_url) ? (
                <video
                  src={activeVideo.video_url}
                  controls
                  autoPlay
                  playsInline
                  className="modal-html5-player"
                />
              ) : (
                <iframe
                  src={getEmbedUrl(activeVideo.video_url)}
                  title={activeVideo.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="modal-iframe-player"
                />
              )}
            </div>

            {activeVideo.description && (
              <p className="video-modal-description">
                {activeVideo.description}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
