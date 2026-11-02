'use client';

import { useState, useRef, useTransition } from 'react';
import { createAnime } from '@/app/actions/admin';

const POPULAR_GENRES = [
  'Action',
  'Sarguzasht',
  'Fantaziya',
  'Shounen',
  'Romantika',
  'Drama',
  'Komediya',
  'Isekai',
  'Psixologik',
  'Sci-Fi',
  'Supernatural',
];

export default function AdminAnimeForm({ onAnimeCreated }) {
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState(null);
  const [formSuccess, setFormSuccess] = useState(null);
  const [createdAnime, setCreatedAnime] = useState(null);

  // Previews
  const [posterPreview, setPosterPreview] = useState(null);
  const [bannerPreview, setBannerPreview] = useState(null);

  // Selected genres
  const [selectedGenres, setSelectedGenres] = useState(['Action', 'Fantaziya']);

  const formRef = useRef(null);
  const posterFileRef = useRef(null);
  const bannerFileRef = useRef(null);

  const toggleGenre = (genre) => {
    if (selectedGenres.includes(genre)) {
      setSelectedGenres(selectedGenres.filter((g) => g !== genre));
    } else {
      setSelectedGenres([...selectedGenres, genre]);
    }
  };

  const handlePosterChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      setPosterPreview(null);
      return;
    }
    // Validation
    const validMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validMimes.includes(file.type.toLowerCase())) {
      setFormError('Faqat JPG, PNG yoki WebP formatdagi poster yuklashingiz mumkin');
      e.target.value = '';
      setPosterPreview(null);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFormError('Poster hajmi 5 MB dan oshmasligi kerak');
      e.target.value = '';
      setPosterPreview(null);
      return;
    }
    setFormError(null);
    setPosterPreview(URL.createObjectURL(file));
  };

  const handleBannerChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      setBannerPreview(null);
      return;
    }
    const validMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validMimes.includes(file.type.toLowerCase())) {
      setFormError('Faqat JPG, PNG yoki WebP formatdagi banner yuklashingiz mumkin');
      e.target.value = '';
      setBannerPreview(null);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFormError('Banner hajmi 5 MB dan oshmasligi kerak');
      e.target.value = '';
      setBannerPreview(null);
      return;
    }
    setFormError(null);
    setBannerPreview(URL.createObjectURL(file));
  };

  const clearPoster = () => {
    setPosterPreview(null);
    if (posterFileRef.current) posterFileRef.current.value = '';
  };

  const clearBanner = () => {
    setBannerPreview(null);
    if (bannerFileRef.current) bannerFileRef.current.value = '';
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const formData = new FormData(formRef.current);

    // Set genres
    formData.set('genres', selectedGenres.join(', '));

    startTransition(async () => {
      try {
        const res = await createAnime(null, formData);
        if (res?.error) {
          setFormError(res.error);
        } else if (res?.success) {
          setFormSuccess(res.message);
          const animeData = {
            id: res.animeId,
            title: res.animeTitle,
          };
          setCreatedAnime(animeData);

          // Reset form inputs safely
          formRef.current?.reset();
          setPosterPreview(null);
          setBannerPreview(null);
          setSelectedGenres(['Action', 'Fantaziya']);

          if (onAnimeCreated) {
            onAnimeCreated(animeData);
          }
        }
      } catch (err) {
        setFormError(err.message || 'Kutilmagan xatolik yuz berdi');
      }
    });
  };

  return (
    <div className="admin-anime-form-wrapper">
      {formSuccess && createdAnime && (
        <div className="admin-alert-success" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <span style={{ fontSize: 20, marginRight: 8 }}>🎉</span>
              <b>{formSuccess}</b>
            </div>
            {onAnimeCreated && (
              <button
                type="button"
                className="btn primary sm"
                onClick={() => onAnimeCreated(createdAnime)}
              >
                📺 Qismlarni qo‘shishga o‘tish →
              </button>
            )}
          </div>
        </div>
      )}

      {formError && (
        <div className="admin-alert-error" style={{ marginBottom: 20 }}>
          ⚠️ {formError}
        </div>
      )}

      <form ref={formRef} onSubmit={handleSubmit} className="admin-form-styled">
        {/* Asosiy Nomi va Muqobil nomi */}
        <div className="form-section-title">1. Asosiy ma’lumotlar</div>
        <div className="field">
          <label>Anime Nomi (O‘zbekcha / Asosiy) *</label>
          <input
            name="title"
            required
            placeholder="Masalan: Solo Leveling: Qaytadan yuksalish"
            disabled={isPending}
          />
        </div>

        <div className="row2">
          <div className="field">
            <label>Asl / Inglizcha Nomi (Alt title)</label>
            <input
              name="alt_title"
              placeholder="Masalan: Ore dake Level Up na Ken"
              disabled={isPending}
            />
          </div>
          <div className="field">
            <label>Chiqarilgan Yili</label>
            <input
              name="year"
              type="number"
              min="1960"
              max="2100"
              defaultValue={2025}
              disabled={isPending}
            />
          </div>
        </div>

        <div className="row2">
          <div className="field">
            <label>Holati</label>
            <select name="status" defaultValue="Davom etmoqda" disabled={isPending}>
              <option value="Davom etmoqda">Davom etmoqda (Ongoing)</option>
              <option value="Tugallangan">Tugallangan (Completed)</option>
            </select>
          </div>
          <div className="field">
            <label>Yosh Cheklovi</label>
            <select name="age_rating" defaultValue="12+" disabled={isPending}>
              <option value="0+">0+ (Barchaga)</option>
              <option value="6+">6+ (Bolalar uchun)</option>
              <option value="12+">12+ (O‘smirlar)</option>
              <option value="16+">16+ (Kattaroqlar)</option>
              <option value="18+">18+ (Faqat kattalar)</option>
            </select>
          </div>
        </div>

        <div className="row2">
          <div className="field">
            <label>Animatsiya Studiyasi</label>
            <input
              name="studio"
              placeholder="Masalan: MAPPA, Ufotable, A-1 Pictures"
              disabled={isPending}
            />
          </div>
          <div className="field">
            <label>Rejissyor</label>
            <input
              name="director"
              placeholder="Masalan: Shunsuke Nakashige"
              disabled={isPending}
            />
          </div>
        </div>

        {/* Janrlar tanlash */}
        <div className="field">
          <label>Janrlar</label>
          <div className="genres-chip-container">
            {POPULAR_GENRES.map((g) => {
              const active = selectedGenres.includes(g);
              return (
                <button
                  type="button"
                  key={g}
                  className={`genre-chip-btn ${active ? 'active' : ''}`}
                  onClick={() => toggleGenre(g)}
                  disabled={isPending}
                >
                  {active ? '✓ ' : '+ '} {g}
                </button>
              );
            })}
          </div>
          <p className="hint" style={{ marginTop: 6 }}>
            Tanlangan janrlar: <b>{selectedGenres.join(', ') || 'Hech biri'}</b>
          </p>
        </div>

        {/* Tavsif */}
        <div className="field">
          <label>Tavsif (Syujet / Qisqacha mazmuni)</label>
          <textarea
            name="description"
            rows={4}
            placeholder="Anime syujeti, qahramonlar va qiziqarli voqealar haqida..."
            disabled={isPending}
          />
        </div>

        {/* 2. Media / Tasvirlar */}
        <div className="form-section-title" style={{ marginTop: 24 }}>
          2. Poster va Katta Banner (Kompyuterdan yuklash)
        </div>

        {/* Poster File Upload */}
        <div className="row2">
          <div className="field">
            <label>Poster yuklash (JPG, PNG, WebP — maks 5MB) *</label>
            <div className="file-upload-box">
              <input
                ref={posterFileRef}
                name="poster"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/jpg"
                onChange={handlePosterChange}
                disabled={isPending}
              />
              {posterPreview && (
                <div className="preview-container">
                  <img src={posterPreview} alt="Poster preview" className="preview-img poster" />
                  <button type="button" onClick={clearPoster} className="btn-clear-preview" title="O‘chirish">
                    ✕
                  </button>
                </div>
              )}
            </div>
            <div style={{ marginTop: 8 }}>
              <input
                name="posterUrl"
                placeholder="yoki tayyor rasm URL havolasi (ixtiyoriy)"
                disabled={isPending}
              />
            </div>
          </div>

          {/* Banner File Upload */}
          <div className="field">
            <label>Katta Keng Banner / Backdrop (maks 5MB)</label>
            <div className="file-upload-box">
              <input
                ref={bannerFileRef}
                name="banner"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/jpg"
                onChange={handleBannerChange}
                disabled={isPending}
              />
              {bannerPreview && (
                <div className="preview-container">
                  <img src={bannerPreview} alt="Banner preview" className="preview-img banner" />
                  <button type="button" onClick={clearBanner} className="btn-clear-preview" title="O‘chirish">
                    ✕
                  </button>
                </div>
              )}
            </div>
            <div style={{ marginTop: 8 }}>
              <input
                name="bannerUrl"
                placeholder="yoki tayyor banner URL havolasi (ixtiyoriy)"
                disabled={isPending}
              />
            </div>
          </div>
        </div>

        {/* 3. Chiqish jadvali va Sozlamalar */}
        <div className="form-section-title" style={{ marginTop: 24 }}>
          3. Chiqish Jadvali va Qo‘shimcha Sozlamalar
        </div>

        <div className="row2">
          <div className="field">
            <label>Haftalik Chiqish Kuni (Ongoing jadvali uchun)</label>
            <select name="releaseDay" defaultValue="" disabled={isPending}>
              <option value="">Belgilanmagan (Jadvalsiz)</option>
              <option value="dushanba">Dushanba</option>
              <option value="seshanba">Seshanba</option>
              <option value="chorshanba">Chorshanba</option>
              <option value="payshanba">Payshanba</option>
              <option value="juma">Juma</option>
              <option value="shanba">Shanba</option>
              <option value="yakshanba">Yakshanba</option>
            </select>
          </div>

          <div className="field">
            <label>Dublyaj / Fandub Jamoasi</label>
            <input
              name="fandubTeam"
              defaultValue="Anicity Dub"
              placeholder="Anicity Dub"
              disabled={isPending}
            />
          </div>
        </div>

        <div className="row2" style={{ alignItems: 'center', marginTop: 12 }}>
          <label className="checkbox-toggle-label">
            <input
              type="checkbox"
              name="is_featured"
              disabled={isPending}
            />
            <span>🌟 Tavsiya qilingan / Bosh sahifada ajratib ko‘rsatish</span>
          </label>

          <label className="checkbox-toggle-label">
            <input
              type="checkbox"
              name="is_published"
              defaultChecked
              disabled={isPending}
            />
            <span>🚀 Saytda darhol ommaga ko‘rinsin (Published)</span>
          </label>
        </div>

        {/* Info notice about decoupled episodes */}
        <div className="decoupled-info-banner">
          <span style={{ fontSize: 18 }}>💡</span>
          <span>
            <b>Eslatma:</b> Qismlar alohida boshqariladi. Ushbu animeni saqlaganingizdan so‘ng,
            avtomatik ravishda uning qismlar boshqaruvi ochiladi va har bir qismni o‘zining
            alohida Google Drive havolasi bilan yuklaysiz.
          </span>
        </div>

        <button
          type="submit"
          className="btn primary"
          style={{ width: '100%', marginTop: 20, padding: '14px 24px', fontSize: 16 }}
          disabled={isPending}
        >
          {isPending ? '⏳ Saqlanmoqda va rasmlar yuklanmoqda...' : '💾 Anime Ma’lumotlarini Saqlash'}
        </button>
      </form>
    </div>
  );
}
