'use client';

import { useState, useRef, useTransition } from 'react';
import Link from 'next/link';

export default function AnimeEditForm({ action, defaults }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const [posterPreview, setPosterPreview] = useState(defaults.poster_url || null);
  const [bannerPreview, setBannerPreview] = useState(defaults.banner_url || null);

  const formRef = useRef(null);
  const d = defaults;

  const handlePosterChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Poster hajmi 5 MB dan oshmasligi kerak');
        e.target.value = '';
        return;
      }
      setError(null);
      setPosterPreview(URL.createObjectURL(file));
    }
  };

  const handleBannerChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Banner hajmi 5 MB dan oshmasligi kerak');
        e.target.value = '';
        return;
      }
      setError(null);
      setBannerPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const formData = new FormData(formRef.current);

    startTransition(async () => {
      try {
        const res = await action(null, formData);
        if (res?.error) {
          setError(res.error);
        } else if (res?.message) {
          setMessage(res.message);
        }
      } catch (err) {
        setError(err.message || 'Kutilmagan xatolik yuz berdi');
      }
    });
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="admin-form-styled">
      <input type="hidden" name="id" value={d.id} />
      <input type="hidden" name="oldPoster" value={d.poster_url || ''} />

      {message && <div className="admin-alert-success" style={{ marginBottom: 16 }}>🎉 {message}</div>}
      {error && <div className="admin-alert-error" style={{ marginBottom: 16 }}>⚠️ {error}</div>}

      <div style={{ marginBottom: 16, background: 'rgba(108, 92, 231, 0.1)', padding: 12, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>📺 Ushbu anime qismlarini mustaqil boshqarish:</span>
        <Link href={`/admin?tab=episodes&animeId=${d.id}`} className="btn primary sm">
          Qismlar Boshqaruvi →
        </Link>
      </div>

      <div className="field">
        <label>Anime Nomi *</label>
        <input name="title" defaultValue={d.title} required disabled={isPending} />
      </div>

      <div className="row2">
        <div className="field">
          <label>Asl / Inglizcha Nomi (Alt title)</label>
          <input name="alt_title" defaultValue={d.alt_title || ''} disabled={isPending} />
        </div>
        <div className="field">
          <label>Yil</label>
          <input name="year" type="number" min="1960" max="2100" defaultValue={d.year || 2025} disabled={isPending} />
        </div>
      </div>

      <div className="row2">
        <div className="field">
          <label>Holati</label>
          <select name="status" defaultValue={d.status || 'Davom etmoqda'} disabled={isPending}>
            <option value="Davom etmoqda">Davom etmoqda (Ongoing)</option>
            <option value="Tugallangan">Tugallangan</option>
          </select>
        </div>
        <div className="field">
          <label>Yosh Cheklovi</label>
          <select name="age_rating" defaultValue={d.age_rating || '12+'} disabled={isPending}>
            <option value="0+">0+</option>
            <option value="6+">6+</option>
            <option value="12+">12+</option>
            <option value="16+">16+</option>
            <option value="18+">18+</option>
          </select>
        </div>
      </div>

      <div className="row2">
        <div className="field">
          <label>Animatsiya Studiyasi</label>
          <input name="studio" defaultValue={d.studio || ''} placeholder="MAPPA, Ufotable..." disabled={isPending} />
        </div>
        <div className="field">
          <label>Rejissyor</label>
          <input name="director" defaultValue={d.director || ''} disabled={isPending} />
        </div>
      </div>

      <div className="row2">
        <div className="field">
          <label>Chiqish kuni (Jadval)</label>
          <select name="releaseDay" defaultValue={d.release_day || ''} disabled={isPending}>
            <option value="">Belgilanmagan</option>
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
          <label>Dublyaj jamoasi</label>
          <input name="fandubTeam" defaultValue={d.fandub_team || 'Anicity Dub'} disabled={isPending} />
        </div>
      </div>

      <div className="field">
        <label>Janrlar (vergul bilan)</label>
        <input name="genres" defaultValue={(d.genres || []).join(', ')} disabled={isPending} />
      </div>

      <div className="field">
        <label>Tavsif</label>
        <textarea name="description" rows={4} defaultValue={d.description || ''} disabled={isPending} />
      </div>

      {/* Poster and Banner updates */}
      <div className="row2">
        <div className="field">
          <label>Yangi poster fayl yuklash (3-5 MB gacha)</label>
          <input name="poster" type="file" accept="image/*" onChange={handlePosterChange} disabled={isPending} />
          {posterPreview && (
            <div className="preview-container" style={{ marginTop: 8 }}>
              <img src={posterPreview} alt="" className="preview-img poster" />
            </div>
          )}
          <input name="posterUrl" defaultValue={d.poster_url || ''} placeholder="yoki URL" style={{ marginTop: 6 }} disabled={isPending} />
        </div>

        <div className="field">
          <label>Yangi banner fayl yuklash (3-5 MB gacha)</label>
          <input name="banner" type="file" accept="image/*" onChange={handleBannerChange} disabled={isPending} />
          {bannerPreview && (
            <div className="preview-container" style={{ marginTop: 8 }}>
              <img src={bannerPreview} alt="" className="preview-img banner" />
            </div>
          )}
          <input name="bannerUrl" defaultValue={d.banner_url || ''} placeholder="yoki URL" style={{ marginTop: 6 }} disabled={isPending} />
        </div>
      </div>

      <div className="row2" style={{ alignItems: 'center', marginTop: 12 }}>
        <label className="checkbox-toggle-label">
          <input type="checkbox" name="is_featured" defaultChecked={Boolean(d.is_featured)} disabled={isPending} />
          <span>🌟 Tavsiya qilingan / Bosh sahifada ko‘rsatish</span>
        </label>
        <label className="checkbox-toggle-label">
          <input type="checkbox" name="is_published" defaultChecked={d.is_published !== false} disabled={isPending} />
          <span>🚀 Saytda ommaga ko‘rinsin (Published)</span>
        </label>
      </div>

      <button className="btn primary" style={{ width: '100%', marginTop: 20 }} disabled={isPending}>
        {isPending ? '⏳ Saqlanmoqda...' : '💾 O‘zgarishlarni Saqlash'}
      </button>
    </form>
  );
}
