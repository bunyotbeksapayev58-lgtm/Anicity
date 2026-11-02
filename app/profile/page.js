import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import AnimeCard from '@/components/AnimeCard';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Mening Profilim — Anicity',
};

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?next=/profile');
  }

  // 1. Fetch user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role, subscription_plan, subscription_expires_at, created_at')
    .eq('id', user.id)
    .single();

  // 2. Fetch Watch History (Ko'rish tarixi)
  const { data: historyRaw } = await supabase
    .from('watch_progress')
    .select('position_sec, duration_sec, updated_at, episode_id, anime_id, episodes(number, title, anime_id, animes(id, title, poster_url, year, status, genres, rating_avg))')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(12);

  const historyList = (historyRaw || []).filter((h) => h.episodes?.animes);

  // 3. Fetch Favorites (Saqlangan animelar)
  const { data: favoritesRaw } = await supabase
    .from('favorites')
    .select('created_at, animes(id, title, poster_url, year, status, genres, rating_avg, studio, view_count)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(16);

  const favoritesList = (favoritesRaw || []).map((f) => f.animes).filter(Boolean);

  const isVip = profile?.subscription_plan === 'vip';
  const joinDate = profile?.created_at ? new Date(profile.created_at).toLocaleDateString('uz-UZ', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Yaqinda';

  return (
    <div className="profile-page-wrapper">
      {/* Profile Header Hero */}
      <div className="profile-hero-card">
        <div className="profile-hero-bg-blur" />
        <div className="profile-header-content">
          <div className="profile-avatar-large">
            <div className="avatar-big-circle">
              {(profile?.username || user.email || 'A').charAt(0).toUpperCase()}
            </div>
            {isVip && <span className="avatar-vip-crown" title="VIP A’zo">👑</span>}
          </div>

          <div className="profile-info-block">
            <div className="profile-name-row">
              <h1 className="profile-display-name">
                {profile?.display_name || profile?.username || user.email?.split('@')[0]}
              </h1>
              {isVip ? (
                <span className="badge-vip-status">👑 VIP A’ZO</span>
              ) : (
                <span className="badge-free-status">ODDIY A’ZO</span>
              )}
            </div>

            <p className="profile-email-text">
              @{profile?.username || 'user'} • {user.email}
            </p>
            <p className="profile-joined-text">
              A’zo bo‘lgan sana: <b>{joinDate}</b>
            </p>
          </div>

          <div className="profile-header-action">
            {!isVip ? (
              <Link href="/premium" className="btn-upgrade-vip">
                👑 VIP Obuna Olish
              </Link>
            ) : (
              <div className="vip-renew-info">
                <span>VIP Holat: Faol</span>
                <Link href="/premium" className="renew-link">Uzatish</Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Subscription Card Section */}
      <div className="profile-subscription-banner">
        <div className="sub-banner-left">
          <span className="sub-icon">💎</span>
          <div>
            <h3 className="sub-banner-title">
              Obuna holati: {isVip ? 'ANICITY VIP PASS' : 'Bepul Tarif'}
            </h3>
            <p className="sub-banner-desc">
              {isVip
                ? 'Sizda 1080p Full HD video ijrosi, reklamasiz rejim va erta premyeraga kirish faol.'
                : '1080p Full HD sifat va reklamasiz silliq ko‘rish uchun VIP tarifiga o‘ting.'}
            </p>
          </div>
        </div>
        <div className="sub-banner-right">
          <Link href="/premium" className="btn-manage-sub">
            {isVip ? 'Tarifni boshqarish' : 'VIPga ko‘tarish'}
          </Link>
        </div>
      </div>

      {/* Watch History Section */}
      <section className="profile-section">
        <div className="section-title-row">
          <div className="title-with-icon">
            <span className="sec-icon">🕒</span>
            <h2 className="sec-title">Ko‘rish Tarixi</h2>
          </div>
          {historyList.length > 0 && (
            <span className="sec-count">{historyList.length} ta ko‘rilgan</span>
          )}
        </div>

        {historyList.length > 0 ? (
          <div className="history-cards-grid">
            {historyList.map((item) => {
              const anime = item.episodes.animes;
              const ep = item.episodes;
              const pct = item.duration_sec > 0
                ? Math.min(100, Math.round((item.position_sec / item.duration_sec) * 100))
                : 0;

              return (
                <Link
                  key={`${anime.id}-${ep.number}`}
                  href={`/watch/${anime.id}/${ep.number}`}
                  className="history-item-card"
                >
                  <div className="history-thumb-wrap">
                    <img
                      src={anime.poster_url || '/placeholder.jpg'}
                      alt={anime.title}
                      className="history-thumb-img"
                    />
                    <div className="history-play-overlay">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                    <div className="history-progress-line">
                      <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="history-details">
                    <h4 className="history-anime-name">{anime.title}</h4>
                    <span className="history-ep-badge">{ep.number}-qism</span>
                    <span className="history-pct-text">{pct}% ko‘rildi</span>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="profile-empty-tab">
            <span className="empty-ico">📺</span>
            <p>Hozircha ko‘rish tarixi mavjud emas.</p>
            <Link href="/catalog" className="btn-ghost-sm">Katalogdan anime tanlash</Link>
          </div>
        )}
      </section>

      {/* Saved / Favorites Section */}
      <section className="profile-section">
        <div className="section-title-row">
          <div className="title-with-icon">
            <span className="sec-icon">🔖</span>
            <h2 className="sec-title">Saqlangan Animelar</h2>
          </div>
          {favoritesList.length > 0 && (
            <span className="sec-count">{favoritesList.length} ta saqlangan</span>
          )}
        </div>

        {favoritesList.length > 0 ? (
          <div className="anime-catalog-grid">
            {favoritesList.map((anime) => (
              <div key={anime.id} className="catalog-grid-item">
                <AnimeCard anime={anime} />
              </div>
            ))}
          </div>
        ) : (
          <div className="profile-empty-tab">
            <span className="empty-ico">⭐</span>
            <p>Siz hali hech qaysi animeni sevimlilarga qo‘shmadingiz.</p>
            <Link href="/catalog" className="btn-ghost-sm">Animelarni ko‘rish</Link>
          </div>
        )}
      </section>

      {/* Devices / Active Sessions Section */}
      <section className="profile-section">
        <div className="section-title-row">
          <div className="title-with-icon">
            <span className="sec-icon">📱</span>
            <h2 className="sec-title">Faol Qurilmalar va Sessiyalar</h2>
          </div>
        </div>

        <div className="devices-list-card">
          <div className="device-item current">
            <div className="device-icon">💻</div>
            <div className="device-info">
              <div className="device-name">
                Joriy Brauzer Sessiyasi <span className="current-badge">Joriy</span>
              </div>
              <div className="device-meta">
                Web brauzer • Faol holatda • Anicity Web Player
              </div>
            </div>
            <span className="status-online-dot">Online</span>
          </div>

          <div className="device-item">
            <div className="device-icon">📱</div>
            <div className="device-info">
              <div className="device-name">Mobil Brauzer / Mobil Ilova</div>
              <div className="device-meta">
                Android / iOS Webview mosligi ta’minlangan
              </div>
            </div>
            <span className="device-ready-tag">Mos</span>
          </div>
        </div>
      </section>
    </div>
  );
}
