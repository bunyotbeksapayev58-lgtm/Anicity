'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '00:00';
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const remS = s % 60;
  const h = Math.floor(m / 60);
  const remM = m % 60;

  if (h > 0) {
    return `${h}:${remM < 10 ? '0' : ''}${remM}:${remS < 10 ? '0' : ''}${remS}`;
  }
  return `${m < 10 ? '0' : ''}${m}:${remS < 10 ? '0' : ''}${remS}`;
}

// Normalizes Google Drive links so they always render correctly via /preview
function formatDriveUrl(url) {
  if (!url) return '';
  const trimmed = url.trim();
  if (/drive\.google\.com/i.test(trimmed)) {
    if (trimmed.includes('/view')) {
      return trimmed.replace(/\/view(\?.*)?$/i, '/preview');
    }
    if (trimmed.includes('/edit')) {
      return trimmed.replace(/\/edit(\?.*)?$/i, '/preview');
    }
    if (!trimmed.endsWith('/preview')) {
      return trimmed.replace(/\/?$/, '/preview');
    }
  }
  return trimmed;
}

export default function Player({
  src,
  userId,
  animeId,
  episodeId,
  startAt = 0,
  nextHref,
  animeTitle = '',
  episodeTitle = '',
}) {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const hideControlsTimeout = useRef(null);
  const lastSave = useRef(0);
  const supabase = useRef(null);

  // Distinguish between direct HTML5 video and Google Drive / iframe embeds
  const isDirectVideo = Boolean(src && /\.(mp4|webm|ogg|mkv|mov)(\?|$)/i.test(src));

  // Direct video playback states
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  // Google Drive specific states
  const [isIframeLoading, setIsIframeLoading] = useState(true);
  const [iframeError, setIframeError] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const iframeRef = useRef(null);
  const driveContainerRef = useRef(null);

  // Initialize Supabase client for saving progress
  useEffect(() => {
    supabase.current = createClient();
  }, []);

  // Save progress for direct HTML5 video
  const saveProgress = useCallback(async ({ force = false, completed = false } = {}) => {
    const v = videoRef.current;
    if (!v || !v.duration || !supabase.current || !userId || !episodeId || !animeId) return;
    const now = Date.now();
    if (!force && now - lastSave.current < 5000) return;
    lastSave.current = now;

    try {
      await supabase.current.from('watch_progress').upsert({
        user_id: userId,
        episode_id: episodeId,
        anime_id: animeId,
        position_sec: Math.floor(v.currentTime),
        duration_sec: Math.floor(v.duration),
        completed: completed || (v.duration > 0 && v.currentTime / v.duration > 0.92),
        updated_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('Watch progress save failed:', e);
    }
  }, [userId, episodeId, animeId]);

  // Video metadata and initial position (Direct video only)
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !isDirectVideo) return;

    const onLoadedMeta = () => {
      setDuration(v.duration || 0);
      setIsLoading(false);
      setHasError(false);
      if (startAt > 5 && startAt < (v.duration || 0) - 10) {
        v.currentTime = startAt;
        setCurrentTime(startAt);
      }
    };

    const onTimeUpdate = () => {
      setCurrentTime(v.currentTime || 0);
      saveProgress();
    };

    const onWaiting = () => setIsLoading(true);
    const onPlaying = () => {
      setIsLoading(false);
      setIsPlaying(true);
      setHasError(false);
    };
    const onPause = () => {
      setIsPlaying(false);
      saveProgress({ force: true });
    };
    const onError = () => {
      setIsLoading(false);
      setHasError(true);
      setErrorMessage('Video faylni yuklashda xatolik yuz berdi. Internet aloqasini tekshiring.');
    };
    const onEnded = async () => {
      setIsPlaying(false);
      await saveProgress({ force: true, completed: true });
      if (nextHref) {
        window.location.href = nextHref;
      }
    };

    v.addEventListener('loadedmetadata', onLoadedMeta);
    v.addEventListener('timeupdate', onTimeUpdate);
    v.addEventListener('waiting', onWaiting);
    v.addEventListener('playing', onPlaying);
    v.addEventListener('pause', onPause);
    v.addEventListener('error', onError);
    v.addEventListener('ended', onEnded);

    return () => {
      v.removeEventListener('loadedmetadata', onLoadedMeta);
      v.removeEventListener('timeupdate', onTimeUpdate);
      v.removeEventListener('waiting', onWaiting);
      v.removeEventListener('playing', onPlaying);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('error', onError);
      v.removeEventListener('ended', onEnded);
    };
  }, [src, isDirectVideo, startAt, nextHref, saveProgress]);

  // Fullscreen change listener (works for both HTML5 and iframe Fullscreen API)
  useEffect(() => {
    const onFsChange = () => {
      const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
      setIsFullscreen(Boolean(fsEl));
      if (!fsEl && typeof screen !== 'undefined' && screen.orientation && screen.orientation.unlock) {
        screen.orientation.unlock().catch(() => {});
      }
    };

    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
    };
  }, []);

  // Controls auto-hide timer for direct HTML5 video
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimeout.current) clearTimeout(hideControlsTimeout.current);
    if (isPlaying) {
      hideControlsTimeout.current = setTimeout(() => {
        setShowControls(false);
        setShowSpeedMenu(false);
      }, 3500);
    }
  }, [isPlaying]);

  const handleContainerTap = () => {
    if (showControls) {
      setShowControls(false);
      setShowSpeedMenu(false);
    } else {
      resetControlsTimer();
    }
  };

  // Direct video play/pause
  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
      setIsPlaying(true);
    } else {
      v.pause();
      setIsPlaying(false);
    }
    resetControlsTimer();
  };

  const skip = (seconds) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + seconds));
    setCurrentTime(v.currentTime);
    resetControlsTimer();
  };

  const handleSeek = (e) => {
    const v = videoRef.current;
    if (!v) return;
    const newTime = parseFloat(e.target.value);
    v.currentTime = newTime;
    setCurrentTime(newTime);
    resetControlsTimer();
  };

  const handleVolume = (e) => {
    const v = videoRef.current;
    if (!v) return;
    const val = parseFloat(e.target.value);
    v.volume = val;
    setVolume(val);
    setIsMuted(val === 0);
    v.muted = val === 0;
    resetControlsTimer();
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    if (isMuted) {
      v.muted = false;
      setIsMuted(false);
      v.volume = volume || 0.5;
    } else {
      v.muted = true;
      setIsMuted(true);
    }
    resetControlsTimer();
  };

  const changeSpeed = (speed) => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = speed;
    setPlaybackSpeed(speed);
    setShowSpeedMenu(false);
    resetControlsTimer();
  };

  // Direct HTML5 video fullscreen toggle
  const toggleFullscreen = async () => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      try {
        if (container.requestFullscreen) {
          await container.requestFullscreen();
        } else if (container.webkitRequestFullscreen) {
          await container.webkitRequestFullscreen();
        } else if (videoRef.current?.webkitEnterFullscreen) {
          videoRef.current.webkitEnterFullscreen();
        }
        setIsFullscreen(true);
        if (typeof screen !== 'undefined' && screen.orientation && screen.orientation.lock) {
          screen.orientation.lock('landscape').catch(() => {});
        }
      } catch (err) {
        console.warn('Fullscreen entry failed:', err);
      }
    } else {
      try {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        }
        setIsFullscreen(false);
        if (typeof screen !== 'undefined' && screen.orientation && screen.orientation.unlock) {
          screen.orientation.unlock().catch(() => {});
        }
      } catch (err) {
        console.warn('Fullscreen exit failed:', err);
      }
    }
    resetControlsTimer();
  };

  const handleRetry = () => {
    setHasError(false);
    setIsLoading(true);
    const v = videoRef.current;
    if (v) {
      v.load();
      v.play().catch(() => {});
    }
  };

  // Direct video desktop hotkeys
  useEffect(() => {
    if (!isDirectVideo) return;
    const onKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        skip(10);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        skip(-10);
      } else if (e.code === 'KeyF') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        toggleMute();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isDirectVideo, isPlaying, isMuted, isFullscreen]);

  // ============================================================================
  // GOOGLE DRIVE IFRAME LOGIC (RESPONSIVE, CROSS-ORIGIN SAFE, NON-INTRUSIVE)
  // ============================================================================

  // Reset loading timer on src change
  useEffect(() => {
    if (!isDirectVideo && src) {
      setIsIframeLoading(true);
      setIframeError(false);

      // Non-blocking safety fallback: after 10s hide loading spinner
      const timer = setTimeout(() => {
        setIsIframeLoading(false);
      }, 10000);

      return () => clearTimeout(timer);
    }
  }, [src, isDirectVideo, iframeKey]);

  const handleIframeLoad = () => {
    setIsIframeLoading(false);
    setIframeError(false);
  };

  const handleIframeError = () => {
    setIsIframeLoading(false);
    setIframeError(true);
  };

  const handleReloadIframe = () => {
    setIsIframeLoading(true);
    setIframeError(false);
    setIframeKey((k) => k + 1);
  };

  // Enter / Exit Theater Mode (especially for iPhone / iOS Safari)
  const enterTheaterMode = () => {
    setIsTheaterMode(true);
    try {
      if (typeof document !== 'undefined') {
        document.body.style.overflow = 'hidden';
      }
      if (typeof screen !== 'undefined' && screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(() => {});
      }
    } catch (_) {}
  };

  const exitTheaterMode = () => {
    setIsTheaterMode(false);
    try {
      if (typeof document !== 'undefined') {
        document.body.style.overflow = '';
      }
      if (typeof screen !== 'undefined' && screen.orientation && screen.orientation.unlock) {
        screen.orientation.unlock().catch(() => {});
      }
    } catch (_) {}
  };

  // Fullscreen trigger for Google Drive: Try native iframe.requestFullscreen first, then theater mode fallback
  const handleDriveFullscreen = async () => {
    const iframe = iframeRef.current;
    const isCurrentlyFs = Boolean(document.fullscreenElement || document.webkitFullscreenElement);

    if (isTheaterMode) {
      exitTheaterMode();
      return;
    }

    if (isCurrentlyFs) {
      try {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        }
        setIsFullscreen(false);
        if (typeof screen !== 'undefined' && screen.orientation && screen.orientation.unlock) {
          screen.orientation.unlock().catch(() => {});
        }
      } catch (err) {
        console.warn('Exit fullscreen failed:', err);
      }
      return;
    }

    // 1. Try native element fullscreen directly on the iframe element (Android Chrome & Desktop)
    if (iframe) {
      const req =
        iframe.requestFullscreen ||
        iframe.webkitRequestFullscreen ||
        iframe.mozRequestFullScreen ||
        iframe.msRequestFullscreen;

      if (req && typeof req === 'function') {
        try {
          await req.call(iframe);
          setIsFullscreen(true);
          if (typeof screen !== 'undefined' && screen.orientation && screen.orientation.lock) {
            screen.orientation.lock('landscape').catch(() => {});
          }
          return;
        } catch (err) {
          console.info('iframe.requestFullscreen declined or not permitted, switching to theater mode:', err);
        }
      }
    }

    // 2. Fallback: Theater Mode (pseudo-fullscreen) for iOS Safari & unsupported environments
    enterTheaterMode();
  };

  // Close theater mode on Escape key
  useEffect(() => {
    if (!isTheaterMode) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        exitTheaterMode();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isTheaterMode]);

  // Clean up body overflow if component unmounts while in theater mode
  useEffect(() => {
    return () => {
      if (typeof document !== 'undefined') {
        document.body.style.overflow = '';
      }
    };
  }, []);

  return (
    <>
      {/* 1. DIRECT HTML5 VIDEO SOURCE */}
      {isDirectVideo ? (
        <div
          ref={containerRef}
          className={`ani-player-wrapper ${isFullscreen ? 'is-fullscreen' : ''}`}
          onMouseMove={resetControlsTimer}
          onTouchStart={resetControlsTimer}
        >
          <div className="ani-player-inner">
            <video
              ref={videoRef}
              src={src}
              className="ani-video-element"
              playsInline
              preload="metadata"
              onClick={togglePlay}
            />

            {/* Buffering Spinner */}
            {isLoading && !hasError && (
              <div className="ani-player-spinner-overlay">
                <div className="ani-player-spinner" />
                <span>Yuklanmoqda...</span>
              </div>
            )}

            {/* Error State with Retry Button */}
            {hasError && (
              <div className="ani-player-error-overlay">
                <span className="error-icon">⚠️</span>
                <h4>{errorMessage}</h4>
                <button type="button" className="btn primary sm" onClick={handleRetry}>
                  Qayta urinib ko‘rish
                </button>
              </div>
            )}

            {/* Custom Controls Overlay */}
            <div
              className={`ani-player-controls-overlay ${showControls || !isPlaying ? 'visible' : 'hidden'}`}
              onClick={handleContainerTap}
            >
              {/* Top Bar (Title & Fullscreen Exit) */}
              <div className="ani-player-top-bar" onClick={(e) => e.stopPropagation()}>
                <div className="ani-player-title-text">
                  <b>{animeTitle}</b> {episodeTitle ? `— ${episodeTitle}` : ''}
                </div>
                {isFullscreen && (
                  <button
                    type="button"
                    className="ani-player-ctrl-btn exit-fs-btn"
                    onClick={toggleFullscreen}
                    title="To‘liq ekrandan chiqish"
                    aria-label="To‘liq ekrandan chiqish"
                  >
                    ✕ Chiqish
                  </button>
                )}
              </div>

              {/* Center Play/Pause & Skip Controls */}
              <div className="ani-player-center-controls" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="ani-player-ctrl-btn skip-btn"
                  onClick={() => skip(-10)}
                  title="10 soniya orqaga"
                  aria-label="10 soniya orqaga"
                >
                  ↺ 10s
                </button>

                <button
                  type="button"
                  className="ani-player-center-play-btn"
                  onClick={togglePlay}
                  title={isPlaying ? 'Pauza' : 'Ijro'}
                  aria-label={isPlaying ? 'Pauza' : 'Ijro'}
                >
                  {isPlaying ? (
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="6" y="4" width="4" height="16" rx="1" />
                      <rect x="14" y="4" width="4" height="16" rx="1" />
                    </svg>
                  ) : (
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: 3 }}>
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>

                <button
                  type="button"
                  className="ani-player-ctrl-btn skip-btn"
                  onClick={() => skip(10)}
                  title="10 soniya oldinga"
                  aria-label="10 soniya oldinga"
                >
                  10s ↻
                </button>
              </div>

              {/* Bottom Bar: Seekbar & Controls */}
              <div className="ani-player-bottom-bar" onClick={(e) => e.stopPropagation()}>
                {/* Progress Seek Bar */}
                <div className="ani-player-seek-container">
                  <input
                    type="range"
                    min="0"
                    max={duration || 100}
                    step="0.1"
                    value={currentTime}
                    onChange={handleSeek}
                    className="ani-player-seek-input"
                    aria-label="Video vaqtini surish"
                  />
                  <div
                    className="ani-player-seek-fill"
                    style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                  />
                </div>

                {/* Control Buttons Row */}
                <div className="ani-player-buttons-row">
                  {/* Left controls: Play, Volume, Time */}
                  <div className="ani-player-left-group">
                    <button
                      type="button"
                      className="ani-player-ctrl-btn"
                      onClick={togglePlay}
                      aria-label={isPlaying ? 'Pauza' : 'Ijro'}
                    >
                      {isPlaying ? '⏸' : '▶'}
                    </button>

                    <div className="ani-player-volume-group">
                      <button
                        type="button"
                        className="ani-player-ctrl-btn"
                        onClick={toggleMute}
                        aria-label={isMuted ? 'Ovozni yoqish' : 'Ovozni o‘chirish'}
                      >
                        {isMuted || volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
                      </button>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={isMuted ? 0 : volume}
                        onChange={handleVolume}
                        className="ani-player-volume-slider"
                        aria-label="Ovoz balandligi"
                      />
                    </div>

                    <span className="ani-player-time-display">
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                  </div>

                  {/* Right controls: Speed, Fullscreen */}
                  <div className="ani-player-right-group">
                    <div className="ani-player-speed-wrap">
                      <button
                        type="button"
                        className="ani-player-ctrl-btn speed-btn"
                        onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                        aria-label="Tezlikni tanlash"
                      >
                        {playbackSpeed}x
                      </button>
                      {showSpeedMenu && (
                        <div className="ani-player-speed-menu">
                          {[0.5, 0.75, 1, 1.25, 1.5, 2].map((s) => (
                            <button
                              key={s}
                              type="button"
                              className={`ani-speed-item ${playbackSpeed === s ? 'active' : ''}`}
                              onClick={() => changeSpeed(s)}
                            >
                              {s}x
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      className="ani-player-ctrl-btn fs-btn"
                      onClick={toggleFullscreen}
                      title={isFullscreen ? 'Kichraytirish' : 'To‘liq ekran'}
                      aria-label={isFullscreen ? 'Kichraytirish' : 'To‘liq ekran'}
                    >
                      {isFullscreen ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                        </svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* 2. GOOGLE DRIVE / IFRAME PLAYER COMPATIBILITY */
        <div
          ref={driveContainerRef}
          className={`ani-drive-container ${isTheaterMode ? 'is-theater-mode' : ''} ${isFullscreen ? 'is-fullscreen' : ''}`}
        >
          {/* Responsive 16:9 Frame Box */}
          <div className="ani-drive-frame-box">
            <iframe
              key={iframeKey}
              ref={iframeRef}
              src={formatDriveUrl(src)}
              className="ani-drive-iframe"
              allowFullScreen
              allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
              title={episodeTitle ? `${animeTitle} — ${episodeTitle}` : 'Google Drive Video Player'}
              onLoad={handleIframeLoad}
              onError={handleIframeError}
            />

            {/* Non-intrusive loading badge (pointer-events: none; located at top-left away from Google controls) */}
            {isIframeLoading && !iframeError && (
              <div className="ani-drive-loading-badge" aria-live="polite">
                <div className="ani-drive-spinner" />
                <span>Video yuklanmoqda...</span>
              </div>
            )}

            {/* Error fallback state with reload button */}
            {iframeError && (
              <div className="ani-drive-error-state">
                <span className="error-icon">⚠️</span>
                <p>Videoni yuklashda xatolik yuz berdi yoki internet sekin.</p>
                <button
                  type="button"
                  className="btn primary sm"
                  onClick={handleReloadIframe}
                >
                  Qayta yuklash
                </button>
              </div>
            )}

            {/* Theater Mode Exit Button (only shown in theater/pseudo-fullscreen mode) */}
            {isTheaterMode && (
              <button
                type="button"
                className="ani-theater-exit-btn"
                onClick={exitTheaterMode}
                title="Katta ekrandan chiqish"
                aria-label="Katta ekrandan chiqish"
              >
                ✕ Chiqish
              </button>
            )}
          </div>

          {/* External Action Bar — strictly OUTSIDE the interactive iframe area */}
          <div className="ani-drive-external-bar">
            <div className="ani-drive-provider-tag">
              <span className="drive-indicator-dot" />
              <span className="drive-provider-label">Google Drive Player</span>
            </div>

            <div className="ani-drive-bar-actions">
              <button
                type="button"
                className="ani-drive-bar-btn reload"
                onClick={handleReloadIframe}
                title="Videoni qayta yuklash"
                aria-label="Videoni qayta yuklash"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M23 4v6h-6" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
                <span>Yangilash</span>
              </button>

              <button
                type="button"
                className="ani-drive-bar-btn fullscreen"
                onClick={handleDriveFullscreen}
                title={isFullscreen || isTheaterMode ? 'Kichraytirish' : 'Katta ekranga o‘tkazish'}
                aria-label={isFullscreen || isTheaterMode ? 'Kichraytirish' : 'Katta ekranga o‘tkazish'}
              >
                {isFullscreen || isTheaterMode ? (
                  <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                    </svg>
                    <span>Kichraytirish</span>
                  </>
                ) : (
                  <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                    </svg>
                    <span>Katta ekran</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
