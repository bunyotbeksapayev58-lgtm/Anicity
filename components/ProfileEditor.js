'use client';

import { useState } from 'react';
import ProfileEditModal from './ProfileEditModal';

export default function ProfileEditor({ displayName = '', avatarUrl = '', username = '', email = '', bio = '' }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div className="profile-editor-trigger-box">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="stitch-btn-edit-trigger"
          id="open-edit-modal-btn"
        >
          <span className="material-symbols-outlined">settings</span>
          <span>Profilni tahrirlash</span>
        </button>
      </div>

      <ProfileEditModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        displayName={displayName}
        avatarUrl={avatarUrl}
        username={username}
        email={email}
        bio={bio}
      />
    </>
  );
}
