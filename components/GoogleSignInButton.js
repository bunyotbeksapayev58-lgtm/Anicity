'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function GoogleSignInButton({ next, label = 'Google bilan kirish' }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleGoogleSignIn() {
    try {
      setLoading(true);
      setError(null);
      const supabase = createClient();
      const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext)}`;

      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (oauthError) {
        setError(oauthError.message);
        setLoading(false);
      }
    } catch (err) {
      setError(err?.message || 'Google tizimiga ulanishda xatolik yuz berdi');
      setLoading(false);
    }
  }

  return (
    <div style={{ width: '100%' }}>
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={loading}
        className="btn ghost"
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          background: '#ffffff',
          color: '#1f1f1f',
          border: '1px solid rgba(255,255,255,0.15)',
          fontWeight: 600,
          borderRadius: 12,
          padding: '10px 16px',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.04h3.88c2.27-2.09 3.66-5.17 3.66-9.14z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.04c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.13C3.27 21.43 7.33 24 12 24z"
          />
          <path
            fill="#FBBC05"
            d="M5.28 14.28c-.25-.72-.38-1.49-.38-2.28s.13-1.56.38-2.28V6.59H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.41l4.03-3.13z"
          />
          <path
            fill="#EA4335"
            d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.27 2.57 1.25 6.59l4.03 3.13c.95-2.83 3.6-4.97 6.72-4.97z"
          />
        </svg>
        {loading ? 'Ulanmoqda...' : label}
      </button>
      {error && (
        <div className="err" style={{ marginTop: 8, fontSize: 13, color: '#ff4d6d' }}>
          {error}
        </div>
      )}
    </div>
  );
}
