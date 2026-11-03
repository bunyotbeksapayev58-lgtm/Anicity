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

  const isDirectVideo = /\.(mp4|webm|ogg|mkv|mov)(\?|$)/i.test(src || '');
  const isDriveVideo = /drive\.google\.com/i.test(src || '');

  // Playback state
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

  // Initialize Supabase client
  useEffect(() => {
    supabase.current = createClient();
  }, []);

  // Save progress
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

  // Video metadata and initial position
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

  // Fullscreen change listener
  useEffect(() => {
    const onFsChange = () => {
      const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
      setIsFullscreen(Boolean(fsEl));
    };

    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
    };
  }, []);

  // Controls auto-hide timer
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

  // Play / Pause toggle
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

  // Skip forward / backward
  const skip = (seconds) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + seconds));
    setCurrentTime(v.currentTime);
    resetControlsTimer();
  };

  // Seek bar change
  const handleSeek = (e) => {
    const v = videoRef.current;
    if (!v) return;
    const newTime = parseFloat(e.target.value);
    v.currentTime = newTime;
    setCurrentTime(newTime);
    resetControlsTimer();
  };

  // Volume change
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

  // Mute toggle
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

  // Speed selection
  const changeSpeed = (speed) => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = speed;
    setPlaybackSpeed(speed);
    setShowSpeedMenu(false);
    resetControlsTimer();
  };

  // Fullscreen toggle (works for both HTML5 and Google Drive container!)
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

        // Lock to landscape on mobile if supported
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

  // Retry on error
  const handleRetry = () => {
    setHasError(false);
    setIsLoading(true);
    const v = videoRef.current;
    if (v) {
      v.load();
      v.play().catch(() => {});
    }
  };

  // Keyboard hotkeys on desktop
  useEffect(() => {
    if (!isDirectVideo) return;
    const onKeyDown = (e) => {
      // Don't trigger if user is typing in input or textarea
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

  return (
    <div
      ref={containerRef}
      className={`ani-player-wrapper ${isFullscreen ? 'is-fullscreen' : ''}`}
      onMouseMove={resetControlsTimer}
      onTouchStart={resetControlsTimer}
    >
      {/* 1. DIRECT HTML5 VIDEO SOURCE */}
      {isDirectVideo ? (
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
      ) : (
        /* 2. GOOGLE DRIVE / IFRAME PLAYER COMPATIBILITY */
        <div className="ani-drive-player-wrapper">
          <iframe
            src={src}
            className="ani-drive-iframe"
            allowFullScreen
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
            title={episodeTitle ? `${animeTitle} — ${episodeTitle}` : 'Video Player'}
          />

          {/* Mobile Fullscreen & Orientation Helper Overlay */}
          <div className="ani-drive-overlay-controls">
            <button
              type="button"
              className="ani-drive-fs-pill"
              onClick={toggleFullscreen}
              title={isFullscreen ? 'To‘liq ekrandan chiqish' : 'Katta ekranga o‘tkazish'}
            >
              {isFullscreen ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                  </svg>
                  <span>Chiqish</span>
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                  </svg>
                  <span>To‘liq ekran</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
