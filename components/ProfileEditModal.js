'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { updateOwnProfile } from '@/app/actions/profile';
import { updateOwnCredentials } from '@/app/actions/auth';

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeModalTab, setActiveModalTab] = useState('profile'); // 'profile' | 'security'

  // Profile Action State
  const [state, action, pending] = useActionState(updateOwnProfile, initialState);
  const [preview, setPreview] = useState(avatarUrl || '');
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [clientError, setClientError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [bioText, setBioText] = useState(bio || '');
  const [displayNameVal, setDisplayNameVal] = useState(displayName || '');

  // Credentials Action State
  const [credState, credAction, credPending] = useActionState(updateOwnCredentials, initialState);
  const [newUsername, setNewUsername] = useState(username || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [credClientError, setCredClientError] = useState('');
  const [credSuccess, setCredSuccess] = useState(false);

  const fileInput = useRef(null);
  const formRef = useRef(null);
  const credFormRef = useRef(null);
  const modalRef = useRef(null);

  // Sync props when modal opens or initial values change
  useEffect(() => {
    if (isOpen) {
      setPreview(avatarUrl || '');
      setRemoveAvatar(false);
      setClientError('');
      setSaveSuccess(false);
      setDisplayNameVal(displayName || '');
      setBioText(bio || '');

      setNewUsername(username || '');
      setNewPassword('');
      setConfirmPassword('');
      setCredClientError('');
      setCredSuccess(false);

      if (searchParams?.get('edit') === 'credentials') {
        setActiveModalTab('security');
      }
    }
  }, [isOpen, avatarUrl, displayName, bio, username, searchParams]);

  // Clean up blob URLs to prevent memory leaks
  useEffect(() => () => {
    if (preview && preview.startsWith('blob:')) {
      URL.revokeObjectURL(preview);
    }
  }, [preview]);

  // Handle successful profile submission
  useEffect(() => {
    if (state?.success) {
      setSaveSuccess(true);
      router.refresh();
      const timer = setTimeout(() => {
        onClose?.();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [state, onClose, router]);

  // Handle successful credentials submission
  useEffect(() => {
    if (credState?.success) {
      setCredSuccess(true);
      router.refresh();
      const timer = setTimeout(() => {
        setCredSuccess(false);
        setNewPassword('');
        setConfirmPassword('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [credState, router]);

  // Close on Escape key press & prevent background scroll
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !pending && !credPending) {
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
  }, [isOpen, pending, credPending, onClose]);

  if (!isOpen) return null;

  const onImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
      event.target.value = '';
      setClientError('Faqat JPEG, PNG yoki WebP rasmlar (maksimal 2 MB) qabul qilinadi.');
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
  };

  const onCancel = () => {
    if (fileInput.current) fileInput.current.value = '';
    setPreview(avatarUrl || '');
    setRemoveAvatar(false);
    setClientError('');
    setCredClientError('');
    onClose?.();
  };

  const handleBackdropClick = (e) => {
    if (e.target === modalRef.current && !pending && !credPending) {
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
                Profil va Xavfsizlik Sozlamalari
              </h3>
              <p className="stitch-modal-subtitle">
                Shaxsiy profil, login va parolni tahrirlash
              </p>
            </div>
          </div>
          <button
            type="button"
            className="stitch-modal-close-btn"
            onClick={onCancel}
            disabled={pending || credPending}
            title="Yopish"
            aria-label="Yopish"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div style={{ display: 'flex', gap: 12, padding: '0 24px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', background: 'rgba(255, 255, 255, 0.02)' }}>
          <button
            type="button"
            onClick={() => setActiveModalTab('profile')}
            style={{
              padding: '12px 16px',
              background: 'none',
              border: 'none',
              borderBottom: activeModalTab === 'profile' ? '2px solid #00CEC9' : '2px solid transparent',
              color: activeModalTab === 'profile' ? '#00CEC9' : 'var(--text-muted)',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>badge</span>
            <span>Profil Ma’lumotlari</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveModalTab('security')}
            style={{
              padding: '12px 16px',
              background: 'none',
              border: 'none',
              borderBottom: activeModalTab === 'security' ? '2px solid #00CEC9' : '2px solid transparent',
              color: activeModalTab === 'security' ? '#00CEC9' : 'var(--text-muted)',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>lock</span>
            <span>🔐 Login va Parol</span>
          </button>
        </div>

        {/* TAB 1: Profile Details Form */}
        {activeModalTab === 'profile' && (
          <form ref={formRef} action={action} className="stitch-modal-form">
            <div className="stitch-modal-body">
              {/* Avatar Upload Block */}
              <div className="stitch-avatar-upload-block">
                <div className="stitch-avatar-preview-ring">
                  {preview ? (
                    <img src={preview} alt="Avatar preview" className="stitch-avatar-preview-img" />
                  ) : (
                    <div className="stitch-avatar-preview-fallback">
                      {(displayNameVal || username || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="stitch-avatar-actions">
                  <span className="stitch-avatar-label">Profil rasmi (Avatar)</span>
                  <div className="stitch-avatar-buttons">
                    <input
                      ref={fileInput}
                      type="file"
                      name="avatar"
                      id="avatar-input"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={onImageChange}
                      className="stitch-visually-hidden"
                      disabled={pending}
                    />
                    <label htmlFor="avatar-input" className="stitch-btn-upload">
                      <span className="material-symbols-outlined">photo_camera</span>
                      <span>Rasm tanlash</span>
                    </label>
                    <button
                      type="button"
                      onClick={onRemove}
                      disabled={!preview || pending}
                      className="stitch-btn-delete"
                    >
                      <span className="material-symbols-outlined">delete</span>
                      <span>Olib tashlash</span>
                    </button>
                  </div>
                </div>
              </div>

              {removeAvatar && <input type="hidden" name="avatarAction" value="remove" />}

              {/* Display Name */}
              <div className="stitch-form-field">
                <label htmlFor="modal-display-name" className="stitch-form-label">
                  <span>Display Name / Ko‘rinadigan Ism</span>
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
              </div>

              {/* Email Address (Read-only) */}
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
              </div>

              {/* Bio */}
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
                <span>Ma’lumotlar xavfsiz shifrlangan</span>
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
                  {pending ? 'Saqlanmoqda…' : saveSuccess ? 'Saqlandi!' : 'O‘zgarishlarni saqlash'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* TAB 2: Credentials (Username & Password) Form */}
        {activeModalTab === 'security' && (
          <form ref={credFormRef} action={credAction} className="stitch-modal-form">
            <div className="stitch-modal-body">
              <div style={{ padding: '12px 16px', background: 'rgba(0, 206, 201, 0.08)', borderRadius: 10, border: '1px solid rgba(0, 206, 201, 0.2)', marginBottom: 16 }}>
                <span style={{ fontSize: 13, color: '#00CEC9', fontWeight: 600 }}>
                  🛡️ Ushbu bo‘lim orqali tizimga kirish login (username) va parolingizni xavfsiz o‘zgartirishingiz mumkin.
                </span>
              </div>

              {/* Username Input */}
              <div className="stitch-form-field">
                <label className="stitch-form-label">
                  <span>Login (Username)</span>
                  <span className="stitch-label-valid">3–20 ta harf, raqam yoki _</span>
                </label>
                <div className="stitch-input-wrap">
                  <span className="stitch-prefix">@</span>
                  <input
                    name="username"
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="yangi_username"
                    maxLength={20}
                    className="stitch-text-input stitch-mono pl-8"
                  />
                  <span className="stitch-input-icon material-symbols-outlined stitch-text-cyan">person</span>
                </div>
                <p className="stitch-input-hint">
                  Saytga kirishda va profilingizda ushbu login ishlatiladi.
                </p>
              </div>

              {/* New Password */}
              <div className="stitch-form-field">
                <label className="stitch-form-label">
                  <span>Yangi Parol</span>
                  <span className="stitch-label-valid">Kamida 6 ta belgi</span>
                </label>
                <div className="stitch-input-wrap">
                  <input
                    name="new_password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Yangi parolni kiriting"
                    autoComplete="new-password"
                    className="stitch-text-input"
                  />
                  <span className="stitch-input-icon material-symbols-outlined stitch-text-cyan">key</span>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="stitch-form-field">
                <label className="stitch-form-label">
                  <span>Yangi Parolni Tasdiqlang</span>
                </label>
                <div className="stitch-input-wrap">
                  <input
                    name="confirm_password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Yangi parolni qayta kiriting"
                    autoComplete="new-password"
                    className="stitch-text-input"
                  />
                  <span className="stitch-input-icon material-symbols-outlined stitch-text-cyan">lock_reset</span>
                </div>
              </div>

              {/* Alerts for credentials */}
              {credClientError && (
                <div className="stitch-alert stitch-alert-error" role="alert">
                  <span className="material-symbols-outlined">error</span>
                  <span>{credClientError}</span>
                </div>
              )}
              {credState?.error && (
                <div className="stitch-alert stitch-alert-error" role="alert">
                  <span className="material-symbols-outlined">error</span>
                  <span>{credState.error}</span>
                </div>
              )}
              {(credState?.message || credSuccess) && (
                <div className="stitch-alert stitch-alert-success" role="status">
                  <span className="material-symbols-outlined">check_circle</span>
                  <span>{credState?.message || 'Login va parolingiz muvaffaqiyatli saqlandi!'}</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="stitch-modal-footer">
              <span className="stitch-footer-security">
                <span className="material-symbols-outlined">verified_user</span>
                <span>SSL 256-bit shifrlangan</span>
              </span>

              <div className="stitch-footer-actions">
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={credPending}
                  className="stitch-btn-cancel"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={credPending || (!newPassword && newUsername === username)}
                  className="stitch-btn-save"
                >
                  {credPending ? 'Saqlanmoqda…' : credSuccess ? 'Saqlandi!' : '🔐 Yangi Parolni Saqlash'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
