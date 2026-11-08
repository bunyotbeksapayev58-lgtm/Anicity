'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Hls from 'hls.js';
import { createClient } from '@/lib/supabase/client';
import { toPlayableUrl, isDriveUrl, extractDriveFileId } from '@/lib/drive';

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

// Fullscreen API cross-browser helpers (with vendor prefixes: WebKit, Mozilla, MS)
function getActiveFullscreenElement() {
  if (typeof document === 'undefined') return null;
  return (
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement ||
    null
  );
}

function requestElementFullscreen(element) {
  if (!element) return Promise.reject(new Error('Element not provided for fullscreen'));
  try {
    if (element.requestFullscreen) {
      return element.requestFullscreen();
    } else if (element.webkitRequestFullscreen) {
      return element.webkitRequestFullscreen();
    } else if (element.mozRequestFullScreen) {
      return element.mozRequestFullScreen();
    } else if (element.msRequestFullscreen) {
      return element.msRequestFullscreen();
    } else if (element.webkitEnterFullscreen) {
      return Promise.resolve(element.webkitEnterFullscreen());
    }
  } catch (err) {
    return Promise.reject(err);
  }
  return Promise.reject(new Error('Fullscreen API not supported on this browser/element'));
}

function exitDocumentFullscreen() {
  if (typeof document === 'undefined') return Promise.resolve();
  try {
    if (document.exitFullscreen) {
      return document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      return document.webkitExitFullscreen();
    } else if (document.mozCancelFullScreen) {
      return document.mozCancelFullScreen();
    } else if (document.msExitFullscreen) {
      return document.msExitFullscreen();
    }
  } catch (err) {
    return Promise.reject(err);
  }
  return Promise.resolve();
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

  // Unified URL resolution (supports drive:ID, Google Drive links, direct MP4/WebM)
  const playableUrl = toPlayableUrl(src);
  const isDrive = Boolean(src && isDriveUrl(src));
  const driveId = extractDriveFileId(src);
  const driveUrl = driveId ? `https://drive.google.com/file/d/${driveId}/preview` : playableUrl;
  const isDirectVideo = Boolean(!isDrive && playableUrl && /\.(mp4|webm|ogg|mkv|mov)(\?|$)/i.test(playableUrl));
  const isHls = Boolean(!isDrive && playableUrl && /\.m3u8(\?|$)/i.test(playableUrl));
  const isDirectStream = isDirectVideo || isHls;

  // Mobile device detection for direct stream native fallback
  const [isMobileDevice, setIsMobileDevice] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const isMobileUA =
        typeof navigator !== 'undefined' &&
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isSmallScreen = typeof window !== 'undefined' && window.innerWidth <= 768;
      setIsMobileDevice(Boolean(isMobileUA || isSmallScreen));
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
  const [hlsQualities, setHlsQualities] = useState([]);
  const [currentQuality, setCurrentQuality] = useState(-1);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const hlsRef = useRef(null);

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

  // State persistence: load saved volume and mute states from localStorage
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const savedVol = localStorage.getItem('anicity_player_volume');
        const savedMute = localStorage.getItem('anicity_player_muted');
        if (savedVol !== null) {
          const parsed = parseFloat(savedVol);
          if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
            setVolume(parsed);
            if (videoRef.current) {
              videoRef.current.volume = parsed;
            }
          }
        }
        if (savedMute !== null) {
          const isM = savedMute === 'true';
          setIsMuted(isM);
          if (videoRef.current) {
            videoRef.current.muted = isM;
          }
        }
      }
    } catch (_) {}
  }, []);



  // HLS playback engine mount
  useEffect(() => {
    if (!isHls || !playableUrl || !videoRef.current) return;

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      });
      hlsRef.current = hls;

      hls.loadSource(playableUrl);
      hls.attachMedia(videoRef.current);

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        setIsLoading(false);
        if (data.levels && data.levels.length > 0) {
          setHlsQualities(data.levels);
        }
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              setHasError(true);
              setErrorMessage('HLS oqimini yuklashda xatolik yuz berdi');
              break;
          }
        }
      });

      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      videoRef.current.src = playableUrl;
    }
  }, [isHls, playableUrl]);

  const changeQuality = (levelIndex) => {
    setCurrentQuality(levelIndex);
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelIndex;
    }
    setShowQualityMenu(false);
  };

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
  }, [playableUrl, isDirectVideo, startAt, nextHref, saveProgress]);

  // Fullscreen change listener synced across vendor prefixes and iOS Safari
  useEffect(() => {
    const onFsChange = () => {
      const fsEl = getActiveFullscreenElement();
      setIsFullscreen(Boolean(fsEl));
      if (!fsEl && typeof screen !== 'undefined' && screen.orientation && screen.orientation.unlock) {
        screen.orientation.unlock().catch(() => {});
      }
    };

    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    document.addEventListener('mozfullscreenchange', onFsChange);
    document.addEventListener('MSFullscreenChange', onFsChange);

    const videoEl = videoRef.current;
    const onVideoBeginFs = () => setIsFullscreen(true);
    const onVideoEndFs = () => setIsFullscreen(false);
    if (videoEl) {
      videoEl.addEventListener('webkitbeginfullscreen', onVideoBeginFs);
      videoEl.addEventListener('webkitendfullscreen', onVideoEndFs);
    }

    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
      document.removeEventListener('mozfullscreenchange', onFsChange);
      document.removeEventListener('MSFullscreenChange', onFsChange);
      if (videoEl) {
        videoEl.removeEventListener('webkitbeginfullscreen', onVideoBeginFs);
        videoEl.removeEventListener('webkitendfullscreen', onVideoEndFs);
      }
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
    const muted = val === 0;
    setIsMuted(muted);
    v.muted = muted;
    try {
      localStorage.setItem('anicity_player_volume', String(val));
      localStorage.setItem('anicity_player_muted', String(muted));
    } catch (_) {}
    resetControlsTimer();
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    if (isMuted) {
      v.muted = false;
      setIsMuted(false);
      const targetVol = volume > 0 ? volume : 0.8;
      v.volume = targetVol;
      setVolume(targetVol);
      try {
        localStorage.setItem('anicity_player_muted', 'false');
        localStorage.setItem('anicity_player_volume', String(targetVol));
      } catch (_) {}
    } else {
      v.muted = true;
      setIsMuted(true);
      try {
        localStorage.setItem('anicity_player_muted', 'true');
      } catch (_) {}
    }
    resetControlsTimer();
  };

  const adjustVolume = (delta) => {
    const v = videoRef.current;
    if (!v) return;
    const current = typeof v.volume === 'number' ? v.volume : volume;
    const newVol = Math.max(0, Math.min(1, Math.round((current + delta) * 100) / 100));
    v.volume = newVol;
    setVolume(newVol);
    const muted = newVol === 0;
    setIsMuted(muted);
    v.muted = muted;
    try {
      localStorage.setItem('anicity_player_volume', String(newVol));
      localStorage.setItem('anicity_player_muted', String(muted));
    } catch (_) {}
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

  // Direct HTML5 video fullscreen toggle (proper toggle, vendor prefixes, and safe fallbacks)
  const toggleFullscreen = useCallback((e) => {
    if (e && e.stopPropagation) {
      e.stopPropagation();
    }
    const container = containerRef.current;
    const activeFs = getActiveFullscreenElement();

    if (activeFs || isFullscreen) {
      // If in fullscreen: call document.exitFullscreen() with vendor fallbacks
      exitDocumentFullscreen()
        .then(() => {
          setIsFullscreen(false);
          if (typeof screen !== 'undefined' && screen.orientation && screen.orientation.unlock) {
            screen.orientation.unlock().catch(() => {});
          }
        })
        .catch((err) => {
          console.error('Exit fullscreen error:', err);
          if (videoRef.current?.webkitExitFullscreen) {
            try {
              videoRef.current.webkitExitFullscreen();
            } catch (vErr) {
              console.error('video webkitExitFullscreen error:', vErr);
            }
          }
          setIsFullscreen(false);
        });
    } else {
      // If not in fullscreen: call playerContainer.requestFullscreen() (or target video/wrapper element)
      const targetEl = container || videoRef.current;
      if (targetEl) {
        requestElementFullscreen(targetEl)
          .then(() => {
            setIsFullscreen(true);
            if (typeof screen !== 'undefined' && screen.orientation && screen.orientation.lock) {
              screen.orientation.lock('landscape').catch(() => {});
            }
          })
          .catch((err) => {
            console.error('Container requestFullscreen error:', err);
            // Fallback for mobile Safari iOS video element
            if (videoRef.current?.webkitEnterFullscreen) {
              try {
                videoRef.current.webkitEnterFullscreen();
                setIsFullscreen(true);
              } catch (safariErr) {
                console.error('webkitEnterFullscreen error:', safariErr);
              }
            }
          });
      }
    }
    resetControlsTimer();
  }, [isFullscreen, resetControlsTimer]);

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
      if (e.code === 'Space' || e.code === 'KeyK') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        skip(10);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        skip(-10);
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        adjustVolume(0.05);
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        adjustVolume(-0.05);
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
    if (!isDirectVideo && playableUrl) {
      setIsIframeLoading(true);
      setIframeError(false);

      // Non-blocking safety fallback: after 10s hide loading spinner
      const timer = setTimeout(() => {
        setIsIframeLoading(false);
      }, 10000);

      return () => clearTimeout(timer);
    }
  }, [playableUrl, isDirectVideo, iframeKey]);

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
    setIframeKey(Date.now()); // Forces an iframe re-render with a fresh timestamp key
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
  const handleDriveFullscreen = useCallback((e) => {
    if (e && e.stopPropagation) {
      e.stopPropagation();
    }
    const iframe = iframeRef.current;
    const activeFs = getActiveFullscreenElement();

    if (isTheaterMode) {
      exitTheaterMode();
      return;
    }

    if (activeFs || isFullscreen) {
      exitDocumentFullscreen()
        .then(() => {
          setIsFullscreen(false);
          if (typeof screen !== 'undefined' && screen.orientation && screen.orientation.unlock) {
            screen.orientation.unlock().catch(() => {});
          }
        })
        .catch((err) => {
          console.error('Exit fullscreen failed:', err);
          setIsFullscreen(false);
        });
      return;
    }

    // 1. Try native element fullscreen directly on the iframe element (Android Chrome & Desktop)
    if (iframe) {
      requestElementFullscreen(iframe)
        .then(() => {
          setIsFullscreen(true);
          if (typeof screen !== 'undefined' && screen.orientation && screen.orientation.lock) {
            screen.orientation.lock('landscape').catch(() => {});
          }
        })
        .catch((err) => {
          console.error('iframe.requestFullscreen declined or not permitted, switching to theater mode:', err);
          enterTheaterMode();
        });
    } else {
      enterTheaterMode();
    }
  }, [isFullscreen, isTheaterMode]);

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

  // Mobile Direct Stream Fallback: If source provides direct video (MP4/HLS), render native <video controls playsInline>
  if (isMobileDevice && isDirectVideo) {
    return (
      <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl flex items-center justify-center">
        <video
          ref={videoRef}
          src={playableUrl}
          controls
          playsInline
          preload="metadata"
          className="w-full h-full object-contain rounded-xl bg-black"
        />
      </div>
    );
  }

  return (
    <>
      {/* 1. DIRECT HTML5 VIDEO SOURCE */}
      {(isDirectVideo || isHls) ? (
        <div
          ref={containerRef}
          className={`ani-player-wrapper ${isFullscreen ? 'is-fullscreen' : ''}`}
          onMouseMove={resetControlsTimer}
          onTouchStart={resetControlsTimer}
        >
          <div className="ani-player-inner">
            <video
              ref={videoRef}
              src={isHls ? undefined : playableUrl}
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
                    role="slider"
                    aria-valuemin="0"
                    aria-valuemax={Math.round(duration || 100)}
                    aria-valuenow={Math.round(currentTime)}
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
                        role="slider"
                        aria-valuemin="0"
                        aria-valuemax="100"
                        aria-valuenow={Math.round((isMuted ? 0 : volume) * 100)}
                      />
                    </div>

                    <span className="ani-player-time-display">
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                  </div>

                  {/* Right controls: Speed, Fullscreen */}
                    {isHls && hlsQualities.length > 0 && (
                      <div className="ani-player-speed-wrap quality-wrap">
                        <button
                          type="button"
                          className="ani-player-ctrl-btn quality-btn"
                          onClick={() => setShowQualityMenu(!showQualityMenu)}
                          aria-label="Video sifatini tanlash"
                        >
                          {currentQuality === -1 ? 'Auto' : `${hlsQualities[currentQuality]?.height || 720}p`}
                        </button>
                        {showQualityMenu && (
                          <div className="ani-player-speed-menu quality-menu">
                            <button
                              type="button"
                              className={`ani-speed-item ${currentQuality === -1 ? 'active' : ''}`}
                              onClick={() => changeQuality(-1)}
                            >
                              Auto
                            </button>
                            {hlsQualities.map((lvl, idx) => (
                              <button
                                key={idx}
                                type="button"
                                className={`ani-speed-item ${currentQuality === idx ? 'active' : ''}`}
                                onClick={() => changeQuality(idx)}
                              >
                                {lvl.height}p
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

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
                      title={isFullscreen ? 'Kichraytirish / Chiqish' : 'To‘liq ekran'}
                      aria-label={isFullscreen ? 'Kichraytirish / Chiqish' : 'To‘liq ekran'}
                    >
                      {isFullscreen ? (
                        /* Compress / Exit Fullscreen (arrows pointing inward) */
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                          <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                        </svg>
                      ) : (
                        /* Expand / Fullscreen (4 corners pointing outward) */
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
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
          {/* Responsive 16:9 Frame Box with Strict Dimensions & Aspect Ratio */}
          <div className="ani-drive-frame-box relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl flex items-center justify-center">
            <iframe
              key={iframeKey}
              ref={iframeRef}
              src={driveUrl}
              title={episodeTitle || "Video Player"}
              className="ani-drive-iframe absolute inset-0 w-full h-full border-0 z-10"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="no-referrer"
              loading="eager"
              onLoad={handleIframeLoad}
              onError={handleIframeError}
            />

            {/* Top-Right Drive Pop-out Guard (blocks accidental navigation to Drive app) */}
            <div
              className="ani-drive-popout-guard"
              aria-hidden="true"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            />

            {/* Quick Reload Overlay Button (Forces iframe re-render with timestamp key) */}
            <button
              type="button"
              className="ani-drive-reload-overlay-btn"
              onClick={handleReloadIframe}
              title="Qayta yuklash / Reload Player"
              aria-label="Qayta yuklash / Reload Player"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <path d="M23 4v6h-6" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              <span>Qayta yuklash</span>
            </button>

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
