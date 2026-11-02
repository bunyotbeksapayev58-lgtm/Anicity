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
} from '@/app/actions/admin';
import { isAdminRole } from '@/lib/roles';

export const metadata = { title: 'Admin Panel — Anicity' };

export default async function AdminPage({ searchParams }) {
  const { tab = 'animes' } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/admin');

  const { data: profile } = await supabase.from('profiles').select('role, username').eq('id', user.id).single();
  if (!isAdminRole(profile?.role)) redirect('/');

  // 1. Fetch Animes
  const { data: animes } = await supabase
    .from('animes')
    .select('id, title, year, poster_url, status, episodes(count)')
    .order('created_at', { ascending: false });

  // 2. Fetch Banners
  const { data: banners } = await supabase
    .from('banners')
    .select('id, title, subtitle, image_url, link_url, sort_order, is_active, anime_id, anime:animes(title)')
    .order('sort_order', { ascending: true });

  // 3. Fetch Trailers
  const { data: trailers } = await supabase
    .from('trailers')
    .select('id, title, description, video_url, thumbnail_url, duration_text, clip_type, sort_order, is_active, anime_id, anime:animes(title)')
    .order('sort_order', { ascending: true });

  return (
    <div className="admin-page-container">
      <div className="admin-header-row">
        <div>
          <h1 className="admin-main-title">
            ⚡ Anicity <span className="grad">Admin Panel</span>
          </h1>
          <p className="admin-subtitle">
            Anime katalogi, Cinematic Banners va Treylerlarni boshqarish markazi ({profile.role.toUpperCase()}: {profile.username})
          </p>
        </div>
        <Link href="/" className="btn ghost sm">
          ← Saytga qaytish
        </Link>
      </div>

      {/* Admin Tabs */}
      <div className="admin-tabs-bar">
        <Link
          href="/admin?tab=animes"
          className={`admin-tab-btn ${tab === 'animes' ? 'active' : ''}`}
        >
          🎬 Animelar va Qismlar ({animes?.length ?? 0})
        </Link>
        <Link
          href="/admin?tab=banners"
          className={`admin-tab-btn ${tab === 'banners' ? 'active' : ''}`}
        >
          🖼️ Hero Banners ({banners?.length ?? 0})
        </Link>
        <Link
          href="/admin?tab=trailers"
          className={`admin-tab-btn ${tab === 'trailers' ? 'active' : ''}`}
        >
          🎞️ Treylerlar va Lavhalar ({trailers?.length ?? 0})
        </Link>
      </div>

      {/* TAB 1: ANIMES */}
      {tab === 'animes' && (
        <div className="admin-grid-layout">
          <div className="card admin-pane">
            <h2 className="admin-pane-title">➕ Yangi Anime Yuklash</h2>
            <p className="hint">Google Drive video havolalari yoki to‘g‘ridan-to‘g‘ri MP4 videolarni kiriting.</p>
            <AdminAnimeForm />
          </div>

          <div className="card admin-pane">
            <h2 className="admin-pane-title">📚 Yuklangan Animelar ({animes?.length ?? 0})</h2>
            {animes?.length ? (
              <div className="admin-items-list">
                {animes.map((a) => (
                  <div className="li-admin" key={a.id}>
                    <div className="admin-thumb">
                      {a.poster_url ? (
                        <img src={a.poster_url} alt="" />
                      ) : (
                        <span>{a.title.charAt(0)}</span>
                      )}
                    </div>
                    <div className="admin-item-text">
                      <b>{a.title}</b>
                      <small>
                        {a.year} • {a.episodes?.[0]?.count ?? 0} ta qism • {a.status}
                      </small>
                    </div>
                    <div className="admin-item-actions">
                      <Link className="btn ghost sm" href={`/anime/${a.id}`}>
                        Ko‘rish
                      </Link>
                      <Link className="btn ghost sm" href={`/admin/${a.id}/edit`}>
                        Tahrirlash
                      </Link>
                      <form action={deleteAnime}>
                        <input type="hidden" name="id" value={a.id} />
                        <button className="btn danger">O‘chirish</button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">Hali hech qanday anime yuklanmagan.</p>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: HERO BANNERS */}
      {tab === 'banners' && (
        <div className="admin-grid-layout">
          <div className="card admin-pane">
            <h2 className="admin-pane-title">🖼️ Yangi Hero Banner Qo‘shish</h2>
            <p className="hint">Bosh sahifa tepasida aylanadigan katta cinematic bannerlar.</p>
            <AdminBannerForm animes={animes || []} />
          </div>

          <div className="card admin-pane">
            <h2 className="admin-pane-title">📋 Mavjud Bannerlar ({banners?.length ?? 0})</h2>
            {banners?.length ? (
              <div className="admin-items-list">
                {banners.map((b) => (
                  <div className="li-admin" key={b.id}>
                    <div className="admin-thumb banner">
                      {b.image_url && <img src={b.image_url} alt="" />}
                    </div>
                    <div className="admin-item-text">
                      <b>{b.title}</b>
                      <small>
                        Tartib: #{b.sort_order} • {b.anime?.title ? `Anime: ${b.anime.title}` : 'Mustaqil havola'}
                      </small>
                    </div>
                    <div className="admin-item-actions">
                      <form action={toggleBannerActive}>
                        <input type="hidden" name="id" value={b.id} />
                        <input type="hidden" name="active" value={String(b.is_active)} />
                        <button className={`btn sm ${b.is_active ? 'ghost' : 'danger'}`}>
                          {b.is_active ? '🟢 Faol' : '🔴 O‘chiq'}
                        </button>
                      </form>
                      <form action={deleteBanner}>
                        <input type="hidden" name="id" value={b.id} />
                        <button className="btn danger">O‘chirish</button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">Hozircha bannerlar yo‘q. Yangi banner qo‘shing!</p>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: TRAILERS & CLIPS */}
      {tab === 'trailers' && (
        <div className="admin-grid-layout">
          <div className="card admin-pane">
            <h2 className="admin-pane-title">🎞️ Yangi Treyler yoki Lavha Qo‘shish</h2>
            <p className="hint">YouTube rasmiy treyleri yoki video lavhasini joylang.</p>
            <AdminTrailerForm animes={animes || []} />
          </div>

          <div className="card admin-pane">
            <h2 className="admin-pane-title">🎬 Mavjud Treylerlar ({trailers?.length ?? 0})</h2>
            {trailers?.length ? (
              <div className="admin-items-list">
                {trailers.map((t) => (
                  <div className="li-admin" key={t.id}>
                    <div className="admin-thumb trailer">
                      {t.thumbnail_url && <img src={t.thumbnail_url} alt="" />}
                    </div>
                    <div className="admin-item-text">
                      <b>{t.title}</b>
                      <small>
                        {t.clip_type?.toUpperCase()} • {t.duration_text} • {t.anime?.title ? t.anime.title : 'Umumiy'}
                      </small>
                    </div>
                    <div className="admin-item-actions">
                      <form action={toggleTrailerActive}>
                        <input type="hidden" name="id" value={t.id} />
                        <input type="hidden" name="active" value={String(t.is_active)} />
                        <button className={`btn sm ${t.is_active ? 'ghost' : 'danger'}`}>
                          {t.is_active ? '🟢 Faol' : '🔴 O‘chiq'}
                        </button>
                      </form>
                      <form action={deleteTrailer}>
                        <input type="hidden" name="id" value={t.id} />
                        <button className="btn danger">O‘chirish</button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">Hozircha treylerlar yo‘q. Yangi treyler qo‘shing!</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
