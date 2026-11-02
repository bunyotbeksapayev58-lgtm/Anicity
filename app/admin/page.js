import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import AdminAnimeForm from '@/components/AdminAnimeForm';
import AdminBannerForm from '@/components/AdminBannerForm';
import AdminTrailerForm from '@/components/AdminTrailerForm';
import {
  deleteAnime,
  deleteBanner,
  toggleBannerActive,
  deleteTrailer,
  toggleTrailerActive,
  toggleUserVip,
  toggleUserSuspension,
} from '@/app/actions/admin';
import { isAdminRole } from '@/lib/roles';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Admin Panel — Anicity' };

const DAYS_MAP = {
  dushanba: 'Dushanba',
  seshanba: 'Seshanba',
  chorshanba: 'Chorshanba',
  payshanba: 'Payshanba',
  juma: 'Juma',
  shanba: 'Shanba',
  yakshanba: 'Yakshanba',
};

export default async function AdminPage({ searchParams }) {
  const { tab = 'dashboard' } = (await searchParams) || {};
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/admin');

  const { data: profile } = await supabase.from('profiles').select('role, username').eq('id', user.id).single();
  if (!isAdminRole(profile?.role)) redirect('/');

  // 1. Fetch Animes
  const { data: animesRaw } = await supabase
    .from('animes')
    .select('id, title, year, poster_url, status, view_count, rating_avg, release_day, fandub_team, episodes(id, number, title)')
    .order('created_at', { ascending: false });
  const animes = animesRaw || [];

  // 2. Fetch Banners
  const { data: bannersRaw } = await supabase
    .from('banners')
    .select('id, title, subtitle, image_url, link_url, sort_order, is_active, anime_id, anime:animes(title)')
    .order('sort_order', { ascending: true });
  const banners = bannersRaw || [];

  // 3. Fetch Trailers
  const { data: trailersRaw } = await supabase
    .from('trailers')
    .select('id, title, description, video_url, thumbnail_url, duration_text, clip_type, sort_order, is_active, anime_id, anime:animes(title)')
    .order('sort_order', { ascending: true });
  const trailers = trailersRaw || [];

  // 4. Fetch Users (Profiles)
  const { data: usersRaw } = await supabase
    .from('profiles')
    .select('id, username, display_name, role, subscription_plan, suspended_at, created_at')
    .order('created_at', { ascending: false })
    .limit(50);
  const users = usersRaw || [];

  // Stats calculation
  const totalAnimes = animes.length;
  const totalEpisodes = animes.reduce((acc, a) => acc + (a.episodes?.length || 0), 0);
  const totalViews = animes.reduce((acc, a) => acc + (Number(a.view_count) || 0), 0);
  const totalUsers = users.length;
  const totalVipUsers = users.filter((u) => u.subscription_plan === 'vip').length;

  return (
    <div className="admin-page-container">
      {/* Top Header */}
      <div className="admin-header-row">
        <div>
          <h1 className="admin-main-title">
            ⚡ Anicity <span className="grad">Admin Panel</span>
          </h1>
          <p className="admin-subtitle">
            Anibla darajasidagi to‘liq streaming boshqaruv tizimi • Kirgan foydalanuvchi: <b>{profile.username}</b> ({profile.role.toUpperCase()})
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/" className="btn ghost sm">
            ← Saytni ochish
          </Link>
          <Link href="/catalog" className="btn ghost sm">
            🎬 Katalog
          </Link>
        </div>
      </div>

      {/* Admin Nav Tabs */}
      <div className="admin-tabs-bar">
        <Link href="/admin?tab=dashboard" className={`admin-tab-btn ${tab === 'dashboard' ? 'active' : ''}`}>
          📊 Dashboard
        </Link>
        <Link href="/admin?tab=animes" className={`admin-tab-btn ${tab === 'animes' ? 'active' : ''}`}>
          🎬 Animelar ({totalAnimes})
        </Link>
        <Link href="/admin?tab=schedule" className={`admin-tab-btn ${tab === 'schedule' ? 'active' : ''}`}>
          📅 Chiqish Jadvali
        </Link>
        <Link href="/admin?tab=banners" className={`admin-tab-btn ${tab === 'banners' ? 'active' : ''}`}>
          🖼️ Hero Banners ({banners.length})
        </Link>
        <Link href="/admin?tab=trailers" className={`admin-tab-btn ${tab === 'trailers' ? 'active' : ''}`}>
          🎞️ Treylerlar ({trailers.length})
        </Link>
        <Link href="/admin?tab=users" className={`admin-tab-btn ${tab === 'users' ? 'active' : ''}`}>
          👥 Foydalanuvchilar ({totalUsers})
        </Link>
        <Link href="/admin?tab=telegram" className={`admin-tab-btn ${tab === 'telegram' ? 'active' : ''}`}>
          📢 Telegram Post
        </Link>
      </div>

      {/* ================= TAB 1: DASHBOARD ================= */}
      {tab === 'dashboard' && (
        <div className="admin-dashboard-view">
          {/* Key Metrics Grid */}
          <div className="admin-metrics-grid">
            <div className="metric-box">
              <span className="metric-icon">🎬</span>
              <div className="metric-info">
                <span className="metric-val">{totalAnimes}</span>
                <span className="metric-label">Jami Animelar</span>
              </div>
            </div>

            <div className="metric-box">
              <span className="metric-icon">📺</span>
              <div className="metric-info">
                <span className="metric-val">{totalEpisodes}</span>
                <span className="metric-label">Yuklangan Qismlar</span>
              </div>
            </div>

            <div className="metric-box">
              <span className="metric-icon">👥</span>
              <div className="metric-info">
                <span className="metric-val">{totalUsers}</span>
                <span className="metric-label">Foydalanuvchilar</span>
              </div>
            </div>

            <div className="metric-box">
              <span className="metric-icon">👑</span>
              <div className="metric-info">
                <span className="metric-val">{totalVipUsers}</span>
                <span className="metric-label">VIP Obunachilar</span>
              </div>
            </div>

            <div className="metric-box">
              <span className="metric-icon">👁️</span>
              <div className="metric-info">
                <span className="metric-val">{totalViews.toLocaleString()}</span>
                <span className="metric-label">Ko‘rishlar Soni</span>
              </div>
            </div>

            <div className="metric-box highlight">
              <span className="metric-icon">🟢</span>
              <div className="metric-info">
                <span className="metric-val">100% OK</span>
                <span className="metric-label">Server Holati</span>
              </div>
            </div>
          </div>

          {/* Quick Actions & Top Content */}
          <div className="admin-grid-layout" style={{ marginTop: 24 }}>
            <div className="card admin-pane">
              <h2 className="admin-pane-title">🔥 Eng Ko‘p Ko‘rilgan Animelar</h2>
              {animes.length > 0 ? (
                <div className="admin-items-list">
                  {animes
                    .slice()
                    .sort((a, b) => (Number(b.view_count) || 0) - (Number(a.view_count) || 0))
                    .slice(0, 5)
                    .map((a, idx) => (
                      <div key={a.id} className="li-admin">
                        <span className="rank-num">#{idx + 1}</span>
                        <div className="admin-thumb">
                          <img src={a.poster_url || '/placeholder.jpg'} alt="" />
                        </div>
                        <div className="admin-info">
                          <b>{a.title}</b>
                          <p>{a.episodes?.length || 0} qism • {a.view_count || 0} ko‘rilgan</p>
                        </div>
                        <Link href={`/admin/${a.id}/edit`} className="btn ghost sm">
                          Tahrirlash
                        </Link>
                      </div>
                    ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)' }}>
                  Hozircha hech qanday anime kiritilmagan.
                  <div style={{ marginTop: 12 }}>
                    <Link href="/admin?tab=animes" className="btn primary sm">
                      ➕ Anime qo‘shish
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <div className="card admin-pane">
              <h2 className="admin-pane-title">⚡ Tezkor Harakatlar</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
                <Link href="/admin?tab=animes" className="btn primary">
                  ➕ Yangi Anime va Qismlar Yuklash
                </Link>
                <Link href="/admin?tab=schedule" className="btn ghost">
                  📅 Haftalik Chiqish Jadvalini Sozlash
                </Link>
                <Link href="/admin?tab=banners" className="btn ghost">
                  🖼️ Bosh Sahifa Hero Bannerlarini Yangilash
                </Link>
                <Link href="/admin?tab=trailers" className="btn ghost">
                  🎞️ Treyler va Premyeralar Qo‘shish
                </Link>
                <Link href="/admin?tab=telegram" className="btn ghost">
                  📢 Telegram Kanalga E’lon Tayyorlash
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 2: ANIMES ================= */}
      {tab === 'animes' && (
        <div className="admin-grid-layout">
          <div className="card admin-pane">
            <h2 className="admin-pane-title">➕ Yangi Anime Yuklash</h2>
            <p className="hint">Google Drive ulashish havolalari yoki to‘g‘ridan-to‘g‘ri MP4 videolarni kiriting.</p>
            <AdminAnimeForm />
          </div>

          <div className="card admin-pane">
            <h2 className="admin-pane-title">📚 Yuklangan Animelar ({animes.length})</h2>
            {animes.length ? (
              <div className="admin-items-list">
                {animes.map((a) => (
                  <div className="li-admin" key={a.id}>
                    <div className="admin-thumb">
                      {a.poster_url ? (
                        <img src={a.poster_url} alt="" />
                      ) : (
                        <div className="thumb-fallback">{a.title.charAt(0)}</div>
                      )}
                    </div>
                    <div className="admin-info">
                      <b>{a.title}</b>
                      <p>
                        {a.year} • {a.status} • {a.episodes?.length || 0} ta qism • {a.release_day ? `📅 ${DAYS_MAP[a.release_day] || a.release_day}` : 'Jadvalsiz'}
                      </p>
                    </div>
                    <div className="admin-actions">
                      <Link href={`/anime/${a.id}`} className="btn ghost sm" target="_blank" title="Ko‘rish">
                        👁️
                      </Link>
                      <Link href={`/admin/${a.id}/edit`} className="btn ghost sm" title="Tahrirlash">
                        ✏️
                      </Link>
                      <form action={deleteAnime}>
                        <input type="hidden" name="id" value={a.id} />
                        <button
                          className="btn danger sm"
                          onClick={(e) => {
                            if (!confirm(`“${a.title}” animeni va uning barcha qismlarini o‘chirishni tasdiqlaysizmi?`)) {
                              e.preventDefault();
                            }
                          }}
                          title="O‘chirish"
                        >
                          🗑️
                        </button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)' }}>
                Bazada hech qanday anime yo‘q. Chapdagi forma orqali birinchi animeni yuklang.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= TAB 3: SCHEDULE ================= */}
      {tab === 'schedule' && (
        <div className="admin-schedule-view">
          <div className="card admin-pane" style={{ marginBottom: 20 }}>
            <h2 className="admin-pane-title">📅 Haftalik Chiqish Jadvali Boshqaruvi</h2>
            <p className="hint">
              Har bir anime tahrirlash sahifasida yoki yangi anime qo‘shishda <b>Haftalik Chiqish Kuni</b> (Dushanba-Yakshanba) etib belgilansa, u avtomatik ravishda bosh sahifadagi jadval taqvimida chiqadi.
            </p>
          </div>

          <div className="admin-schedule-days-grid">
            {Object.entries(DAYS_MAP).map(([key, name]) => {
              const dayAnimes = animes.filter((a) => a.release_day?.toLowerCase() === key);

              return (
                <div key={key} className="card admin-pane day-schedule-box">
                  <div className="day-schedule-header">
                    <h3 className="day-title">{name}</h3>
                    <span className="day-badge">{dayAnimes.length} ta anime</span>
                  </div>

                  {dayAnimes.length > 0 ? (
                    <div className="day-animes-list">
                      {dayAnimes.map((a) => (
                        <div key={a.id} className="day-anime-item">
                          <img src={a.poster_url || '/placeholder.jpg'} alt="" className="day-item-thumb" />
                          <div className="day-item-meta">
                            <b>{a.title}</b>
                            <span>{a.fandub_team || 'Anicity Dub'} • {a.episodes?.length || 0} qism</span>
                          </div>
                          <Link href={`/admin/${a.id}/edit`} className="btn ghost sm">
                            ✏️
                          </Link>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="day-empty-text">Bu kunga anime belgilanmagan</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ================= TAB 4: BANNERS ================= */}
      {tab === 'banners' && (
        <div className="admin-grid-layout">
          <div className="card admin-pane">
            <h2 className="admin-pane-title">➕ Yangi Hero Banner Qo‘shish</h2>
            <p className="hint">Bosh sahifaning eng yuqori qismidagi katta slayd uchun.</p>
            <AdminBannerForm animes={animes} />
          </div>

          <div className="card admin-pane">
            <h2 className="admin-pane-title">🖼️ Mavjud Bannerlar ({banners.length})</h2>
            {banners.length ? (
              <div className="admin-items-list">
                {banners.map((b) => (
                  <div className="li-admin" key={b.id}>
                    <div className="admin-thumb wide">
                      <img src={b.image_url} alt="" />
                    </div>
                    <div className="admin-info">
                      <b>{b.title}</b>
                      <p>
                        Tartib: #{b.sort_order} • Holat: {b.is_active ? 'Faol' : 'O‘chirilgan'} • {b.anime?.title || 'Umumiy'}
                      </p>
                    </div>
                    <div className="admin-actions">
                      <form action={toggleBannerActive}>
                        <input type="hidden" name="id" value={b.id} />
                        <input type="hidden" name="active" value={String(b.is_active)} />
                        <button className={`btn sm ${b.is_active ? 'ghost' : 'primary'}`}>
                          {b.is_active ? 'O‘chirish' : 'Yoqish'}
                        </button>
                      </form>
                      <form action={deleteBanner}>
                        <input type="hidden" name="id" value={b.id} />
                        <button className="btn danger sm" onClick={(e) => {
                          if (!confirm(`“${b.title}” bannerni o‘chirmoqchimisiz?`)) e.preventDefault();
                        }}>
                          🗑️
                        </button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)' }}>
                Hozircha faol bannerlar yo‘q.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= TAB 5: TRAILERS ================= */}
      {tab === 'trailers' && (
        <div className="admin-grid-layout">
          <div className="card admin-pane">
            <h2 className="admin-pane-title">➕ Yangi Treyler Qo‘shish</h2>
            <p className="hint">YouTube yoki Google Drive video havolasini kiriting.</p>
            <AdminTrailerForm animes={animes} />
          </div>

          <div className="card admin-pane">
            <h2 className="admin-pane-title">🎞️ Mavjud Treylerlar ({trailers.length})</h2>
            {trailers.length ? (
              <div className="admin-items-list">
                {trailers.map((t) => (
                  <div className="li-admin" key={t.id}>
                    <div className="admin-thumb wide">
                      <img src={t.thumbnail_url || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=300'} alt="" />
                    </div>
                    <div className="admin-info">
                      <b>{t.title}</b>
                      <p>
                        Turi: {t.clip_type} • Vaqti: {t.duration_text || '2:30'} • {t.is_active ? 'Faol' : 'Nofaol'}
                      </p>
                    </div>
                    <div className="admin-actions">
                      <form action={toggleTrailerActive}>
                        <input type="hidden" name="id" value={t.id} />
                        <input type="hidden" name="active" value={String(t.is_active)} />
                        <button className={`btn sm ${t.is_active ? 'ghost' : 'primary'}`}>
                          {t.is_active ? 'Nofaol qilish' : 'Faollashtirish'}
                        </button>
                      </form>
                      <form action={deleteTrailer}>
                        <input type="hidden" name="id" value={t.id} />
                        <button className="btn danger sm" onClick={(e) => {
                          if (!confirm(`“${t.title}” treylerni o‘chirasizmi?`)) e.preventDefault();
                        }}>
                          🗑️
                        </button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)' }}>
                Hozircha treylerlar yo‘q.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= TAB 6: USERS ================= */}
      {tab === 'users' && (
        <div className="admin-users-view">
          <div className="card admin-pane">
            <h2 className="admin-pane-title">👥 Foydalanuvchilar Ro‘yxati ({users.length})</h2>
            <div className="table-wrapper-pro" style={{ marginTop: 16 }}>
              <table className="pro-table">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Rol</th>
                    <th>Obuna Holati</th>
                    <th>Ro‘yxatdan o‘tgan</th>
                    <th>Harakatlar</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const isVipUser = u.subscription_plan === 'vip';
                    const isSuspended = Boolean(u.suspended_at);

                    return (
                      <tr key={u.id}>
                        <td>
                          <b>@{u.username}</b>
                          {u.display_name && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{u.display_name}</div>}
                        </td>
                        <td>
                          <span className={`badge-role ${u.role}`}>{u.role.toUpperCase()}</span>
                        </td>
                        <td>
                          {isVipUser ? (
                            <span className="badge-vip-pill">👑 VIP</span>
                          ) : (
                            <span className="badge-free-pill">Oddiy</span>
                          )}
                        </td>
                        <td>
                          {u.created_at ? new Date(u.created_at).toLocaleDateString('uz-UZ') : '—'}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <form action={toggleUserVip}>
                              <input type="hidden" name="userId" value={u.id} />
                              <input type="hidden" name="currentPlan" value={u.subscription_plan || 'free'} />
                              <button className={`btn sm ${isVipUser ? 'ghost' : 'primary'}`}>
                                {isVipUser ? 'VIPni bekor qilish' : '👑 VIP berish'}
                              </button>
                            </form>
                            <form action={toggleUserSuspension}>
                              <input type="hidden" name="userId" value={u.id} />
                              <input type="hidden" name="isSuspended" value={String(isSuspended)} />
                              <button className={`btn sm ${isSuspended ? 'primary' : 'danger'}`}>
                                {isSuspended ? 'Bandan olish' : 'Bloklash'}
                              </button>
                            </form>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 7: TELEGRAM ================= */}
      {tab === 'telegram' && (
        <div className="admin-telegram-view">
          <div className="card admin-pane" style={{ maxWidth: 800, margin: '0 auto' }}>
            <h2 className="admin-pane-title">📢 Telegram Integratsiyasi va Auto-Post</h2>
            <p className="hint">
              Yangi qism yuklanganda Telegram kanalingizga (masalan: <b>@anicity_uz</b>) avtomatik go‘zal post chiqarish shabloni:
            </p>

            <div className="telegram-post-preview">
              <div className="post-header">
                <span className="tg-icon">✈️</span>
                <b>Telegram Kanali E’lon Shabloni</b>
              </div>
              <div className="post-body">
                <pre>{`🔥 PREMYERA: [Anime Nomi] — [Qism raqami]-qism chiqdi!

🎭 Janr: Action, Fantaziya, Shounen
🎙 Ovoz: Anicity Dublyaj jamoasi
⚡ Sifat: 1080p Full HD

🎬 Hozir saytda tomosha qiling:
👉 https://anicity-app.vercel.app/anime/[ANIME_ID]

🍿 Barcha qismlar: https://anicity-app.vercel.app
💬 Do‘stlaringiz bilan ulashing!`}</pre>
              </div>
            </div>

            <div style={{ marginTop: 20 }}>
              <h3 style={{ fontSize: 16, marginBottom: 8 }}>Telegram Bot orqali Avto-post ulash:</h3>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                1. <b>@BotFather</b> orqali bot oching va token oling.<br />
                2. Botni kanalingizga <b>Administrator</b> qilib qo‘shing.<br />
                3. Har safar yangi qism chiqqanda yuqoridagi formatda to‘g‘ridan-to‘g‘ri post joylang yoki Webhook integratsiyasidan foydalaning.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
