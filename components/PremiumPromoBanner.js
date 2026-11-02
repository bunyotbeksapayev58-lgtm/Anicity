import Link from 'next/link';

export default function PremiumPromoBanner() {
  return (
    <section className="premium-promo-section">
      <div className="premium-promo-card">
        <div className="premium-glow-effect" />
        <div className="premium-promo-left">
          <div className="premium-crown-badge">
            <span>👑</span> ANICITY VIP PASS
          </div>
          <h2 className="premium-promo-title">
            Anime olamiga <span className="grad">cheksiz va yuqori sifatda</span> sho‘ng‘ing
          </h2>
          <p className="premium-promo-desc">
            Anicity VIP a’zosi bo‘ling — 1080p Full HD sifat, hech qanday reklamalarsiz silliq tomosha va eng yangi epizodlar birinchilardan bo‘lib siz uchun!
          </p>

          <div className="premium-features-row">
            <div className="feature-item">
              <span className="check-icon">✓</span>
              <span>1080p Full HD Sifat</span>
            </div>
            <div className="feature-item">
              <span className="check-icon">✓</span>
              <span>100% Reklamasiz</span>
            </div>
            <div className="feature-item">
              <span className="check-icon">✓</span>
              <span>Tezkor VIP Serverlar</span>
            </div>
            <div className="feature-item">
              <span className="check-icon">✓</span>
              <span>Maxsus Kontent</span>
            </div>
          </div>

          <div className="premium-actions-row">
            <Link href="/premium" className="btn-vip-primary">
              👑 VIP Obunani Ko‘rish
            </Link>
            <span className="vip-price-hint">Oylik atigi 25,000 so‘mdan</span>
          </div>
        </div>

        <div className="premium-promo-right">
          <div className="vip-card-mockup">
            <div className="vip-mockup-inner">
              <div className="mockup-header">
                <span className="mockup-brand">ANICITY VIP</span>
                <span className="mockup-chip">1080p</span>
              </div>
              <div className="mockup-stars">★★★★★</div>
              <p className="mockup-quote">“Sevimli animelaringizni hech qanday to‘siqlarsiz tomosha qiling!”</p>
              <div className="mockup-footer">
                <span className="mockup-id">PREMIUM MEMBER</span>
                <span className="mockup-status">FAOL</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
