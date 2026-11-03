'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  grantUserSubscription,
  extendUserSubscription,
  revokeUserSubscription,
} from '@/app/actions/admin';

export default function AdminUserSubscriptions({
  users = [],
  totalCount = 0,
  page = 1,
  pageSize = 50,
  search = '',
  status = 'all',
  plans = [],
  subscriptions = [],
  auditLogs = [],
}) {
  const [isPending, startTransition] = useTransition();
  const [searchQuery] = useState(search);
  const [filterStatus] = useState(status); // 'all' | 'vip' | 'free' | 'expired'
  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'subscriptions' | 'audit'

  // Modal / Action states
  const [selectedUser, setSelectedUser] = useState(null);
  const [actionType, setActionType] = useState(null); // 'grant' | 'extend' | 'revoke'
  const [confirmStep, setConfirmStep] = useState(false);

  // Form values
  const [selectedPlanId, setSelectedPlanId] = useState(plans[1]?.id || plans[0]?.id || '');
  const [customDays, setCustomDays] = useState(30);
  const [actionNotes, setActionNotes] = useState('');

  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  // Search filter
  const filteredUsers = users;
  const totalUserPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const pageHref = (nextPage) => `/admin?tab=subscriptions&usersPage=${nextPage}&usersPageSize=${pageSize}&usersSearch=${encodeURIComponent(search)}&usersStatus=${status}`;
  const filteredPageCount = totalCount;

  // Calculate statistics
  const now = new Date();
  const totalUsers = totalCount;
  const activeVipCount = users.filter(
    (u) => u.subscription_plan === 'vip' && (!u.subscription_expires_at || new Date(u.subscription_expires_at) > now)
  ).length;
  const expiredCount = users.filter(
    (u) => u.subscription_plan === 'vip' && u.subscription_expires_at && new Date(u.subscription_expires_at) <= now
  ).length;

  const handleOpenGrant = (user) => {
    setSelectedUser(user);
    setActionType('grant');
    setConfirmStep(false);
    setActionNotes('Admin tomonidan taqdim etildi');
    setError(null);
    setMessage(null);
  };

  const handleOpenExtend = (user) => {
    setSelectedUser(user);
    setActionType('extend');
    setCustomDays(30);
    setConfirmStep(false);
    setActionNotes('Obuna muddatini uzaytirish');
    setError(null);
    setMessage(null);
  };

  const handleOpenRevoke = (user) => {
    setSelectedUser(user);
    setActionType('revoke');
    setConfirmStep(false);
    setActionNotes('Obunani bekor qilish');
    setError(null);
    setMessage(null);
  };

  const handleCloseModal = () => {
    setSelectedUser(null);
    setActionType(null);
    setConfirmStep(false);
  };

  const handleExecuteAction = () => {
    if (!selectedUser || !actionType) return;
    setError(null);
    setMessage(null);

    const formData = new FormData();
    formData.set('user_id', selectedUser.id);
    formData.set('reason', actionNotes);

    if (actionType === 'grant') {
      formData.set('plan_id', selectedPlanId);
      formData.set('duration_days', String(customDays));
      formData.set('notes', actionNotes);

      startTransition(async () => {
        try {
          const res = await grantUserSubscription(null, formData);
          if (res?.error) setError(res.error);
          else if (res?.success) {
            setMessage(res.message);
            handleCloseModal();
          }
        } catch (err) {
          setError(err.message);
        }
      });
    } else if (actionType === 'extend') {
      formData.set('extend_days', String(customDays));

      startTransition(async () => {
        try {
          const res = await extendUserSubscription(null, formData);
          if (res?.error) setError(res.error);
          else if (res?.success) {
            setMessage(res.message);
            handleCloseModal();
          }
        } catch (err) {
          setError(err.message);
        }
      });
    } else if (actionType === 'revoke') {
      startTransition(async () => {
        try {
          const res = await revokeUserSubscription(null, formData);
          if (res?.error) setError(res.error);
          else if (res?.success) {
            setMessage(res.message);
            handleCloseModal();
          }
        } catch (err) {
          setError(err.message);
        }
      });
    }
  };

  return (
    <div className="admin-user-subs-wrapper">
      {/* 1. Statistics Cards */}
      <div className="admin-metrics-grid" style={{ marginBottom: 24 }}>
        <div className="metric-box">
          <span className="metric-icon">👥</span>
          <div className="metric-info">
            <span className="metric-val">{totalUsers}</span>
            <span className="metric-label">Filtrlangan natijalar</span>
          </div>
        </div>

        <div className="metric-box highlight">
          <span className="metric-icon">👑</span>
          <div className="metric-info">
            <span className="metric-val">{activeVipCount}</span>
            <span className="metric-label">Faol VIP (joriy sahifada)</span>
          </div>
        </div>

        <div className="metric-box">
          <span className="metric-icon">⌛</span>
          <div className="metric-info">
            <span className="metric-val">{expiredCount}</span>
            <span className="metric-label">Muddati tugagan (joriy sahifada)</span>
          </div>
        </div>

        <div className="metric-box">
          <span className="metric-icon">📜</span>
          <div className="metric-info">
            <span className="metric-val">{auditLogs.length}</span>
            <span className="metric-label">Audit Yozuvlari</span>
          </div>
        </div>
      </div>

      {message && <div className="admin-alert-success" style={{ marginBottom: 16 }}>🎉 {message}</div>}
      {error && <div className="admin-alert-error" style={{ marginBottom: 16 }}>⚠️ {error}</div>}

      {/* 2. Sub-tab switcher */}
      <div className="admin-subtabs-nav" style={{ marginBottom: 20 }}>
        <button
          type="button"
          className={`subtab-btn ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          👤 Foydalanuvchilar va VIP berish ({filteredPageCount})
        </button>
        <button
          type="button"
          className={`subtab-btn ${activeTab === 'subscriptions' ? 'active' : ''}`}
          onClick={() => setActiveTab('subscriptions')}
        >
          📋 Barcha Obunalar Tarixi ({subscriptions.length})
        </button>
        <button
          type="button"
          className={`subtab-btn ${activeTab === 'audit' ? 'active' : ''}`}
          onClick={() => setActiveTab('audit')}
        >
          🛡️ Admin Audit Jurnali ({auditLogs.length})
        </button>
      </div>

      {/* TAB 1: USERS & GRANT */}
      {activeTab === 'users' && (
        <div className="card admin-pane">
          {/* Search & Filter Bar */}
          <form action="/admin" method="get" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 20 }}>
            <input type="hidden" name="tab" value="subscriptions" />
            <input type="hidden" name="usersPage" value="1" />
            <input type="hidden" name="usersPageSize" value={pageSize} />
            <div style={{ flex: 1, minWidth: 260 }}>
              <input
                type="text"
                name="usersSearch"
                defaultValue={searchQuery}
                placeholder="Foydalanuvchini username, ism yoki ID bo‘yicha qidirish..."
                className="search-input-pro"
                style={{ width: '100%', height: 42 }}
              />
            </div>
            <select name="usersStatus" defaultValue={filterStatus} aria-label="Obuna holati bo‘yicha filtrlash">
              <option value="all">Barchasi</option>
              <option value="vip">Faol VIP</option>
              <option value="free">Oddiy</option>
              <option value="expired">Muddati tugagan</option>
            </select>
            <button type="submit" className="btn primary sm">Qidirish</button>
          </form>

          {/* Users Table */}
          <div className="table-wrapper-pro">
            <table className="pro-table">
              <thead>
                <tr>
                  <th>Foydalanuvchi</th>
                  <th>Obuna Holati</th>
                  <th>Tugash Muddati</th>
                  <th>Qolgan Vaqt</th>
                  <th style={{ textAlign: 'right' }}>Harakatlar</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((u) => {
                    const isVip = u.subscription_plan === 'vip';
                    const expDate = u.subscription_expires_at ? new Date(u.subscription_expires_at) : null;
                    const isExpired = isVip && expDate && expDate <= now;
                    const isActiveVip = isVip && (!expDate || expDate > now);

                    // Days remaining
                    let daysLeft = null;
                    if (isActiveVip && expDate) {
                      daysLeft = Math.ceil((expDate - now) / (1000 * 60 * 60 * 24));
                    }

                    return (
                      <tr key={u.id}>
                        <td>
                          <b>@{u.username || 'noma’lum'}</b>
                          {u.display_name && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{u.display_name}</div>}
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{u.id.slice(0, 16)}...</div>
                        </td>
                        <td>
                          {isActiveVip ? (
                            <span className="badge-vip-pill">👑 VIP FAOL</span>
                          ) : isExpired ? (
                            <span className="badge-draft">⌛ TUGAGAN</span>
                          ) : (
                            <span className="badge-free-pill">Oddiy</span>
                          )}
                        </td>
                        <td>
                          {expDate ? expDate.toLocaleDateString('uz-UZ', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                        </td>
                        <td>
                          {isActiveVip ? (
                            daysLeft !== null ? (
                              <span style={{ color: daysLeft <= 3 ? '#ff4d6d' : '#2ecc71', fontWeight: 700 }}>
                                {daysLeft} kun qoldi
                              </span>
                            ) : (
                              'Cheksiz'
                            )
                          ) : (
                            '—'
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            {!isActiveVip ? (
                              <button
                                type="button"
                                className="btn primary sm"
                                onClick={() => handleOpenGrant(u)}
                                disabled={isPending}
                              >
                                👑 VIP Berish
                              </button>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className="btn ghost sm"
                                  onClick={() => handleOpenExtend(u)}
                                  disabled={isPending}
                                  title="Muddati uzaytirish"
                                >
                                  ⏳ +Uzatish
                                </button>
                                <button
                                  type="button"
                                  className="btn danger sm"
                                  onClick={() => handleOpenRevoke(u)}
                                  disabled={isPending}
                                  title="Obunani bekor qilish"
                                >
                                  Bekor qilish
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                      Foydalanuvchilar topilmadi.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
            <span>{totalCount} ta natija · {page}/{totalUserPages}-sahifa</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {page > 1 && <Link className="btn ghost sm" href={pageHref(page - 1)}>Oldingi</Link>}
              {page < totalUserPages && <Link className="btn ghost sm" href={pageHref(page + 1)}>Keyingi</Link>}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ALL SUBSCRIPTIONS HISTORY */}
      {activeTab === 'subscriptions' && (
        <div className="card admin-pane">
          <h3 className="admin-pane-title">📋 Barcha Berilgan Obunalar Tarixi</h3>
          <p className="hint" style={{ marginBottom: 16 }}>
            Adminlar tomonidan qo‘lda berilgan va tizimdagi barcha obuna yozuvlari ro‘yxati.
          </p>

          <div className="table-wrapper-pro">
            <table className="pro-table">
              <thead>
                <tr>
                  <th>Foydalanuvchi</th>
                  <th>Tarif (Plan)</th>
                  <th>Boshlangan sana</th>
                  <th>Tugash sanasi</th>
                  <th>Holati</th>
                  <th>Berilish usuli</th>
                  <th>Izoh</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.length > 0 ? (
                  subscriptions.map((s) => {
                    const startsAt = new Date(s.starts_at);
                    const expiresAt = new Date(s.expires_at);
                    const now = new Date();
                    const isActive = s.status === 'active' && startsAt <= now && expiresAt > now;
                    const isScheduled = s.status === 'active' && startsAt > now;
                    return (
                    <tr key={s.id}>
                      <td>
                        <b>@{s.user?.username || 'user'}</b>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.user_id.slice(0, 8)}...</div>
                      </td>
                      <td><b>{s.plan_name}</b></td>
                      <td>{new Date(s.starts_at).toLocaleDateString('uz-UZ')}</td>
                      <td>{new Date(s.expires_at).toLocaleDateString('uz-UZ')}</td>
                      <td>
                        <span className={isActive ? 'badge-published' : 'badge-draft'}>
                          {isActive ? '● Faol' : isScheduled ? '◷ Rejalashtirilgan' : expiresAt <= now ? '⌛ Tugagan' : s.status === 'expired' ? '⌛ Tugagan' : '✕ Bekor qilingan'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: 12, background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: 6 }}>
                          {s.grant_type === 'manual_admin' ? 'Qo‘lda (Admin)' : s.grant_type}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.notes || '—'}</td>
                    </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                      Hozircha birorta obuna qaydnomasi mavjud emas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: AUDIT LOGS */}
      {activeTab === 'audit' && (
        <div className="card admin-pane">
          <h3 className="admin-pane-title">🛡️ Obunalar Bo‘yicha Xavfsizlik va Audit Jurnali</h3>
          <p className="hint" style={{ marginBottom: 16 }}>
            Har bir admin tomonidan bajarilgan harakatlar (VIP berish, uzaytirish, bekor qilish) qat’iy qayd etiladi.
          </p>

          <div className="table-wrapper-pro">
            <table className="pro-table">
              <thead>
                <tr>
                  <th>Vaqt</th>
                  <th>Bajaruvchi Admin</th>
                  <th>Harakat</th>
                  <th>Foydalanuvchi</th>
                  <th>Oldingi holat</th>
                  <th>Yangi holat</th>
                  <th>Sabab / Izoh</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.length > 0 ? (
                  auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {new Date(log.created_at).toLocaleString('uz-UZ')}
                      </td>
                      <td>
                        <b>@{log.admin?.username || 'Admin'}</b>
                      </td>
                      <td>
                        <span className={`badge-role ${log.action === 'revoke' ? 'danger' : 'primary'}`}>
                          {log.action.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <b>@{log.user?.username || 'user'}</b>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{log.previous_plan || 'free'}</td>
                      <td>
                        <span style={{ color: '#2ecc71', fontWeight: 600 }}>{log.new_plan}</span>
                      </td>
                      <td style={{ fontSize: 12 }}>{log.reason || '—'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                      Audit jurnali hozircha bo‘sh.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. MODAL DIALOG (GRANT / EXTEND / REVOKE) WITH CONFIRMATION */}
      {selectedUser && (
        <div className="admin-modal-backdrop">
          <div className="card admin-pane admin-modal-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, margin: 0 }}>
                {actionType === 'grant' && `👑 @${selectedUser.username} ga VIP Obuna berish`}
                {actionType === 'extend' && `⏳ @${selectedUser.username} obunasini uzaytirish`}
                {actionType === 'revoke' && `⚠️ @${selectedUser.username} obunasini bekor qilish`}
              </h3>
              <button type="button" onClick={handleCloseModal} className="btn-clear-preview" style={{ position: 'static' }}>
                ✕
              </button>
            </div>

            {!confirmStep ? (
              <div>
                {actionType === 'grant' && (
                  <>
                    <div className="field">
                      <label>Tarif Rejasi (Plan) tanlang</label>
                      <select
                        value={selectedPlanId}
                        onChange={(e) => {
                          setSelectedPlanId(e.target.value);
                          const p = plans.find((pl) => pl.id === e.target.value);
                          if (p) setCustomDays(p.duration_days);
                        }}
                      >
                        {plans.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.duration_days} kun) — {Number(p.price_uzs).toLocaleString()} UZS
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="field">
                      <label>Amal qilish muddati (kunlar)</label>
                      <input
                        type="number"
                        min="1"
                        max="3650"
                        value={customDays}
                        onChange={(e) => setCustomDays(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      />
                    </div>
                  </>
                )}

                {actionType === 'extend' && (
                  <div className="field">
                    <label>Qo‘shimcha kunlar soni (+kun)</label>
                    <input
                      type="number"
                      min="1"
                      max="3650"
                      value={customDays}
                      onChange={(e) => setCustomDays(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    />
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button type="button" className="btn ghost sm" onClick={() => setCustomDays(30)}>+30 kun</button>
                      <button type="button" className="btn ghost sm" onClick={() => setCustomDays(90)}>+90 kun</button>
                      <button type="button" className="btn ghost sm" onClick={() => setCustomDays(180)}>+180 kun</button>
                      <button type="button" className="btn ghost sm" onClick={() => setCustomDays(365)}>+1 yil</button>
                    </div>
                  </div>
                )}

                <div className="field">
                  <label>Izoh / Sabab (Audit jurnali uchun)</label>
                  <input
                    type="text"
                    value={actionNotes}
                    onChange={(e) => setActionNotes(e.target.value)}
                    placeholder="Masalan: Telegram orqali to‘lov qilgani uchun yoki maxsus sovg‘a"
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
                  <button type="button" className="btn ghost" onClick={handleCloseModal}>
                    Bekor qilish
                  </button>
                  <button
                    type="button"
                    className={`btn ${actionType === 'revoke' ? 'danger' : 'primary'}`}
                    onClick={() => setConfirmStep(true)}
                  >
                    Davom etish →
                  </button>
                </div>
              </div>
            ) : (
              /* Confirmation Screen (Required step before saving) */
              <div className="confirmation-step-box">
                <div style={{ textAlign: 'center', padding: '10px 0 20px' }}>
                  <span style={{ fontSize: 40 }}>⚠️</span>
                  <h4 style={{ fontSize: 18, marginTop: 10 }}>Ushbu amalni tasdiqlaysizmi?</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 6, lineHeight: 1.5 }}>
                    {actionType === 'grant' && (
                      <>
                        <b>@{selectedUser.username}</b> foydalanuvchisiga <b>{customDays} kunlik</b> VIP obuna beriladi.
                      </>
                    )}
                    {actionType === 'extend' && (
                      <>
                        <b>@{selectedUser.username}</b> obunasi muddati qo‘shimcha <b>+{customDays} kunga</b> uzaytiriladi.
                      </>
                    )}
                    {actionType === 'revoke' && (
                      <>
                        <b>@{selectedUser.username}</b> foydalanuvchisining VIP obunasi darhol bekor qilinadi.
                      </>
                    )}
                  </p>
                  <div style={{ background: 'rgba(255,255,255,0.05)', padding: 10, borderRadius: 8, marginTop: 12, fontSize: 13 }}>
                    Izoh: <i>“{actionNotes}”</i>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => setConfirmStep(false)}
                    disabled={isPending}
                  >
                    ← Ortga qaytish
                  </button>
                  <button
                    type="button"
                    className={`btn ${actionType === 'revoke' ? 'danger' : 'primary'}`}
                    onClick={handleExecuteAction}
                    disabled={isPending}
                  >
                    {isPending ? '⏳ Bajarilmoqda...' : 'Tasdiqlayman va Saqlash'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
