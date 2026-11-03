'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { updateOwnProfile } from '@/app/actions/profile';

const initialState = { success: false, error: null, message: null };

export default function ProfileEditor({ displayName = '', avatarUrl = '', username = '' }) {
  const [state, action, pending] = useActionState(updateOwnProfile, initialState);
  const [preview, setPreview] = useState(avatarUrl || '');
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [clientError, setClientError] = useState('');
  const fileInput = useRef(null);
  const formRef = useRef(null);

  useEffect(() => () => {
    if (preview.startsWith('blob:')) URL.revokeObjectURL(preview);
  }, [preview]);

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
  };

  const onCancel = () => {
    formRef.current?.reset();
    if (fileInput.current) fileInput.current.value = '';
    setPreview(avatarUrl || '');
    setRemoveAvatar(false);
    setClientError('');
  };

  return (
    <form ref={formRef} action={action} className="profile-edit-form">
      <h2 className="admin-pane-title">Profilni tahrirlash</h2>
      <p className="hint">Ismingiz va profil rasmingizni yangilang.</p>
      <div className="profile-edit-avatar-row">
        <div className="profile-edit-avatar" aria-label="Rasm ko‘rinishi">
          {preview ? <img src={preview} alt="Profil rasmi ko‘rinishi" /> : <span>{(displayName || username || 'A').charAt(0).toUpperCase()}</span>}
        </div>
        <div className="profile-edit-avatar-controls">
          <label className="btn ghost sm" htmlFor="profile-avatar">Rasm tanlash</label>
          <input
            ref={fileInput}
            id="profile-avatar"
            name="avatar"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={onImageChange}
          />
          <button className="btn ghost sm" type="button" onClick={onRemove} disabled={!preview}>Rasmni olib tashlash</button>
          <small>JPEG, PNG yoki WebP · 2 MB gacha</small>
        </div>
      </div>
      <label className="profile-edit-name-label" htmlFor="display-name">Ko‘rinadigan ism</label>
      <input id="display-name" name="display_name" type="text" maxLength={80} defaultValue={displayName} className="search-input-pro" />
      {removeAvatar && <input type="hidden" name="avatarAction" value="remove" />}
      {clientError && <p className="admin-alert-error" role="alert">{clientError}</p>}
      {state.error && <p className="admin-alert-error" role="alert">{state.error}</p>}
      {state.message && <p className="admin-alert-success" role="status">{state.message}</p>}
      <div className="profile-edit-actions">
        <button className="btn primary" type="submit" disabled={pending}>{pending ? 'Saqlanmoqda…' : 'Saqlash'}</button>
        <button className="btn ghost" type="button" onClick={onCancel} disabled={pending}>Bekor qilish</button>
      </div>
    </form>
  );
}
