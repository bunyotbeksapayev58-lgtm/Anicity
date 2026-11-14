'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function PlanCheckoutButtons({ plan, user, userProfile }) {
  const [loadingProvider, setLoadingProvider] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  if (!user) {
    return (
      <Link
        href="/login?next=/premium"
        className={`btn-plan-select ${plan.is_popular ? 'primary-grad' : ''}`}
      >
        Kirish va Obuna Bo‘lish
      </Link>
    );
  }

  const handleCheckout = async (provider) => {
    try {
      setErrorMsg(null);
      setLoadingProvider(provider);

      const res = await fetch('/api/payments/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: plan.id,
          provider,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'To‘lov xizmatiga ulanishda xatolik yuz berdi');
      }

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error('To‘lov havolasi olinmadi');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Xatolik yuz berdi');
      setLoadingProvider(null);
    }
  };

  const telegramAdmin = process.env.NEXT_PUBLIC_TELEGRAM_ADMIN || 'anicity_admin';
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'AniCity';
  const telegramUrl = `https://t.me/${telegramAdmin.replace(/^@/, '')}?text=${encodeURIComponent(
    `Salom, men ${siteName} platformasida “${plan.name}” (${Number(plan.price_uzs).toLocaleString()} UZS) obunasini faollashtirmoqchiman. Mening username: @${userProfile?.username || user.email}`
  )}`;

  return (
    <div className="plan-checkout-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
      {errorMsg && (
        <div style={{ color: '#ef4444', fontSize: '12px', background: 'rgba(239, 68, 68, 0.1)', padding: '6px 10px', borderRadius: '6px', textAlign: 'center' }}>
          {errorMsg}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <button
          type="button"
          onClick={() => handleCheckout('click')}
          disabled={loadingProvider !== null}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
            color: '#fff',
            fontWeight: 600,
            fontSize: '13px',
            padding: '10px 12px',
            borderRadius: '8px',
            border: 'none',
            cursor: loadingProvider !== null ? 'not-allowed' : 'pointer',
            opacity: loadingProvider !== null ? 0.7 : 1,
            transition: 'all 0.2s ease',
          }}
        >
          {loadingProvider === 'click' ? 'Yuklanmoqda...' : '🔵 Click'}
        </button>

        <button
          type="button"
          onClick={() => handleCheckout('payme')}
          disabled={loadingProvider !== null}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
            color: '#fff',
            fontWeight: 600,
            fontSize: '13px',
            padding: '10px 12px',
            borderRadius: '8px',
            border: 'none',
            cursor: loadingProvider !== null ? 'not-allowed' : 'pointer',
            opacity: loadingProvider !== null ? 0.7 : 1,
            transition: 'all 0.2s ease',
          }}
        >
          {loadingProvider === 'payme' ? 'Yuklanmoqda...' : '🟢 Payme'}
        </button>
      </div>

      <a
        href={telegramUrl}
        target="_blank"
        rel="noreferrer"
        style={{
          display: 'block',
          textAlign: 'center',
          fontSize: '11px',
          color: '#94a3b8',
          textDecoration: 'underline',
          marginTop: '2px',
        }}
      >
        Yoki Telegram orqali faollashtirish
      </a>
    </div>
  );
}
