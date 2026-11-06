'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateOwnProfile } from '@/app/actions/profile';

const initialState = { success: false, error: null, message: null };

export default function ProfileEditor({
  displayName = '',
  avatarUrl = '',
  username = '',
  email = '',
  bio = '',
  onOpenModal,
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(updateOwnProfile, initialState);
  const [preview, setPreview] = useState(avatarUrl || '');
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [clientError, setClientError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [bioText, setBioText] = useState(bio || '');
  const [displayNameVal, setDisplayNameVal] = useState(displayName || '');
  const fileInput = useRef(null);
  const formRef = useRef(null);

  useEffect(() => {
    setPreview(avatarUrl || '');
    setDisplayNameVal(displayName || '');
    setBioText(bio || '');
  }, [avatarUrl, displayName, bio]);

  useEffect(() => () => {
    if (preview && preview.startsWith('blob:')) {
      URL.revokeObjectURL(preview);
    }
  }, [preview]);

  useEffect(() => {
    if (state?.success) {
      setSaveSuccess(true);
      router.refresh();
      const timer = setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [state, router]);

  const onImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
      event.target.value = '';
      setClientError('Faqat JPEG, PNG yoki WebP formatdagi rasmlar (2 MB gacha) qabul qilinadi.');
      return;
    }

    setClientError('');
    setRemoveAvatar(false);
    setPreview(URL.createObjectURL(file));
  };

  const onRemove = () => {
    if (fileInput.current) fileInput.current.value = '';
    setPreview('');
    setRemoveAvatar(true);
    setClientError('');
  };

  const onCancel = () => {
    formRef.current?.reset();
    if (fileInput.current) fileInput.current.value = '';
    setPreview(avatarUrl || '');
    setRemoveAvatar(false);
    setClientError('');
    setDisplayNameVal(displayName || '');
    setBioText(bio || '');
  };

  return (
    <div className="stitch-inline-editor-card">
      <div className="stitch-inline-editor-header">
        <div className="stitch-inline-header-left">
          <div className="stitch-modal-title-icon">
            <span className="material-symbols-outlined">tune</span>
          </div>
          <div>
            <h3 className="stitch-inline-title">Profil Sozlamalari va Tahrirlash</h3>
            <p className="stitch-inline-subtitle">Ismingiz, rasmingiz va shaxsiy bio ma’lumotlaringizni yangilang</p>
          </div>
        </div>

        {onOpenModal && (
          <button
            type="button"
            onClick={onOpenModal}
            className="stitch-btn-modal-pop"
            title="Alohida modal oynada ochish"
          >
            <span className="material-symbols-outlined">open_in_new</span>
            <span>Modalda ochish</span>
          </button>
        )}
      </div>

      <form ref={formRef} action={action} className="stitch-inline-form">
        <div className="stitch-avatar-card">
          <div className="stitch-avatar-preview-wrap">
            <div className="stitch-avatar-ring">
              {preview ? (
                <img
                  src={preview}
                  alt="Profil rasmi"
                  className="stitch-avatar-img"
                />
              ) : (
                <div className="stitch-avatar-fallback">
                  {(displayNameVal || username || 'A').charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <span className="stitch-avatar-camera-badge">
              <span className="material-symbols-outlined">photo_camera</span>
            </span>
          </div>

          <div className="stitch-avatar-details">
            <h4 className="stitch-avatar-heading">Profil Rasmi (Avatar)</h4>
            <p className="stitch-avatar-hint">
              JPEG, PNG yoki WebP formatda (maksimal 2 MB). Kvadrat shakldagi rasmlar tavsiya etiladi.
            </p>
            <div className="stitch-avatar-actions">
              <label htmlFor="inline-profile-avatar" className="stitch-btn-upload">
                <span className="material-symbols-outlined">cloud_upload</span>
                <span>Rasm yuklash</span>
              </label>
              <input
                ref={fileInput}
                id="inline-profile-avatar"
                name="avatar"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={onImageChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={onRemove}
                disabled={!preview || pending}
                className="stitch-btn-delete"
              >
                <span className="material-symbols-outlined">delete</span>
                <span>Rasmni olib tashlash</span>
              </button>
            </div>
          </div>
        </div>

        {removeAvatar && <input type="hidden" name="avatarAction" value="remove" />}

        {/* Display name */}
        <div className="stitch-form-field">
          <label htmlFor="inline-display-name" className="stitch-form-label">
            <span>Ko‘rinadigan Ism (Display Name)</span>
            <span className="stitch-counter">{displayNameVal.length} / 80 belgi</span>
          </label>
          <div className="stitch-input-wrap">
            <input
              id="inline-display-name"
              name="display_name"
              type="text"
              maxLength={80}
              value={displayNameVal}
              onChange={(e) => setDisplayNameVal(e.target.value)}
              placeholder="Ismingiz yoki taxallusingiz"
              className="stitch-text-input"
            />
            <span className="stitch-input-icon material-symbols-outlined">badge</span>
          </div>
        </div>

        {/* Username & Email Read-Only Strip */}
        <div className="stitch-inline-readonly-grid">
          <div className="stitch-form-field">
            <label className="stitch-form-label">
              <span>Username</span>
            </label>
            <div className="stitch-input-wrap stitch-input-readonly">
              <span className="stitch-prefix">@</span>
              <input
                type="text"
                readOnly
                value={username || 'user'}
                className="stitch-text-input stitch-mono pl-8"
              />
              <span className="stitch-input-icon material-symbols-outlined stitch-text-cyan">verified</span>
            </div>
          </div>

          <div className="stitch-form-field">
            <label className="stitch-form-label">
              <span>Email</span>
            </label>
            <div className="stitch-input-wrap stitch-input-readonly">
              <input
                type="email"
                readOnly
                value={email || ''}
                className="stitch-text-input"
              />
              <span className="stitch-input-icon material-symbols-outlined stitch-text-cyan">lock</span>
            </div>
          </div>
        </div>

        {/* Bio */}
        <div className="stitch-form-field">
          <label htmlFor="inline-bio" className="stitch-form-label">
            <span>Bio / Shaxsiy ma’lumot</span>
            <span className="stitch-counter">{bioText.length} / 500 belgi</span>
          </label>
          <textarea
            id="inline-bio"
            name="bio"
            rows={3}
            maxLength={500}
            value={bioText}
            onChange={(e) => setBioText(e.target.value)}
            placeholder="Sevimli anime janrlaringiz yoki o‘zingiz haqingizda..."
            className="stitch-textarea"
          />
        </div>

        {/* Feedback alerts */}
        {clientError && (
          <div className="stitch-alert stitch-alert-error" role="alert">
            <span className="material-symbols-outlined">error</span>
            <span>{clientError}</span>
          </div>
        )}
        {state?.error && (
          <div className="stitch-alert stitch-alert-error" role="alert">
            <span className="material-symbols-outlined">error</span>
            <span>{state.error}</span>
          </div>
        )}
        {(state?.message || saveSuccess) && (
          <div className="stitch-alert stitch-alert-success" role="status">
            <span className="material-symbols-outlined">check_circle</span>
            <span>{state?.message || 'Profilingiz muvaffaqiyatli yangilandi!'}</span>
          </div>
        )}

        {/* Actions */}
        <div className="stitch-inline-actions">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="stitch-btn-cancel"
          >
            Bekor qilish
          </button>
          <button
            type="submit"
            disabled={pending}
            className="stitch-btn-save"
          >
            {pending ? (
              <>
                <svg className="stitch-spinner" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>Saqlanmoqda…</span>
              </>
            ) : saveSuccess ? (
              <>
                <span className="material-symbols-outlined">done</span>
                <span>Saqlandi!</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined">save</span>
                <span>O‘zgarishlarni saqlash</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
