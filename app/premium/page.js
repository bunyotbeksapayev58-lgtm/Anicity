import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export const metadata = {
  title: 'VIP Obuna — Reklamasiz 1080p Anime Tomosha Qiling | Anicity',
  description: 'Anicity VIP a’zoligi orqali sevimli animelaringizni 1080p Full HD sifatda, hech qanday reklamalarsiz va yangi qismlarni birinchilardan bo‘lib tomosha qiling.',
};

export default async function PremiumPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let userProfile = null;
  if (user) {
    const { data } = await supabase.from('profiles').select('subscription_plan, subscription_expires_at').eq('id', user.id).maybeSingle();
    userProfile = data;
  }

  const isVip = userProfile?.subscription_plan === 'vip';

  return (
    <div className="premium-page-wrapper">
      {/* Hero header */}
      <div className="premium-hero">
        <div className="premium-badge-glow">
          <span>👑</span> ANICITY VIP CLUB
        </div>
        <h1 className="premium-main-heading">
          Haqiqiy Anime Muhlislari Uchun <br />
          <span className="grad">Cheksiz Imkoniyatlar</span>
        </h1>
        <p className="premium-sub-heading">
          1080p Full HD sifat, 0 soniya reklama, tezkor serverlar va yangi qismlarni premyeradan avval tomosha qilish imkoniyati.
        </p>

        {isVip && (
          <div className="vip-active-alert">
            🎉 Siz hozirda <b>ANICITY VIP</b> a’zosisiz! Barcha premium imkoniyatlar faol.
          </div>
        )}
      </div>

      {/* Pricing Cards Grid */}
      <div className="pricing-cards-grid">
        {/* Plan 1: 1 Month */}
        <div className="pricing-card">
          <div className="plan-badge standard">STANDART</div>
          <h3 className="plan-title">1 Oylik VIP</h3>
          <p className="plan-desc">Barcha imkoniyatlarni sinab ko‘rish uchun qulay muddat</p>
          <div className="plan-price">
            <span className="price-amount">25,000</span>
            <span className="price-currency">UZS / oy</span>
          </div>

          <ul className="plan-features-list">
            <li><span className="tick">✓</span> 1080p Full HD sifat</li>
            <li><span className="tick">✓</span> 100% Reklamasiz tomosha</li>
            <li><span className="tick">✓</span> Yangi qismlar birinchi bo‘lib</li>
            <li><span className="tick">✓</span> VIP statusli belgi</li>
            <li className="dim"><span className="cross">✕</span> Yillik maxsus sovg‘alar</li>
          </ul>

          <div className="plan-action">
            {user ? (
              <a
                href="https://t.me/anicity_admin"
                target="_blank"
                rel="noreferrer"
                className="btn-plan-select"
              >
                1 Oylikni Faollashtirish
              </a>
            ) : (
              <Link href="/login?next=/premium" className="btn-plan-select">
                Kirish va Obuna Bo‘lish
              </Link>
            )}
          </div>
        </div>

        {/* Plan 2: 3 Months */}
        <div className="pricing-card popular">
          <div className="popular-ribbon">ENG OMMABOP</div>
          <div className="plan-badge vip">TEJAMKOR</div>
          <h3 className="plan-title">3 Oylik VIP</h3>
          <p className="plan-desc">Eng mashhur va tavsiya etiladigan tanlov</p>
          <div className="plan-price">
            <span className="price-amount">65,000</span>
            <span className="price-currency">UZS / 3 oy</span>
          </div>
          <span className="save-badge">15% Tejang</span>

          <ul className="plan-features-list">
            <li><span className="tick">✓</span> 1080p Full HD va 4K player</li>
            <li><span className="tick">✓</span> 100% Reklamasiz tomosha</li>
            <li><span className="tick">✓</span> Yangi premyeralar navbatsiz</li>
            <li><span className="tick">✓</span> Cheksiz saqlash va yuklab olish</li>
            <li><span className="tick">✓</span> Yopiq VIP chatga kirish</li>
          </ul>

          <div className="plan-action">
            {user ? (
              <a
                href="https://t.me/anicity_admin"
                target="_blank"
                rel="noreferrer"
                className="btn-plan-select primary-grad"
              >
                👑 3 Oylikni Faollashtirish
              </a>
            ) : (
              <Link href="/login?next=/premium" className="btn-plan-select primary-grad">
                Kirish va Obuna Bo‘lish
              </Link>
            )}
          </div>
        </div>

        {/* Plan 3: 1 Year */}
        <div className="pricing-card">
          <div className="plan-badge luxury">MAKSIMAL VIP</div>
          <h3 className="plan-title">1 Yillik VIP</h3>
          <p className="plan-desc">Butun yil davomida to‘liq xotirjamlik va maksimal chegirma</p>
          <div className="plan-price">
            <span className="price-amount">220,000</span>
            <span className="price-currency">UZS / yil</span>
          </div>
          <span className="save-badge gold">30% Tejang</span>

          <ul className="plan-features-list">
            <li><span className="tick">✓</span> Barcha imkoniyatlar to‘liq ochiq</li>
            <li><span className="tick">✓</span> Eng yuqori bitreytli sifat</li>
            <li><span className="tick">✓</span> Butun yil davomida kafolatlangan xizmat</li>
            <li><span className="tick">✓</span> Maxsus oltin VIP nishon</li>
            <li><span className="tick">✓</span> Ovoz beruvchilar bilan jonli muloqot</li>
          </ul>

          <div className="plan-action">
            {user ? (
              <a
                href="https://t.me/anicity_admin"
                target="_blank"
                rel="noreferrer"
                className="btn-plan-select"
              >
                1 Yillikni Faollashtirish
              </a>
            ) : (
              <Link href="/login?next=/premium" className="btn-plan-select">
                Kirish va Obuna Bo‘lish
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Comparison Table */}
      <div className="comparison-table-section">
        <h2 className="comparison-heading">Imkoniyatlar Taqqoslashi</h2>
        <div className="table-wrapper-pro">
          <table className="pro-table">
            <thead>
              <tr>
                <th>Xususiyat</th>
                <th>Oddiy A’zolik</th>
                <th className="vip-col">👑 ANICITY VIP</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Video Sifati</td>
                <td>480p / 720p</td>
                <td className="vip-col">1080p Full HD</td>
              </tr>
              <tr>
                <td>Reklama</td>
                <td>Mavjud</td>
                <td className="vip-col">Mutlaqo Reklamasiz</td>
              </tr>
              <tr>
                <td>Yangi qismlarni tomosha qilish</td>
                <td>Umumiy chiqish vaqtida</td>
                <td className="vip-col">Birinchilardan bo‘lib</td>
              </tr>
              <tr>
                <td>Yuklab olish tezligi</td>
                <td>Standart</td>
                <td className="vip-col">Maksimal (VIP CDN)</td>
              </tr>
              <tr>
                <td>Qurilmalar soni</td>
                <td>1 ta qurilma</td>
                <td className="vip-col">Cheksiz qurilmalar</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Methods */}
      <div className="payment-gateways-row">
        <span className="pay-label">To‘lov tizimlari:</span>
        <div className="gateways-logos">
          <span className="pay-card">Payme</span>
          <span className="pay-card">Click</span>
          <span className="pay-card">Uzum Bank</span>
          <span className="pay-card">Karta orqali</span>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="premium-faq-section">
        <h2 className="faq-title">Ko‘p Beriladigan Savollar</h2>
        <div className="faq-accordion-list">
          <div className="faq-item">
            <h4 className="faq-q">VIP obuna qanday faollashtiriladi?</h4>
            <p className="faq-a">
              Tarifni tanlab to‘lovni amalga oshirgach, profilingizga bir necha daqiqada avtomatik VIP belgisi va imkoniyatlar biriktiriladi.
            </p>
          </div>
          <div className="faq-item">
            <h4 className="faq-q">Boshqa qurilmadan kirsa obuna saqlanadimi?</h4>
            <p className="faq-a">
              Ha! Telefoningiz, planshetingiz, kompyuteringiz yoki Smart TV brauzerida xuddi shu login bilan kirsangiz, obunangiz barcha qurilmalarda ishlaydi.
            </p>
          </div>
          <div className="faq-item">
            <h4 className="faq-q">Xarid bekor qilinsa pul qaytariladimi?</h4>
            <p className="faq-a">
              Agar xizmat sifati bo‘yicha texnik muammo yuzaga kelsa, qo‘llab-quvvatlash xizmatimiz to‘lovni to‘liq qaytarib beradi.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
