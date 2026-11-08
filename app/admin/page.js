import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import AdminAnimeSection from '@/components/AdminAnimeSection';
import AdminBannerForm from '@/components/AdminBannerForm';
import AdminTrailerForm from '@/components/AdminTrailerForm';
import AdminSubscriptionPlans from '@/components/AdminSubscriptionPlans';
import AdminUserSubscriptions from '@/components/AdminUserSubscriptions';
import {
  deleteBanner,
  toggleBannerActive,
  deleteTrailer,
  toggleTrailerActive,
  toggleUserVip,
  toggleUserSuspension,
  updateUserRole,
} from '@/app/actions/admin';
import { isAdminRole } from '@/lib/roles';
import { getAdminUserPageCount, normalizeAdminUserQuery } from '@/lib/admin-pagination';
import AssistantAdminManager from '@/components/AssistantAdminManager';

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
  const resolvedSearchParams = (await searchParams) || {};
  const tab = resolvedSearchParams.tab || 'dashboard';
  const targetAnimeId = resolvedSearchParams.animeId || null;
  const userQuery = normalizeAdminUserQuery(resolvedSearchParams);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/admin');

  const { data: profile } = await supabase.from('profiles').select('role, username').eq('id', user.id).single();
  if (!isAdminRole(profile?.role)) redirect('/');

  const currentUsername = profile?.username || user?.email?.split('@')[0] || 'Admin';
  const currentRole = (profile?.role || 'admin').toUpperCase();
  let assistantData = { assistants: [], audit_logs: [] };
  if (profile?.role === 'owner' && tab === 'assistants') {
    const { data, error } = await supabase.rpc('main_admin_list_assistant_admins');
    if (error) throw new Error('Assistantlar ro‘yxati yuklanmadi: ' + error.message);
    assistantData = data || assistantData;
  }

  // 1. Fetch Animes with episodes
  const { data: animesRaw } = await supabase
    .from('animes')
    .select('id, title, alt_title, year, poster_url, banner_url, status, view_count, rating_avg, release_day, fandub_team, age_rating, is_featured, is_published, episodes(id, season_number, number, title, video_url, thumbnail_url, is_published, description, quality)')
    .order('created_at', { ascending: false });
  const animes = animesRaw || [];

  // 2. Fetch Banners
  const { data: bannersRaw } = await supabase
    .from('banners')
    .select('id, title, subtitle, image_url, video_url, link_url, sort_order, is_active, anime_id, anime:animes(title)')
    .order('sort_order', { ascending: true });
  const banners = bannersRaw || [];

  // 3. Fetch Trailers
  const { data: trailersRaw } = await supabase
    .from('trailers')
    .select('id, title, description, video_url, thumbnail_url, duration_text, clip_type, sort_order, is_active, anime_id, anime:animes(title)')
    .order('sort_order', { ascending: true });
  const trailers = trailersRaw || [];

  // 4. Fetch Users (Profiles)
  const { data: usersRaw, error: usersError } = await supabase.rpc('admin_list_users', {
    p_page: userQuery.page,
    p_page_size: userQuery.pageSize,
    p_search: userQuery.search || null,
    p_status: userQuery.status,
  });
  if (usersError) throw new Error('Foydalanuvchilarni yuklashda xatolik: ' + usersError.message);
  const users = usersRaw || [];
  const totalUserCount = Number(users[0]?.total_count || 0);
  const totalUserPages = getAdminUserPageCount(totalUserCount, userQuery.pageSize);

  // 5. Fetch Subscription Plans
  const { data: plansRaw, error: plansError } = await supabase
    .from('subscription_plans')
    .select('*')
    .order('sort_order', { ascending: true });
  if (plansError) throw new Error('Tariflarni yuklashda xatolik: ' + plansError.message);
  const plans = plansRaw || [];

  // 6. Fetch User Subscriptions
  const { data: subscriptionsRaw, error: subscriptionsError } = await supabase
    .from('user_subscriptions')
    .select('id, user_id, plan_id, plan_name, status, starts_at, expires_at, grant_type, notes, created_at, user:profiles!user_subscriptions_user_id_fkey(username, display_name)')
    .order('created_at', { ascending: false })
    .limit(100);
  if (subscriptionsError) throw new Error('Obunalarni yuklashda xatolik: ' + subscriptionsError.message);
  const subscriptions = subscriptionsRaw || [];

  // 7. Fetch Subscription Audit Logs
  const { data: auditLogsRaw, error: auditLogsError } = await supabase
    .from('subscription_audit_logs')
    .select('id, admin_id, user_id, action, previous_plan, previous_expires_at, new_plan, new_expires_at, reason, created_at, admin:profiles!subscription_audit_logs_admin_id_fkey(username), user:profiles!subscription_audit_logs_user_id_fkey(username)')
    .order('created_at', { ascending: false })
    .limit(100);
  if (auditLogsError) throw new Error('Obuna audit jurnalini yuklashda xatolik: ' + auditLogsError.message);
  const auditLogs = auditLogsRaw || [];

  // Stats calculation
  const totalAnimes = animes.length;
  const totalEpisodes = animes.reduce((acc, a) => acc + (Array.isArray(a.episodes) ? a.episodes.length : 0), 0);
  const totalViews = animes.reduce((acc, a) => acc + (Number(a.view_count) || 0), 0);
  const totalUsers = totalUserCount;
  const now = new Date();
  const totalVipUsers = users.filter(
    (u) => u?.subscription_plan === 'vip' && u.subscription_expires_at && new Date(u.subscription_expires_at) > now
  ).length;

  return (
    <div className="admin-page-container">
      {/* Top Header */}
      <div className="admin-header-row">
        <div>
          <h1 className="admin-main-title">
            ⚡ Anicity <span className="grad">Admin Panel</span>
          </h1>
          <p className="admin-subtitle">
            Anibla darajasidagi to‘liq streaming boshqaruv tizimi • Kirgan admin: <b>{currentUsername}</b> ({currentRole})
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/profile?edit=credentials" className="btn ghost sm" title="O‘z login va parolingizni yangilang">
            🔐 Parol va Login
          </Link>
          <Link href="/" className="btn ghost sm">
            ← Saytni ochish
          </Link>
          <Link href="/catalog" className="btn ghost sm">
            🎬 Katalog
          </Link>
          <Link href="/premium" className="btn primary sm" target="_blank">
            👑 VIP Tariflar
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
        <Link href="/admin?tab=episodes" className={`admin-tab-btn ${tab === 'episodes' ? 'active' : ''}`}>
          📺 Qismlar ({totalEpisodes})
        </Link>
        <Link href="/admin?tab=subscriptions" className={`admin-tab-btn ${tab === 'subscriptions' ? 'active' : ''}`}>
          👑 Obunalarni Boshqarish ({totalVipUsers})
        </Link>
        <Link href="/admin?tab=plans" className={`admin-tab-btn ${tab === 'plans' ? 'active' : ''}`}>
          📋 Obuna Tariflari ({plans.length})
        </Link>
        <Link href="/admin?tab=schedule" className={`admin-tab-btn ${tab === 'schedule' ? 'active' : ''}`}>
          📅 Jadval
        </Link>
        <Link href="/admin?tab=banners" className={`admin-tab-btn ${tab === 'banners' ? 'active' : ''}`}>
          🖼️ Banners ({banners.length})
        </Link>
        <Link href="/admin?tab=trailers" className={`admin-tab-btn ${tab === 'trailers' ? 'active' : ''}`}>
          🎞️ Treylerlar ({trailers.length})
        </Link>
        <Link href="/admin?tab=users" className={`admin-tab-btn ${tab === 'users' ? 'active' : ''}`}>
          👥 Foydalanuvchilar ({totalUsers})
        </Link>
        {profile?.role === 'owner' && (
          <Link href="/admin?tab=assistants" className={`admin-tab-btn ${tab === 'assistants' ? 'active' : ''}`}>
            🛡️ Assistant ruxsatlari
          </Link>
        )}
        <Link href="/admin?tab=telegram" className={`admin-tab-btn ${tab === 'telegram' ? 'active' : ''}`}>
          📢 Telegram
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

            <div className="metric-box highlight">
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

            <div className="metric-box">
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
                          <p>{Array.isArray(a.episodes) ? a.episodes.length : 0} qism • {a.view_count || 0} ko‘rilgan</p>
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
                  ➕ Yangi Anime Yuklash (1-bosqich)
                </Link>
                <Link href="/admin?tab=episodes" className="btn ghost">
                  📺 Qismlar Boshqaruvi (2-bosqich)
                </Link>
                <Link href="/admin?tab=subscriptions" className="btn ghost">
                  👑 Obunalarni Boshqarish va VIP Berish
                </Link>
                <Link href="/admin?tab=plans" className="btn ghost">
                  📋 Obuna Tariflarini Sozlash
                </Link>
                <Link href="/admin?tab=schedule" className="btn ghost">
                  📅 Haftalik Chiqish Jadvalini Sozlash
                </Link>
                <Link href="/admin?tab=banners" className="btn ghost">
                  🖼️ Bosh Sahifa Hero Bannerlarini Yangilash
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 2: ANIMES ================= */}
      {tab === 'animes' && (
        <AdminAnimeSection animes={animes} initialSubTab="form" initialAnimeId={targetAnimeId} />
      )}

      {/* ================= TAB 3: EPISODES ================= */}
      {tab === 'episodes' && (
        <AdminAnimeSection animes={animes} initialSubTab="episodes" initialAnimeId={targetAnimeId} />
      )}

      {/* ================= TAB 4: SUBSCRIPTION MANAGEMENT ================= */}
      {tab === 'subscriptions' && (
        <AdminUserSubscriptions
          users={users}
          totalCount={totalUserCount}
          page={Math.min(userQuery.page, totalUserPages)}
          pageSize={userQuery.pageSize}
          search={userQuery.search}
          status={userQuery.status}
          plans={plans}
          subscriptions={subscriptions}
          auditLogs={auditLogs}
        />
      )}

      {/* ================= TAB 5: SUBSCRIPTION PLANS ================= */}
      {tab === 'plans' && (
        <AdminSubscriptionPlans plans={plans} />
      )}

      {/* ================= TAB 6: SCHEDULE ================= */}
      {tab === 'schedule' && (
        <div className="admin-schedule-view">
          <div className="card admin-pane" style={{ marginBottom: 20 }}>
            <h2 className="admin-pane-title">📅 Haftalik Chiqish Jadvali Boshqaruvi</h2>
            <p className="hint">
              Har bir anime ma’lumotlarida <b>Haftalik Chiqish Kuni</b> (Dushanba-Yakshanba) etib belgilansa, u avtomatik ravishda bosh sahifadagi jadval taqvimida chiqadi.
            </p>
          </div>

          <div className="admin-schedule-days-grid">
            {Object.entries(DAYS_MAP).map(([key, name]) => {
              const dayAnimes = animes.filter((a) => a.release_day && a.release_day.toLowerCase() === key);

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
                            <span>{a.fandub_team || 'Anicity Dub'} • {Array.isArray(a.episodes) ? a.episodes.length : 0} qism</span>
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

      {/* ================= TAB 7: BANNERS ================= */}
      {tab === 'banners' && (
        <div className="admin-grid-layout">
          <div className="card admin-pane">
            <h2 className="admin-pane-title">➕ Yangi Hero Banner Qo‘shish</h2>
            <p className="hint">Bosh sahifaning eng yuqori qismidagi katta slayd uchun kompyuterdan rasm yuklang.</p>
            <AdminBannerForm animes={animes} />
          </div>

          <div className="card admin-pane">
            <h2 className="admin-pane-title">🖼️ Mavjud Bannerlar ({banners.length})</h2>
            {banners.length ? (
              <div className="admin-items-list">
                {banners.map((b) => (
                  <div className="li-admin" key={b.id}>
                    <div className="admin-thumb wide">
                      {b.image_url ? (
                        <img src={b.image_url} alt="" />
                      ) : (
                        <div style={{ width: '100%', height: '100%', background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
                          🎥
                        </div>
                      )}
                    </div>
                    <div className="admin-info">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <b>{b.title}</b>
                        {b.video_url && (
                          <span style={{ fontSize: 11, background: 'rgba(0,206,201,0.15)', color: '#00CEC9', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>
                            🎥 Video Banner
                          </span>
                        )}
                      </div>
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

      {/* ================= TAB 8: TRAILERS ================= */}
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

      {/* ================= TAB 9: USERS ================= */}
      {tab === 'users' && (
        <div className="admin-users-view">
          <div className="card admin-pane">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
              <h2 className="admin-pane-title" style={{ margin: 0 }}>👥 Foydalanuvchilar Ro‘yxati ({totalUserCount})</h2>
              <Link href="/admin?tab=subscriptions" className="btn primary sm">
                👑 Obunalarni Boshqarishga O‘tish →
              </Link>
            </div>
            <form action="/admin" method="get" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              <input type="hidden" name="tab" value="users" />
              <input type="hidden" name="usersPage" value="1" />
              <input type="hidden" name="usersPageSize" value={userQuery.pageSize} />
              <input type="hidden" name="usersStatus" value={userQuery.status} />
              <input className="search-input-pro" name="usersSearch" maxLength={100} defaultValue={userQuery.search} placeholder="Username, ism yoki ID bo‘yicha qidirish" />
              <button className="btn primary sm" type="submit">Qidirish</button>
            </form>
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
                    const isVipUser = u.subscription_plan === 'vip' &&
                      u.subscription_expires_at && new Date(u.subscription_expires_at) > new Date();
                    const isSuspended = Boolean(u.suspended_at);
                    const safeDate = u.created_at ? String(u.created_at).slice(0, 10) : '—';

                    return (
                      <tr key={u.id}>
                        <td>
                          <b>@{u.username || 'noma’lum'}</b>
                          {u.display_name && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{u.display_name}</div>}
                        </td>
                        <td>
                          <form action={updateUserRole} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <input type="hidden" name="userId" value={u.id} />
                            <select
                              name="role"
                              defaultValue={u.role || 'user'}
                              style={{
                                padding: '4px 8px',
                                fontSize: '12px',
                                fontWeight: 600,
                                borderRadius: '6px',
                                background: '#131722',
                                color: u.role === 'owner' ? '#f59e0b' : u.role === 'admin' ? '#38bdf8' : u.role === 'moderator' ? '#34d399' : '#94a3b8',
                                border: '1px solid rgba(255,255,255,0.15)',
                                cursor: 'pointer',
                              }}
                            >
                              <option value="user">USER</option>
                              <option value="moderator">MODERATOR</option>
                              <option value="admin">ADMIN</option>
                              {profile?.role === 'owner' && <option value="owner">OWNER</option>}
                            </select>
                            <button
                              type="submit"
                              className="btn ghost sm"
                              style={{ padding: '3px 8px', fontSize: '11px', lineHeight: 1 }}
                              title="Foydalanuvchi rolini saqlash"
                            >
                              Saqlash
                            </button>
                          </form>
                        </td>
                        <td>
                          {isVipUser ? (
                            <span className="badge-vip-pill">👑 VIP</span>
                          ) : (
                            <span className="badge-free-pill">Oddiy</span>
                          )}
                        </td>
                        <td>{safeDate}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
            <div className="admin-user-pagination" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
              <span>{totalUserCount} foydalanuvchi · {Math.min(userQuery.page, totalUserPages)}/{totalUserPages}-sahifa</span>
              <div style={{ display: 'flex', gap: 8 }}>
                {Math.min(userQuery.page, totalUserPages) > 1 && (
                  <Link className="btn ghost sm" href={`/admin?tab=users&usersPage=${Math.min(userQuery.page, totalUserPages) - 1}&usersPageSize=${userQuery.pageSize}&usersSearch=${encodeURIComponent(userQuery.search)}&usersStatus=${userQuery.status}`}>Oldingi</Link>
                )}
                {Math.min(userQuery.page, totalUserPages) < totalUserPages && (
                  <Link className="btn ghost sm" href={`/admin?tab=users&usersPage=${Math.min(userQuery.page, totalUserPages) + 1}&usersPageSize=${userQuery.pageSize}&usersSearch=${encodeURIComponent(userQuery.search)}&usersStatus=${userQuery.status}`}>Keyingi</Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'assistants' && profile?.role === 'owner' && (
        <AssistantAdminManager
          initialAssistants={assistantData.assistants || []}
          auditLogs={assistantData.audit_logs || []}
        />
      )}

      {/* ================= TAB 10: TELEGRAM ================= */}
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
