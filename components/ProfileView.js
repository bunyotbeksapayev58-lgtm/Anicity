'use client';

import { useState } from 'react';
import Link from 'next/link';
import ProfileEditModal from './ProfileEditModal';
import AnimeCard from './AnimeCard';

function formatSeconds(sec) {
  if (!sec || isNaN(sec) || sec <= 0) return '00:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function ProfileView({
  user,
  profile,
  subscription,
  userSubs = [],
  historyList = [],
  favoritesList = [],
  daysLeft = null,
  joinDate = 'Yaqinda',
  expDateFormatted = null,
}) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('favorites');

  const isVip = subscription?.isVip;
  const displayName = profile?.display_name || profile?.username || user?.email?.split('@')[0] || 'Foydalanuvchi';
  const username = profile?.username || 'user';
  const avatarUrl = profile?.avatar_url || '';
  const email = user?.email || '';
  const bio = profile?.bio || '';

  // Stats calculation
  const totalWatchedHours = (
    historyList.reduce((acc, h) => acc + (Number(h.position_sec) || 0), 0) / 3600
  ).toFixed(1);

  // VIP progress calculation (for display)
  const vipProgressPct = isVip
    ? Math.min(100, Math.max(15, Math.round(((daysLeft || 30) / 365) * 100)))
    : 0;

  return (
    <div className="stitch-profile-container">
      {/* Subtle Ambient Glow Orbs */}
      <div className="stitch-ambient-orb stitch-ambient-orb-primary" />
      <div className="stitch-ambient-orb stitch-ambient-orb-cyan" />

      <div className="stitch-profile-content">
        {/* 1. Profile Header Hero Card */}
        <div className="stitch-hero-card">
          <div className="stitch-hero-glow" />
          <div className="stitch-hero-line" />

          <div className="stitch-hero-main">
            {/* Avatar & Core Metadata */}
            <div className="stitch-user-meta-group">
              <div className="stitch-avatar-wrapper">
                <div className={`stitch-avatar-hero-ring ${isVip ? 'has-vip-glow' : ''}`}>
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={displayName}
                      className="stitch-avatar-hero-img"
                    />
                  ) : (
                    <div className="stitch-avatar-hero-fallback">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <span className="stitch-avatar-status-dot" title="Faol online">
                  <span className="stitch-dot-inner" />
                </span>
              </div>

              <div className="stitch-user-info">
                <div className="stitch-name-row">
                  <h1 className="stitch-display-name">{displayName}</h1>
                  <span className="stitch-verified-chip">
                    <span className="material-symbols-outlined">verified</span>
                    <span>Tasdiqlangan</span>
                  </span>
                </div>

                <div className="stitch-meta-row">
                  <span className="stitch-handle">@{username}</span>
                  <span className="stitch-separator">•</span>
                  <span className="stitch-date-chip">
                    <span className="material-symbols-outlined">calendar_month</span>
                    <span>A’zo bo‘lgan: {joinDate}</span>
                  </span>
                </div>

                <div className="stitch-badges-row">
                  {isVip ? (
                    <span className="stitch-badge-vip">
                      <span className="material-symbols-outlined">military_tech</span>
                      <span>VIP Premium A’zo</span>
                    </span>
                  ) : (
                    <span className="stitch-badge-free">
                      <span className="material-symbols-outlined">person</span>
                      <span>Oddiy A’zo</span>
                    </span>
                  )}
                  <span className="stitch-badge-id">
                    ID: #{user?.id?.slice(0, 8)?.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>

            {/* VIP Expiration Tracker & Actions */}
            <div className="stitch-vip-card">
              <div className="stitch-vip-header">
                <span className="stitch-vip-title">
                  <span className="material-symbols-outlined">workspace_premium</span>
                  <span>VIP Obuna Holati</span>
                </span>
                <span className={`stitch-vip-days ${isVip ? 'is-active' : ''}`}>
                  {isVip ? `Yana ${daysLeft} kun` : 'Faol emas'}
                </span>
              </div>

              <div className="stitch-progress-track">
                <div
                  className="stitch-progress-fill"
                  style={{ width: `${vipProgressPct}%` }}
                />
              </div>

              <p className="stitch-vip-desc">
                {isVip ? (
                  <>
                    VIP obunangiz <span className="stitch-text-white">{expDateFormatted || 'faol'}</span>gacha faol.
                  </>
                ) : (
                  '1080p sifat va reklamasiz silliq tomosha uchun VIP oling.'
                )}
              </p>

              <div className="stitch-vip-actions">
                <Link
                  href="/premium"
                  className="stitch-btn-vip-action"
                >
                  <span className="material-symbols-outlined">bolt</span>
                  <span>{isVip ? 'Obunani uzaytirish' : 'VIP olish'}</span>
                </Link>

                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(true)}
                  className="stitch-btn-edit-action"
                  id="open-edit-modal-btn"
                >
                  <span className="material-symbols-outlined">settings</span>
                  <span>Profilni tahrirlash</span>
                </button>
              </div>
            </div>
          </div>

          {/* User Stats Counter Strip */}
          <div className="stitch-stats-strip">
            <div className="stitch-stat-item">
              <div className="stitch-stat-icon stitch-stat-icon-primary">
                <span className="material-symbols-outlined">movie</span>
              </div>
              <div>
                <div className="stitch-stat-number">{historyList.length}</div>
                <div className="stitch-stat-label">Ko‘rilgan Animelar</div>
              </div>
            </div>

            <div className="stitch-stat-item">
              <div className="stitch-stat-icon stitch-stat-icon-cyan">
                <span className="material-symbols-outlined">video_library</span>
              </div>
              <div>
                <div className="stitch-stat-number">{historyList.length}</div>
                <div className="stitch-stat-label">Epizodlar</div>
              </div>
            </div>

            <div className="stitch-stat-item">
              <div className="stitch-stat-icon stitch-stat-icon-secondary">
                <span className="material-symbols-outlined">schedule</span>
              </div>
              <div>
                <div className="stitch-stat-number">{totalWatchedHours}</div>
                <div className="stitch-stat-label">Soat tomosha</div>
              </div>
            </div>

            <div className="stitch-stat-item">
              <div className="stitch-stat-icon stitch-stat-icon-pink">
                <span className="material-symbols-outlined">favorite</span>
              </div>
              <div>
                <div className="stitch-stat-number">{favoritesList.length}</div>
                <div className="stitch-stat-label">Sevimlilar</div>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Content Tabs & Dynamic Layout */}
        <div className="stitch-tabs-container">
          {/* Tab Header Strip */}
          <div className="stitch-tab-strip">
            <div className="stitch-tab-buttons">
              <button
                type="button"
                onClick={() => setActiveTab('favorites')}
                className={`stitch-tab-btn ${activeTab === 'favorites' ? 'is-active' : ''}`}
              >
                <span className="material-symbols-outlined">favorite</span>
                <span>Mening Sevimlilarim ({favoritesList.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`stitch-tab-btn ${activeTab === 'history' ? 'is-active' : ''}`}
              >
                <span className="material-symbols-outlined">history</span>
                <span>Ko‘rishlar Tarixi ({historyList.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('subscriptions')}
                className={`stitch-tab-btn ${activeTab === 'subscriptions' ? 'is-active' : ''}`}
              >
                <span className="material-symbols-outlined">receipt_long</span>
                <span>Obunalar Tarixi ({userSubs.length})</span>
              </button>
            </div>
          </div>

          {/* Tab Content: Mening Sevimlilarim */}
          {activeTab === 'favorites' && (
            <div className="stitch-tab-content">
              <div className="stitch-content-header">
                <h2 className="stitch-content-title">
                  <span className="stitch-pulse-dot" />
                  <span>Sevimlilar Kolleksiyasi</span>
                </h2>
                <span className="stitch-content-count">
                  Jami: {favoritesList.length} ta anime
                </span>
              </div>

              {favoritesList.length > 0 ? (
                <div className="stitch-anime-grid">
                  {favoritesList.map((anime) => (
                    <AnimeCard key={anime.id} anime={anime} />
                  ))}
                </div>
              ) : (
                <div className="stitch-empty-state">
                  <span className="material-symbols-outlined stitch-empty-icon">bookmark_border</span>
                  <h3 className="stitch-empty-title">Siz hali hech qanday anime saqlamadingiz</h3>
                  <p className="stitch-empty-desc">
                    Sevimli serial va filmlaringizni saqlab, keyinroq tezkor topishingiz mumkin.
                  </p>
                  <Link href="/catalog" className="stitch-btn-cta">
                    Katalogni ko‘rish
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Tab Content: Ko‘rishlar Tarixi */}
          {activeTab === 'history' && (
            <div className="stitch-tab-content">
              <div className="stitch-content-header">
                <h2 className="stitch-content-title">
                  <span className="material-symbols-outlined stitch-text-primary">history_toggle_off</span>
                  <span>Ko‘rishlar Tarixi (So‘nggi faollik)</span>
                </h2>
                <span className="stitch-content-count">
                  Jami: {historyList.length} ta epizod
                </span>
              </div>

              {historyList.length > 0 ? (
                <div className="stitch-history-grid">
                  {historyList.map((item) => {
                    const anime = item.episodes?.animes;
                    const ep = item.episodes;
                    if (!anime || !ep) return null;

                    const pct = item.duration_sec > 0
                      ? Math.min(100, Math.round((item.position_sec / item.duration_sec) * 100))
                      : 0;
                    const posFormatted = formatSeconds(item.position_sec);
                    const durFormatted = formatSeconds(item.duration_sec);

                    return (
                      <Link
                        key={`${anime.id}-${ep.number}`}
                        href={`/watch/${anime.id}/${ep.number}`}
                        className="stitch-history-card"
                      >
                        <div className="stitch-history-thumb">
                          <img
                            src={anime.poster_url || '/placeholder.jpg'}
                            alt={anime.title}
                            className="stitch-history-img"
                          />
                          <div className="stitch-history-play-overlay">
                            <div className="stitch-history-play-btn">
                              <span className="material-symbols-outlined">play_arrow</span>
                            </div>
                          </div>
                          <div className="stitch-history-progress-line">
                            <div
                              className="stitch-history-progress-fill"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>

                        <div className="stitch-history-info">
                          <h4 className="stitch-history-title">{anime.title}</h4>
                          <p className="stitch-history-sub">
                            {ep.number}-qism • {posFormatted} / {durFormatted} ({pct}%)
                          </p>
                          <span className="stitch-history-time">
                            {item.updated_at
                              ? new Date(item.updated_at).toLocaleDateString('uz-UZ', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : 'Yaqinda'}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="stitch-empty-state">
                  <span className="material-symbols-outlined stitch-empty-icon">smart_display</span>
                  <h3 className="stitch-empty-title">Hozircha ko‘rish tarixi mavjud emas</h3>
                  <p className="stitch-empty-desc">
                    Tomosha qilgan animelaringiz shu yerda saqlanadi va to‘xtagan joyingizdan davom ettirishingiz mumkin.
                  </p>
                  <Link href="/catalog" className="stitch-btn-cta">
                    Anime tanlash
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Tab Content: Obunalar Tarixi */}
          {activeTab === 'subscriptions' && (
            <div className="stitch-tab-content">
              <div className="stitch-content-header">
                <h2 className="stitch-content-title">
                  <span className="material-symbols-outlined stitch-text-gold">workspace_premium</span>
                  <span>Obunalar Tarixi va To‘lovlar</span>
                </h2>
                <span className="stitch-content-count">
                  Jami: {userSubs.length} ta yozuv
                </span>
              </div>

              {userSubs.length > 0 ? (
                <div className="stitch-table-wrapper">
                  <table className="stitch-table">
                    <thead>
                      <tr>
                        <th>Tarif rejasi</th>
                        <th>Boshlangan sana</th>
                        <th>Tugash sanasi</th>
                        <th>Berilish turi</th>
                        <th>Holati</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userSubs.map((sub) => {
                        const now = new Date();
                        const startsAt = new Date(sub.starts_at);
                        const expiresAt = new Date(sub.expires_at);
                        const active = sub.status === 'active' && startsAt <= now && expiresAt > now;
                        const scheduled = sub.status === 'active' && startsAt > now;

                        return (
                          <tr key={sub.id}>
                            <td>
                              <span className="stitch-table-plan">
                                <span className="material-symbols-outlined">workspace_premium</span>
                                <b>{sub.plan_name}</b>
                              </span>
                            </td>
                            <td>{startsAt.toLocaleDateString('uz-UZ')}</td>
                            <td>{expiresAt.toLocaleDateString('uz-UZ')}</td>
                            <td>
                              <span className="stitch-table-type">
                                {sub.grant_type === 'admin_grant' ? '🎁 Admin sovg‘asi' : '💳 To‘lov'}
                              </span>
                            </td>
                            <td>
                              <span
                                className={`stitch-status-badge ${
                                  active
                                    ? 'status-active'
                                    : scheduled
                                    ? 'status-scheduled'
                                    : expiresAt <= now
                                    ? 'status-expired'
                                    : 'status-cancelled'
                                }`}
                              >
                                {active
                                  ? '● Faol'
                                  : scheduled
                                  ? '◷ Rejalashtirilgan'
                                  : expiresAt <= now
                                  ? '⌛ Yakunlangan'
                                  : '✕ Bekor qilingan'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="stitch-empty-state">
                  <span className="material-symbols-outlined stitch-empty-icon">receipt_long</span>
                  <h3 className="stitch-empty-title">Hozircha obunalar tarixi mavjud emas</h3>
                  <p className="stitch-empty-desc">
                    AniCity VIP a’zoligini xarid qilsangiz, barcha to‘lovlar va tarif tafsilotlari shu yerda aks etadi.
                  </p>
                  <Link href="/premium" className="stitch-btn-cta">
                    VIP tariflarini ko‘rish
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 3. Stitch Edit Profile Modal */}
      <ProfileEditModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        displayName={displayName}
        avatarUrl={avatarUrl}
        username={username}
        email={email}
        bio={bio}
      />
    </div>
  );
}
