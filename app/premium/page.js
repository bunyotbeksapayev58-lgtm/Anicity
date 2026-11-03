import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'VIP Obuna — Reklamasiz 1080p Anime Tomosha Qiling | Anicity',
  description: 'Anicity VIP a’zoligi orqali sevimli animelaringizni 1080p Full HD sifatda, hech qanday reklamalarsiz va yangi qismlarni birinchilardan bo‘lib tomosha qiling.',
};

export default async function PremiumPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // 1. Fetch dynamic subscription plans from DB
  const { data: plansRaw } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  const plans = plansRaw && plansRaw.length > 0 ? plansRaw : [
    {
      id: 'p1',
      name: '1 Oylik VIP',
      slug: 'vip_1_month',
      description: 'Barcha imkoniyatlarni sinab ko‘rish uchun qulay muddat',
      price_uzs: 25000,
      duration_days: 30,
      benefits: ['1080p Full HD sifat', '100% Reklamasiz tomosha', 'Yangi qismlarni birinchi bo‘lib ko‘rish', 'VIP status nishoni'],
      is_popular: false,
    },
    {
      id: 'p2',
      name: '3 Oylik VIP',
      slug: 'vip_3_months',
      description: 'Eng mashhur va tavsiya etiladigan tarif — 15% chegirma',
      price_uzs: 65000,
      duration_days: 90,
      benefits: ['1080p Full HD va 4K player', '100% Reklamasiz tomosha', 'Yangi premyeralar navbatsiz', 'Tezkor VIP serverlar', 'Yopiq VIP chatga kirish'],
      is_popular: true,
    },
    {
      id: 'p3',
      name: '1 Yillik VIP',
      slug: 'vip_1_year',
      description: 'Butun yil davomida to‘liq xotirjamlik va maksimal 30% chegirma',
      price_uzs: 220000,
      duration_days: 365,
      benefits: ['Barcha imkoniyatlar to‘liq ochiq', 'Eng yuqori bitreytli sifat', 'Butun yil davomida kafolatlangan xizmat', 'Maxsus oltin VIP nishon', '30% tejamkorlik'],
      is_popular: false,
    },
  ];

  // 2. Fetch User Profile & Subscriptions
  let userProfile = null;
  let userSubs = [];
  let userTransactions = [];

  if (user) {
    const { data: prof } = await supabase
      .from('profiles')
      .select('subscription_plan, subscription_expires_at, username')
      .eq('id', user.id)
      .maybeSingle();
    userProfile = prof;

    const { data: subs } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    userSubs = subs || [];

    const { data: txs } = await supabase
      .from('subscription_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    userTransactions = txs || [];
  }

  const now = new Date();
  const isVip =
    userProfile?.subscription_plan === 'vip' &&
    (!userProfile.subscription_expires_at || new Date(userProfile.subscription_expires_at) > now);

  const expiresDate = userProfile?.subscription_expires_at
    ? new Date(userProfile.subscription_expires_at)
    : null;

  let daysRemaining = null;
  if (isVip && expiresDate) {
    daysRemaining = Math.max(1, Math.ceil((expiresDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  }

  return (
    <div className="premium-page-wrapper">
      {/* Hero header */}
      <div className="premium-hero">
        <div className="premium-badge-glow">
          <span>👑</span> ANICITY VIP CLUB
        </div>
        <h1 className="premium-main-heading">
          Haqiqiy Anime Muxlislari Uchun <br />
          <span className="grad">Cheksiz Imkoniyatlar</span>
        </h1>
        <p className="premium-sub-heading">
          1080p Full HD sifat, 0 soniya reklama, tezkor serverlar va yangi qismlarni premyeradan avval tomosha qilish imkoniyati.
        </p>

        {isVip && (
          <div className="vip-active-alert">
            <span style={{ fontSize: 24 }}>🎉</span>
            <div>
              <b>Tabriklaymiz! Sizning ANICITY VIP obunangiz faol.</b>
              <div style={{ fontSize: 13, marginTop: 4, opacity: 0.9 }}>
                Tugash sanasi:{' '}
                <b>
                  {expiresDate
                    ? expiresDate.toLocaleDateString('uz-UZ', { year: 'numeric', month: 'long', day: 'numeric' })
                    : 'Cheksiz'}
                </b>{' '}
                {daysRemaining !== null && `(${daysRemaining} kun qoldi)`}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Pricing Cards Grid */}
      <div className="pricing-cards-grid">
        {plans
          .filter((p) => p.slug !== 'free')
          .map((plan) => (
            <div key={plan.id} className={`pricing-card ${plan.is_popular ? 'popular' : ''}`}>
              {plan.is_popular && <div className="popular-ribbon">ENG OMMABOP</div>}
              <div className={`plan-badge ${plan.is_popular ? 'vip' : 'standard'}`}>
                {plan.duration_days >= 365 ? 'MAKSIMAL VIP' : plan.duration_days >= 90 ? 'TEJAMKOR' : 'STANDART'}
              </div>

              <h3 className="plan-title">{plan.name}</h3>
              <p className="plan-desc">{plan.description || `${plan.duration_days} kunlik to‘liq VIP imkoniyatlar`}</p>

              <div className="plan-price">
                <span className="price-amount">{Number(plan.price_uzs).toLocaleString()}</span>
                <span className="price-currency">
                  UZS / {plan.duration_days >= 365 ? 'yil' : `${plan.duration_days} kun`}
                </span>
              </div>

              {plan.benefits && plan.benefits.length > 0 && (
                <ul className="plan-features-list">
                  {plan.benefits.map((benefit, idx) => (
                    <li key={idx}>
                      <span className="tick">✓</span> {benefit}
                    </li>
                  ))}
                </ul>
              )}

              <div className="plan-action">
                {user ? (
                  <a
                    href={`https://t.me/anicity_admin?text=${encodeURIComponent(`Salom, men Anicity platformasida “${plan.name}” (${Number(plan.price_uzs).toLocaleString()} UZS) obunasini faollashtirmoqchiman. Mening username: @${userProfile?.username || user.email}`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className={`btn-plan-select ${plan.is_popular ? 'primary-grad' : ''}`}
                  >
                    👑 {plan.name}ni Faollashtirish
                  </a>
                ) : (
                  <Link href="/login?next=/premium" className={`btn-plan-select ${plan.is_popular ? 'primary-grad' : ''}`}>
                    Kirish va Obuna Bo‘lish
                  </Link>
                )}
              </div>
            </div>
          ))}
      </div>

      {/* User Subscription History (if logged in and has history) */}
      {user && userSubs.length > 0 && (
        <div className="card admin-pane" style={{ maxWidth: 1000, margin: '40px auto 0' }}>
          <h3 className="admin-pane-title">📜 Sizning Obunalar Tarixingiz</h3>
          <div className="table-wrapper-pro" style={{ marginTop: 14 }}>
            <table className="pro-table">
              <thead>
                <tr>
                  <th>Tarif Rejasi</th>
                  <th>Boshlangan sana</th>
                  <th>Tugash sanasi</th>
                  <th>Holati</th>
                  <th>Berilgan usul</th>
                </tr>
              </thead>
              <tbody>
                {userSubs.map((sub) => {
                  const subActive = sub.status === 'active' && new Date(sub.expires_at) > now;
                  return (
                    <tr key={sub.id}>
                      <td><b>{sub.plan_name}</b></td>
                      <td>{new Date(sub.starts_at).toLocaleDateString('uz-UZ')}</td>
                      <td>{new Date(sub.expires_at).toLocaleDateString('uz-UZ')}</td>
                      <td>
                        <span className={subActive ? 'badge-published' : 'badge-draft'}>
                          {subActive ? '● Faol' : '⌛ Yakunlangan'}
                        </span>
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                        {sub.grant_type === 'manual_admin' ? 'Admin tomonidan' : 'To‘lov orqali'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
                <td className="vip-col">1080p Full HD va 4K Ultra HD</td>
              </tr>
              <tr>
                <td>Reklama</td>
                <td>Mavjud</td>
                <td className="vip-col">Mutlaqo 0 soniya reklama</td>
              </tr>
              <tr>
                <td>Yangi qismlarni tomosha qilish</td>
                <td>Umumiy chiqish vaqtida</td>
                <td className="vip-col">Birinchilardan bo‘lib</td>
              </tr>
              <tr>
                <td>Yuklab olish tezligi</td>
                <td>Standart</td>
                <td className="vip-col">Maksimal (Tezkor VIP CDN)</td>
              </tr>
              <tr>
                <td>Qurilmalar soni</td>
                <td>1 ta qurilma</td>
                <td className="vip-col">Cheksiz (Telefon, Smart TV, Kompyuter)</td>
              </tr>
              <tr>
                <td>Maxsus profil nishoni</td>
                <td>Yo‘q</td>
                <td className="vip-col">Oltin toj 👑 VIP nishoni</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Methods */}
      <div className="payment-gateways-row">
        <span className="pay-label">Qo‘llab-quvvatlanadigan to‘lov tizimlari:</span>
        <div className="gateways-logos">
          <span className="pay-card">Payme</span>
          <span className="pay-card">Click</span>
          <span className="pay-card">Uzum Bank</span>
          <span className="pay-card">Oson / Karta</span>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="premium-faq-section">
        <h2 className="faq-title">Ko‘p Beriladigan Savollar</h2>
        <div className="faq-accordion-list">
          <div className="faq-item">
            <h4 className="faq-q">VIP obuna qanday faollashtiriladi?</h4>
            <p className="faq-a">
              Tarifni tanlab to‘lov qilganingizdan so‘ng, profilingizga bir necha daqiqada avtomatik yoki admin orqali VIP nishoni va barcha imkoniyatlar biriktiriladi.
            </p>
          </div>
          <div className="faq-item">
            <h4 className="faq-q">Boshqa qurilmadan kirsa obuna saqlanadimi?</h4>
            <p className="faq-a">
              Ha! Telefoningiz, planshetingiz, kompyuteringiz yoki Smart TV brauzerida xuddi shu login bilan kirsangiz, obunangiz barcha qurilmalarda birdek ishlaydi.
            </p>
          </div>
          <div className="faq-item">
            <h4 className="faq-q">Obuna muddati tugasa nima bo‘ladi?</h4>
            <p className="faq-a">
              Obuna muddati tugaganda profilingiz oddiy a’zolikka qaytadi. Sizning hisobingiz, ko‘rish tarixi yoki saqlangan animelaringiz hech qachon o‘chirilmaydi.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
