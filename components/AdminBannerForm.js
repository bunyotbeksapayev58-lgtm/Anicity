'use client';

import { useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { createBanner } from '@/app/actions/admin';

export default function AdminBannerForm({ animes = [], onBannerCreated }) {
  const [bannerType, setBannerType] = useState('image'); // 'image' | 'video'
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);

  const [imageUrlInput, setImageUrlInput] = useState('');
  const [videoUrlInput, setVideoUrlInput] = useState('');

  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [formSuccess, setFormSuccess] = useState(null);

  const formRef = useRef(null);
  const imageInputRef = useRef(null);
  const videoInputRef = useRef(null);

  // Handle Image File selection
  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      setImageFile(null);
      setImagePreview(null);
      return;
    }
    const validMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/gif'];
    if (!validMimes.includes(file.type.toLowerCase())) {
      setFormError('Faqat JPG, PNG, GIF yoki WebP formatdagi rasm yuklashingiz mumkin');
      e.target.value = '';
      setImageFile(null);
      setImagePreview(null);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setFormError('Rasm hajmi 10 MB dan oshmasligi kerak');
      e.target.value = '';
      setImageFile(null);
      setImagePreview(null);
      return;
    }
    setFormError(null);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  // Handle Video File selection
  const handleVideoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      setVideoFile(null);
      setVideoPreview(null);
      return;
    }
    const validMimes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska'];
    const isVideoExt = /\.(mp4|webm|mov|mkv)$/i.test(file.name || '');
    if (!validMimes.includes(file.type.toLowerCase()) && !isVideoExt) {
      setFormError('Faqat MP4, WebM yoki MOV formatdagi video yuklashingiz mumkin');
      e.target.value = '';
      setVideoFile(null);
      setVideoPreview(null);
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setFormError('Video hajmi 50 MB dan oshmasligi kerak (katta videolar uchun tashqi URL kiriting)');
      e.target.value = '';
      setVideoFile(null);
      setVideoPreview(null);
      return;
    }
    setFormError(null);
    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const clearVideo = () => {
    setVideoFile(null);
    setVideoPreview(null);
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  // Direct client-side storage upload to avoid Server Action 1MB payload limits and prevent React Error #441
  const uploadDirectToStorage = async (supabase, file, bucket) => {
    const rawExt = String(file.name || '').split('.').pop() || 'mp4';
    const cleanExt = rawExt.toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4';
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${cleanExt}`;

    setUploadStatus(`Yuklanmoqda: ${file.name}...`);
    setUploadProgress(20);

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(fileName, file, {
        upsert: true,
        contentType: file.type,
      });

    if (uploadError) {
      throw new Error(`Storage yuklashda xatolik: ${uploadError.message}`);
    }

    setUploadProgress(70);
    const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(fileName);
    return publicData.publicUrl;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    setIsSubmitting(true);
    setUploadProgress(0);

    try {
      const formData = new FormData(formRef.current);
      const title = formData.get('title');
      if (!title) {
        throw new Error('Banner sarlavhasi kiritilishi shart');
      }

      const supabase = createClient();
      let finalImageUrl = imageUrlInput.trim() || null;
      let finalVideoUrl = videoUrlInput.trim() || null;

      // 1. Direct upload video file if selected
      if (videoFile) {
        setUploadStatus('Video fayl yuklanmoqda (50 MB gacha)...');
        finalVideoUrl = await uploadDirectToStorage(supabase, videoFile, 'anime-banners');
        setUploadProgress(80);
      }

      // 2. Direct upload image file if selected
      if (imageFile) {
        setUploadStatus('Banner rasmi yuklanmoqda...');
        finalImageUrl = await uploadDirectToStorage(supabase, imageFile, 'anime-banners');
        setUploadProgress(90);
      }

      // Validation: at least image or video must be present
      if (!finalImageUrl && !finalVideoUrl) {
        throw new Error('Banner rasmi yoki video fayli (yoki havolasi) kiritilishi shart');
      }

      setUploadStatus('Ma’lumotlar bazasiga saqlanmoqda...');
      setUploadProgress(95);

      // Prepare payload for Server Action without heavy binary files
      const payload = new FormData();
      payload.set('title', String(formData.get('title') || ''));
      payload.set('subtitle', String(formData.get('subtitle') || ''));
      payload.set('anime_id', String(formData.get('anime_id') || ''));
      payload.set('linkUrl', String(formData.get('linkUrl') || ''));
      payload.set('sort_order', String(formData.get('sort_order') || '1'));
      payload.set('is_active', formData.get('is_active') ? 'on' : 'off');
      if (finalImageUrl) payload.set('imageUrl', finalImageUrl);
      if (finalVideoUrl) payload.set('videoUrl', finalVideoUrl);

      const res = await createBanner(null, payload);

      if (res?.error) {
        setFormError(res.error);
      } else {
        setFormSuccess(res?.message || 'Banner muvaffaqiyatli saqlandi!');
        formRef.current?.reset();
        clearImage();
        clearVideo();
        setImageUrlInput('');
        setVideoUrlInput('');
        setUploadProgress(100);
        if (onBannerCreated) onBannerCreated();
      }
    } catch (err) {
      console.error('Banner upload error:', err);
      setFormError(err.message || 'Banner yuklashda xatolik yuz berdi');
    } finally {
      setIsSubmitting(false);
      setUploadStatus('');
    }
  };

  return (
    <div className="admin-banner-form-card">
      {/* Type Switcher Tabs */}
      <div className="banner-type-tabs">
        <button
          type="button"
          className={`banner-type-tab ${bannerType === 'image' ? 'active' : ''}`}
          onClick={() => setBannerType('image')}
        >
          🎨 Rasm Banner
        </button>
        <button
          type="button"
          className={`banner-type-tab ${bannerType === 'video' ? 'active' : ''}`}
          onClick={() => setBannerType('video')}
        >
          🎥 Video Banner (Cinematic)
        </button>
      </div>

      <form ref={formRef} onSubmit={handleSubmit} className="admin-subform">
        <div className="field">
          <label htmlFor="banner-title">Banner Sarlavhasi *</label>
          <input
            id="banner-title"
            name="title"
            required
            placeholder="Masalan: Solo Leveling: Arise"
            disabled={isSubmitting}
          />
        </div>

        <div className="field">
          <label htmlFor="banner-subtitle">Tavsif yoki Shior</label>
          <textarea
            id="banner-subtitle"
            name="subtitle"
            placeholder="Masalan: Dunyoning eng kuchli ovchisining yuksalishi..."
            style={{ minHeight: 65 }}
            disabled={isSubmitting}
          />
        </div>

        <div className="row2">
          <div className="field">
            <label htmlFor="banner-anime">Bog‘langan Anime (ixtiyoriy)</label>
            <select id="banner-anime" name="anime_id" disabled={isSubmitting}>
              <option value="">-- Tanlanmagan --</option>
              {animes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title} ({a.year})
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="banner-link">Tashqi / Qo‘lda havola</label>
            <input
              id="banner-link"
              name="linkUrl"
              placeholder="/anime/xyz yoki https://..."
              disabled={isSubmitting}
            />
          </div>
        </div>

        {/* ================= IMAGE BANNER SECTION ================= */}
        <div className="media-upload-section" style={{ display: bannerType === 'image' || imageFile || imageUrlInput ? 'block' : 'none' }}>
          <div className="section-subtitle">🎨 Banner Rasmi (Fon va Poster)</div>
          <div className="row2">
            <div className="field">
              <label>Kompyuterdan rasm yuklash (maks 10MB)</label>
              <div className="file-upload-box">
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/jpg,image/gif"
                  onChange={handleImageChange}
                  disabled={isSubmitting}
                />
                {imagePreview && (
                  <div className="preview-container">
                    <img src={imagePreview} alt="Banner preview" className="preview-img banner" />
                    <button type="button" onClick={clearImage} className="btn-clear-preview" title="O‘chirish">
                      ✕
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="field">
              <label>Yoki Rasm URL havolasi</label>
              <input
                value={imageUrlInput}
                onChange={(e) => setImageUrlInput(e.target.value)}
                placeholder="https://images.unsplash.com/..."
                disabled={isSubmitting}
              />
            </div>
          </div>
        </div>

        {/* ================= VIDEO BANNER SECTION ================= */}
        <div className="media-upload-section" style={{ display: bannerType === 'video' || videoFile || videoUrlInput ? 'block' : 'none' }}>
          <div className="section-subtitle">🎥 Video Banner (Hero Bosh Slayder Harakatli Fon)</div>
          <p className="hint">
            Bosh sahifaning katta slaydida avtomatik ovozsiz aylanadigan video fon (MP4, WebM yoki tashqi video havola).
          </p>
          <div className="row2">
            <div className="field">
              <label>Kompyuterdan video yuklash (MP4/WebM, maks 50MB)</label>
              <div className="file-upload-box">
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime,video/x-matroska"
                  onChange={handleVideoChange}
                  disabled={isSubmitting}
                />
                {videoPreview && (
                  <div className="preview-container video">
                    <video src={videoPreview} controls playsInline className="preview-video banner" />
                    <button type="button" onClick={clearVideo} className="btn-clear-preview" title="O‘chirish">
                      ✕
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="field">
              <label>Yoki Video URL havolasi (MP4 / YouTube / Drive)</label>
              <input
                value={videoUrlInput}
                onChange={(e) => setVideoUrlInput(e.target.value)}
                placeholder="https://cdn.example.com/trailer.mp4"
                disabled={isSubmitting}
              />
            </div>
          </div>
        </div>

        {/* Extra Settings Row: Sort order and Active */}
        <div className="row2" style={{ alignItems: 'center', marginTop: 12 }}>
          <div className="field">
            <label htmlFor="banner-sort">Tartib raqami</label>
            <input id="banner-sort" name="sort_order" type="number" defaultValue="1" min="0" disabled={isSubmitting} />
          </div>

          <div className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 }}>
            <input
              id="banner-active"
              name="is_active"
              type="checkbox"
              defaultChecked
              disabled={isSubmitting}
              style={{ width: 'auto', cursor: 'pointer' }}
            />
            <label htmlFor="banner-active" style={{ cursor: 'pointer', margin: 0 }}>
              Hozir faol bo‘lsin (Bosh sahifada ko‘rinsin)
            </label>
          </div>
        </div>

        {/* Live Upload Progress Bar */}
        {isSubmitting && (
          <div className="upload-progress-container" style={{ margin: '14px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6, color: 'var(--accent)' }}>
              <span>{uploadStatus || 'Bajarilmoqda...'}</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="progress-track" style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 999, overflow: 'hidden' }}>
              <div
                className="progress-bar-fill"
                style={{ width: `${uploadProgress}%`, height: '100%', background: 'var(--accent-gradient)', transition: 'width 0.2s ease' }}
              />
            </div>
          </div>
        )}

        {/* Alerts */}
        {formError && <div className="err" style={{ marginBottom: 12 }}>⚠️ {formError}</div>}
        {formSuccess && <div className="ok" style={{ marginBottom: 12 }}>🎉 {formSuccess}</div>}

        <button
          type="submit"
          className="btn primary"
          style={{ width: '100%', minHeight: 46, marginTop: 6 }}
          disabled={isSubmitting}
        >
          {isSubmitting ? '⏳ Yuklanmoqda va saqlanmoqda...' : '+ Yangi Bannerni Saqlash'}
        </button>
      </form>
    </div>
  );
}
