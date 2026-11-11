'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function CookieBanner() {
  const [mounted, setMounted] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const consent = localStorage.getItem('anicity_cookie_consent');
      if (!consent) {
        setShow(true);
      }
    } catch {
      // In case of restricted iframe/storage
      setShow(false);
    }
  }, []);

  const handleAcceptAll = () => {
    try {
      localStorage.setItem('anicity_cookie_consent', 'accepted');
      window.dispatchEvent(new CustomEvent('cookie_consent_updated', { detail: 'accepted' }));
    } catch {}
    setShow(false);
  };

  const handleEssentialOnly = () => {
    try {
      localStorage.setItem('anicity_cookie_consent', 'essential');
      window.dispatchEvent(new CustomEvent('cookie_consent_updated', { detail: 'essential' }));
    } catch {}
    setShow(false);
  };

  if (!mounted || !show) return null;

  return (
    <div
      role="region"
      aria-label="Cookie xabarnomasi"
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'calc(100% - 40px)',
        maxWidth: '820px',
        zIndex: 9999,
        background: 'rgba(15, 17, 26, 0.95)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(139, 92, 246, 0.35)',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6), 0 0 30px rgba(139, 92, 246, 0.15)',
        borderRadius: '16px',
        padding: '20px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '20px',
        flexWrap: 'wrap',
        animation: 'slideUp 0.35s ease-out forwards',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', flex: '1 1 380px' }}>
        <span style={{ fontSize: '28px', lineHeight: 1 }}>🍪</span>
        <div>
          <h4 style={{ color: '#fff', fontSize: '15px', fontWeight: 700, marginBottom: '4px' }}>
            Biz Cookie fayllaridan foydalanamiz
          </h4>
          <p style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '13px', lineHeight: 1.5, margin: 0 }}>
            Platforma xavfsizligini ta’minlash, video pleyer sozlamalarini eslab qolish va sayt tezligini tahlil qilish uchun zaruriy va analitik cookie fayllaridan foydalanamiz. Batafsil{' '}
            <Link href="/cookies" style={{ color: '#a78bfa', textDecoration: 'underline' }}>
              Cookie Siyosati
            </Link>
            .
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <button
          onClick={handleEssentialOnly}
          type="button"
          style={{
            background: 'rgba(255, 255, 255, 0.06)',
            color: '#cbd5e1',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            padding: '9px 16px',
            borderRadius: '10px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)')}
          onMouseOut={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)')}
        >
          Faqat zaruriylar
        </button>

        <button
          onClick={handleAcceptAll}
          type="button"
          style={{
            background: 'linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)',
            color: '#ffffff',
            border: 'none',
            padding: '9px 20px',
            borderRadius: '10px',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(124, 58, 237, 0.4)',
            transition: 'all 0.2s',
          }}
          onMouseOver={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')}
          onMouseOut={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
        >
          Barchasini qabul qilish
        </button>
      </div>
    </div>
  );
}
