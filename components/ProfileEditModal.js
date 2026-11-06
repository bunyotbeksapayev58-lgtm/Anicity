'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { updateOwnProfile } from '@/app/actions/profile';

const initialState = { success: false, error: null, message: null };

export default function ProfileEditModal({
  isOpen,
  onClose,
  displayName = '',
  avatarUrl = '',
  username = '',
  email = '',
  bio = '',
}) {
  const [state, action, pending] = useActionState(updateOwnProfile, initialState);
  const [preview, setPreview] = useState(avatarUrl || '');
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [clientError, setClientError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [bioText, setBioText] = useState(bio || '');
  const [displayNameVal, setDisplayNameVal] = useState(displayName || '');
  const fileInput = useRef(null);
  const formRef = useRef(null);
  const modalRef = useRef(null);

  // Sync props when modal opens or props change
  useEffect(() => {
    if (isOpen) {
      setPreview(avatarUrl || '');
      setRemoveAvatar(false);
      setClientError('');
      setSaveSuccess(false);
      setDisplayNameVal(displayName || '');
      setBioText(bio || '');
    }
  }, [isOpen, avatarUrl, displayName, bio]);

  // Clean up object URLs to prevent memory leaks
  useEffect(() => () => {
    if (preview && preview.startsWith('blob:')) {
      URL.revokeObjectURL(preview);
    }
  }, [preview]);

  // Handle successful submission
  useEffect(() => {
    if (state?.success) {
      setSaveSuccess(true);
      const timer = setTimeout(() => {
        onClose?.();
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [state, onClose]);

  // Close on Escape key press & prevent body scroll
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !pending) {
        onClose?.();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, pending, onClose]);

  if (!isOpen) return null;

  const onImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
      event.target.value = '';
      setClientError('Faqat JPEG, PNG yoki WebP rasmlar 2 MB gacha qabul qilinadi.');
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
    onClose?.();
  };

  const handleBackdropClick = (e) => {
    if (e.target === modalRef.current && !pending) {
      onClose?.();
    }
  };

  return (
    <div
      ref={modalRef}
      onClick={handleBackdropClick}
      className="stitch-modal-overlay"
      id="edit-profile-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-profile-modal-title"
    >
      <div className="stitch-modal-container">
        {/* Modal Header */}
        <div className="stitch-modal-header">
          <div className="stitch-modal-title-group">
            <div className="stitch-modal-title-icon">
              <span className="material-symbols-outlined">manage_accounts</span>
            </div>
            <div>
              <h3 id="edit-profile-modal-title" className="stitch-modal-title">
                Profil ma’lumotlarini tahrirlash
              </h3>
              <p className="stitch-modal-subtitle">
                Cyber Jamiyatdagi shaxsiy profilingiz sozlamalari
              </p>
            </div>
          </div>
          <button
            type="button"
            className="stitch-modal-close-btn"
            onClick={onCancel}
            disabled={pending}
            title="Yopish"
            aria-label="Yopish"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Modal Body / Form */}
        <form ref={formRef} action={action} className="stitch-modal-form">
          <div className="stitch-modal-body">
            {/* Avatar Management Section */}
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
                      {(displayNameVal || username || email || 'A').charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <span className="stitch-avatar-camera-badge" title="Avatar">
                  <span className="material-symbols-outlined">photo_camera</span>
                </span>
              </div>

              <div className="stitch-avatar-details">
                <h4 className="stitch-avatar-heading">Profil Rasmi (Avatar)</h4>
                <p className="stitch-avatar-hint">
                  Tavsiya etiladi: Kamida 500x500px, JPEG, PNG yoki WebP formatda (2 MB gacha).
                </p>
                <div className="stitch-avatar-actions">
                  <label htmlFor="modal-profile-avatar" className="stitch-btn-upload">
                    <span className="material-symbols-outlined">cloud_upload</span>
                    <span>Rasm yuklash</span>
                  </label>
                  <input
                    ref={fileInput}
                    id="modal-profile-avatar"
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
                    <span>Rasmni o‘chirish</span>
                  </button>
                </div>
              </div>
            </div>

            {removeAvatar && <input type="hidden" name="avatarAction" value="remove" />}

            {/* Form Input 1: Display Name */}
            <div className="stitch-form-field">
              <label htmlFor="modal-display-name" className="stitch-form-label">
                <span>Display Name / Ko‘rinadigan Ism</span>
                {displayNameVal.trim().length > 0 && (
                  <span className="stitch-label-valid">
                    <span className="material-symbols-outlined">check_circle</span> To‘g‘ri kiritildi
                  </span>
                )}
              </label>
              <div className="stitch-input-wrap">
                <input
                  id="modal-display-name"
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
              <p className="stitch-input-hint">
                Fikrlaringiz va jonli chatlarda aynan shu ism aks etadi.
              </p>
            </div>

            {/* Form Input 2: Username */}
            <div className="stitch-form-field">
              <label className="stitch-form-label">
                <span>Username / Foydalanuvchi nomi</span>
                <span className="stitch-label-valid">
                  <span className="material-symbols-outlined">verified</span> Mavjud va tasdiqlangan
                </span>
              </label>
              <div className="stitch-input-wrap stitch-input-readonly">
                <span className="stitch-prefix">@</span>
                <input
                  type="text"
                  readOnly
                  value={username || 'user'}
                  className="stitch-text-input stitch-mono pl-8"
                />
                <span className="stitch-input-icon material-symbols-outlined stitch-text-cyan">check_circle</span>
              </div>
              <p className="stitch-input-hint">
                Sizning unikal profil identifikatoringiz: @{username || 'user'}
              </p>
            </div>

            {/* Form Input 3: Email Address (Read-only) */}
            <div className="stitch-form-field">
              <label className="stitch-form-label">
                <span>Email manzili</span>
                <span className="stitch-badge-verified">
                  <span className="material-symbols-outlined">mark_email_read</span> Tasdiqlangan
                </span>
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
              <p className="stitch-input-hint">
                Bildirishnomalar va xavfsizlik login kodi ushbu pochtaga yuboriladi.
              </p>
            </div>

            {/* Form Input 4: Bio / O'zingiz haqingizda */}
            <div className="stitch-form-field">
              <label htmlFor="modal-bio" className="stitch-form-label">
                <span>Bio / O‘zingiz haqingizda</span>
                <span className="stitch-counter">{bioText.length} / 500 belgi</span>
              </label>
              <textarea
                id="modal-bio"
                name="bio"
                rows={3}
                maxLength={500}
                value={bioText}
                onChange={(e) => setBioText(e.target.value)}
                placeholder="Sevimli anime janrlaringiz yoki o‘zingiz haqingizda qisqacha ma’lumot..."
                className="stitch-textarea"
              />
              <p className="stitch-input-hint">
                Profilingizga kirgan boshqa anime muxlislari uchun qisqa izoh.
              </p>
            </div>

            {/* Alerts */}
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
                <span>{state?.message || 'Profilingiz muvaffaqiyatli saqlandi!'}</span>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="stitch-modal-footer">
            <span className="stitch-footer-security">
              <span className="material-symbols-outlined">lock</span>
              <span>Barcha ma’lumotlar shifrlangan</span>
            </span>

            <div className="stitch-footer-actions">
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
          </div>
        </form>
      </div>
    </div>
  );
}
