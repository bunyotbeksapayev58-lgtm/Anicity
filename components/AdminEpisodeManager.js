'use client';

import { useState, useRef, useTransition } from 'react';
import {
  createEpisode,
  updateEpisode,
  deleteEpisode,
  toggleEpisodePublished,
} from '@/app/actions/admin';
import { driveProblem } from '@/lib/drive';

export default function AdminEpisodeManager({ animes = [], initialAnimeId = null }) {
  const [selectedAnimeId, setSelectedAnimeId] = useState(
    initialAnimeId || animes[0]?.id || ''
  );

  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Form states
  const [editingEpisode, setEditingEpisode] = useState(null);
  const [seasonNumber, setSeasonNumber] = useState(1);
  const [episodeNumber, setEpisodeNumber] = useState(1);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [quality, setQuality] = useState('1080p');
  const [isPublished, setIsPublished] = useState(true);
  const [thumbnailPreview, setThumbnailPreview] = useState(null);

  const formRef = useRef(null);
  const thumbFileRef = useRef(null);

  // Get selected anime and its episodes
  const currentAnime = animes.find((a) => a.id === selectedAnimeId);
  const currentEpisodes = Array.isArray(currentAnime?.episodes)
    ? [...currentAnime.episodes].sort((a, b) => {
        if ((a.season_number || 1) !== (b.season_number || 1)) {
          return (a.season_number || 1) - (b.season_number || 1);
        }
        return a.number - b.number;
      })
    : [];

  // Reset form for adding next episode
  const resetFormForNext = (lastNum = null) => {
    setEditingEpisode(null);
    const nextNum = lastNum !== null
      ? lastNum + 1
      : currentEpisodes.length > 0
        ? Math.max(...currentEpisodes.map((e) => e.number || 0)) + 1
        : 1;

    setEpisodeNumber(nextNum);
    setTitle(`${nextNum}-qism`);
    setDescription('');
    setVideoUrl('');
    setQuality('1080p');
    setIsPublished(true);
    setThumbnailPreview(null);
    if (thumbFileRef.current) thumbFileRef.current.value = '';
    setErrorMessage(null);
  };

  // Switch anime
  const handleAnimeChange = (animeId) => {
    setSelectedAnimeId(animeId);
    setEditingEpisode(null);
    setErrorMessage(null);
    setSuccessMessage(null);

    const targetAnime = animes.find((a) => a.id === animeId);
    const eps = targetAnime?.episodes || [];
    const nextNum = eps.length > 0 ? Math.max(...eps.map((e) => e.number || 0)) + 1 : 1;
    setEpisodeNumber(nextNum);
    setTitle(`${nextNum}-qism`);
    setVideoUrl('');
    setThumbnailPreview(null);
  };

  // Load episode into edit mode
  const handleStartEdit = (ep) => {
    setEditingEpisode(ep);
    setSeasonNumber(ep.season_number || 1);
    setEpisodeNumber(ep.number);
    setTitle(ep.title || `${ep.number}-qism`);
    setDescription(ep.description || '');
    setVideoUrl(ep.video_url || '');
    setQuality(ep.quality || '1080p');
    setIsPublished(ep.is_published !== false);
    setThumbnailPreview(ep.thumbnail_url || null);
    setErrorMessage(null);
    setSuccessMessage(null);

    // Scroll to form smoothly
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleCancelEdit = () => {
    resetFormForNext();
  };

  const handleThumbChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      setThumbnailPreview(null);
      return;
    }
    const validMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validMimes.includes(file.type.toLowerCase())) {
      setErrorMessage('Faqat JPG, PNG yoki WebP formatdagi rasm yuklashingiz mumkin');
      e.target.value = '';
      setThumbnailPreview(null);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Rasm hajmi 5 MB dan oshmasligi kerak');
      e.target.value = '';
      setThumbnailPreview(null);
      return;
    }
    setErrorMessage(null);
    setThumbnailPreview(URL.createObjectURL(file));
  };

  // Duplicate warning detection
  const isDuplicateNumber = currentEpisodes.some((e) => {
    if (editingEpisode && e.id === editingEpisode.id) return false;
    return (e.season_number || 1) === Number(seasonNumber) && Number(e.number) === Number(episodeNumber);
  });

  // Client-side video URL inspection
  const driveWarning = videoUrl ? driveProblem(videoUrl) : null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!selectedAnimeId) {
      setErrorMessage('Iltimos, avval animeni tanlang');
      return;
    }

    if (!videoUrl.trim()) {
      setErrorMessage('Google Drive yoki to‘g‘ridan-to‘g‘ri video havolasini kiriting');
      return;
    }

    if (driveWarning) {
      setErrorMessage(driveWarning);
      return;
    }

    if (isDuplicateNumber) {
      setErrorMessage(`Ushbu faslda ${episodeNumber}-raqamli qism allaqachon mavjud! Boshqa raqam tanlang.`);
      return;
    }

    const formData = new FormData(formRef.current);
    formData.set('anime_id', selectedAnimeId);
    formData.set('season_number', String(seasonNumber));
    formData.set('number', String(episodeNumber));
    formData.set('title', title.trim() || `${episodeNumber}-qism`);
    formData.set('description', description.trim());
    formData.set('video_url', videoUrl.trim());
    formData.set('quality', quality);
    formData.set('is_published', String(isPublished));

    if (editingEpisode) {
      formData.set('episode_id', editingEpisode.id);
    }

    startTransition(async () => {
      try {
        const res = editingEpisode
          ? await updateEpisode(null, formData)
          : await createEpisode(null, formData);

        if (res?.error) {
          setErrorMessage(res.error);
        } else if (res?.success) {
          setSuccessMessage(res.message);
          if (editingEpisode) {
            resetFormForNext();
          } else {
            // Auto increment for next episode entry
            resetFormForNext(Number(episodeNumber));
          }
        }
      } catch (err) {
        setErrorMessage(err.message || 'Kutilmagan xatolik yuz berdi');
      }
    });
  };

  const handleDelete = (ep) => {
    if (!confirm(`Haqiqatan ham ${ep.season_number || 1}-fasl, ${ep.number}-qismni (“${ep.title}”) o‘chirmoqchimisiz?`)) {
      return;
    }
    const formData = new FormData();
    formData.set('episode_id', ep.id);
    formData.set('anime_id', selectedAnimeId);

    startTransition(async () => {
      try {
        await deleteEpisode(formData);
        setSuccessMessage(`${ep.number}-qism o‘chirildi`);
        if (editingEpisode?.id === ep.id) {
          resetFormForNext();
        }
      } catch (err) {
        setErrorMessage(err.message || 'O‘chirishda xatolik yuz berdi');
      }
    });
  };

  const handleTogglePublish = (ep) => {
    const formData = new FormData();
    formData.set('episode_id', ep.id);
    formData.set('current_status', String(ep.is_published !== false));
    formData.set('anime_id', selectedAnimeId);

    startTransition(async () => {
      try {
        await toggleEpisodePublished(formData);
      } catch (err) {
        setErrorMessage(err.message);
      }
    });
  };

  return (
    <div className="admin-episode-manager-wrap">
      {/* Anime Selection Header */}
      <div className="episode-manager-selector-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>
              🎬 Qismlari boshqarilayotgan Anime:
            </label>
            <select
              value={selectedAnimeId}
              onChange={(e) => handleAnimeChange(e.target.value)}
              className="anime-picker-select"
            >
              {animes.length === 0 ? (
                <option value="">(Animelar yo‘q, avval anime yarating)</option>
              ) : (
                animes.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title} ({a.year || '—'}) • {a.episodes?.length || 0} ta qism
                  </option>
                ))
              )}
            </select>
          </div>

          {currentAnime && (
            <div className="selected-anime-badge-info">
              {currentAnime.poster_url && (
                <img src={currentAnime.poster_url} alt="" className="selected-anime-thumb" />
              )}
              <div>
                <b style={{ fontSize: 15, color: '#fff' }}>{currentAnime.title}</b>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Jami: <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{currentEpisodes.length}</span> ta qism yuklangan
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      {successMessage && (
        <div className="admin-alert-success" style={{ marginTop: 16 }}>
          🎉 {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="admin-alert-error" style={{ marginTop: 16 }}>
          ⚠️ {errorMessage}
        </div>
      )}

      {/* Main 2-column or stacked layout: Left = Form, Right = Episodes list */}
      <div className="admin-grid-layout" style={{ marginTop: 20 }}>
        {/* Left Column: Add / Edit Episode Form */}
        <div className="card admin-pane">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 className="admin-pane-title" style={{ margin: 0 }}>
              {editingEpisode ? `✏️ ${editingEpisode.number}-qismni tahrirlash` : '➕ Yangi Qism Qo‘shish'}
            </h3>
            {editingEpisode && (
              <button type="button" onClick={handleCancelEdit} className="btn ghost sm">
                Bekor qilish
              </button>
            )}
          </div>

          <form ref={formRef} onSubmit={handleSubmit} className="admin-form-styled">
            <div className="row2">
              <div className="field">
                <label>Fasl (Season) raqami *</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={seasonNumber}
                  onChange={(e) => setSeasonNumber(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  required
                  disabled={isPending}
                />
              </div>

              <div className="field">
                <label>Qism (Episode) raqami *</label>
                <input
                  type="number"
                  min="1"
                  max="2000"
                  value={episodeNumber}
                  onChange={(e) => setEpisodeNumber(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  required
                  disabled={isPending}
                />
              </div>
            </div>

            {isDuplicateNumber && (
              <div className="warning-banner-box">
                ⚠️ Diqqat: {seasonNumber}-faslda {episodeNumber}-raqamli qism allaqachon mavjud!
              </div>
            )}

            <div className="field">
              <label>Qism Nomi (Sarlavha)</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Masalan: 1-qism: Qayta uyg‘onish"
                disabled={isPending}
              />
            </div>

            {/* Dedicated Google Drive URL input */}
            <div className="field">
              <label>
                Google Drive Video Havolasi (yoki to‘g‘ridan-to‘g‘ri MP4) *
              </label>
              <input
                type="text"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://drive.google.com/file/d/XXXXXX/view?usp=sharing"
                required
                disabled={isPending}
                className={driveWarning ? 'input-error' : ''}
              />
              {driveWarning && (
                <div style={{ color: '#ff4d6d', fontSize: 13, marginTop: 4 }}>
                  ⚠️ {driveWarning}
                </div>
              )}
              <p className="hint" style={{ marginTop: 4 }}>
                Google Drive video faylida: <b>Ulashish (Share) → «Havolaga ega bo‘lgan har kim» (Anyone with the link)</b> parametrini yoqing.
                Papka havolasi qabul qilinmaydi.
              </p>
            </div>

            <div className="row2">
              <div className="field">
                <label>Video Sifati</label>
                <select value={quality} onChange={(e) => setQuality(e.target.value)} disabled={isPending}>
                  <option value="1080p">1080p Full HD</option>
                  <option value="720p">720p HD</option>
                  <option value="4K">4K Ultra HD</option>
                </select>
              </div>

              <div className="field">
                <label>Muqova rasmi (Kompyuterdan, ixtiyoriy)</label>
                <input
                  ref={thumbFileRef}
                  name="thumbnail"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/jpg"
                  onChange={handleThumbChange}
                  disabled={isPending}
                />
              </div>
            </div>

            {thumbnailPreview && (
              <div className="preview-container" style={{ marginBottom: 12 }}>
                <img src={thumbnailPreview} alt="Thumbnail preview" className="preview-img trailer" />
                <button
                  type="button"
                  onClick={() => {
                    setThumbnailPreview(null);
                    if (thumbFileRef.current) thumbFileRef.current.value = '';
                  }}
                  className="btn-clear-preview"
                >
                  ✕
                </button>
              </div>
            )}

            <div className="field">
              <label>Qism Tavsifi (Epizod haqida qisqacha ma’lumot, ixtiyoriy)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Ushbu qismda qahramonlar yangi dushman bilan to‘qnash kelishadi..."
                disabled={isPending}
              />
            </div>

            <div className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }}>
              <input
                type="checkbox"
                id="ep_is_published"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
                disabled={isPending}
                style={{ width: 'auto', cursor: 'pointer' }}
              />
              <label htmlFor="ep_is_published" style={{ cursor: 'pointer', margin: 0 }}>
                Hozir saytda ochiq bo‘lsin (Faol/Chiqarilgan)
              </label>
            </div>

            <button
              type="submit"
              className="btn primary"
              style={{ width: '100%', marginTop: 14 }}
              disabled={isPending || Boolean(isDuplicateNumber)}
            >
              {isPending
                ? '⏳ Saqlanmoqda...'
                : editingEpisode
                  ? '💾 O‘zgarishlarni Saqlash'
                  : '➕ Qismni Yuklash va Saqlash'}
            </button>
          </form>
        </div>

        {/* Right Column: Existing Episodes List */}
        <div className="card admin-pane">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h3 className="admin-pane-title" style={{ margin: 0 }}>
              📺 Yuklangan Qismlar ({currentEpisodes.length})
            </h3>
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => resetFormForNext()}
              title="Yangi qism kiritish"
            >
              + Yangi qism
            </button>
          </div>

          {currentEpisodes.length > 0 ? (
            <div className="admin-items-list">
              {currentEpisodes.map((ep) => (
                <div key={ep.id} className="li-admin" style={{ justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <div className="admin-thumb" style={{ width: 56, height: 42 }}>
                      {ep.thumbnail_url ? (
                        <img src={ep.thumbnail_url} alt="" />
                      ) : (
                        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                          {ep.number}
                        </span>
                      )}
                    </div>
                    <div className="admin-info" style={{ minWidth: 0 }}>
                      <b style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {ep.season_number ? `${ep.season_number}-fasl, ` : ''}{ep.number}-qism: {ep.title}
                      </b>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span className="badge-quality">{ep.quality || '1080p'}</span>
                        <span className={ep.is_published !== false ? 'badge-published' : 'badge-draft'}>
                          {ep.is_published !== false ? '● Ochiq' : '○ Qoralama'}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="admin-actions" style={{ flexShrink: 0 }}>
                    <a
                      href={ep.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn ghost sm"
                      title="Google Drive videoni ochib ko‘rish"
                    >
                      🔗
                    </a>
                    <button
                      type="button"
                      onClick={() => handleTogglePublish(ep)}
                      className={`btn sm ${ep.is_published !== false ? 'ghost' : 'primary'}`}
                      title="Holatni almashtirish"
                      disabled={isPending}
                    >
                      {ep.is_published !== false ? 'Yashirish' : 'Ochish'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStartEdit(ep)}
                      className="btn ghost sm"
                      title="Tahrirlash"
                      disabled={isPending}
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(ep)}
                      className="btn danger sm"
                      title="O‘chirish"
                      disabled={isPending}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 14px', color: 'var(--text-muted)' }}>
              {selectedAnimeId
                ? 'Ushbu anime uchun hali qismlar yuklanmagan. Chap tarafdagi forma orqali 1-qismni kiriting.'
                : 'Iltimos, yuqoridagi ro‘yxatdan birorta animeni tanlang.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
