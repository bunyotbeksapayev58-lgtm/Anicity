'use client';

import { useState, useRef, useTransition } from 'react';
import {
  createSubscriptionPlan,
  updateSubscriptionPlan,
  togglePlanActive,
  deleteSubscriptionPlan,
} from '@/app/actions/admin';

export default function AdminSubscriptionPlans({ plans = [] }) {
  const [isPending, startTransition] = useTransition();
  const [editingPlan, setEditingPlan] = useState(null);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const formRef = useRef(null);

  const handleStartEdit = (plan) => {
    setEditingPlan(plan);
    setError(null);
    setMessage(null);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleCancelEdit = () => {
    setEditingPlan(null);
    formRef.current?.reset();
    setError(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const formData = new FormData(formRef.current);
    if (editingPlan) {
      formData.set('id', editingPlan.id);
    }

    startTransition(async () => {
      try {
        const res = editingPlan
          ? await updateSubscriptionPlan(null, formData)
          : await createSubscriptionPlan(null, formData);

        if (res?.error) {
          setError(res.error);
        } else if (res?.success) {
          setMessage(res.message);
          setEditingPlan(null);
          formRef.current?.reset();
        }
      } catch (err) {
        setError(err.message || 'Xatolik yuz berdi');
      }
    });
  };

  const handleToggle = (plan) => {
    const formData = new FormData();
    formData.set('id', plan.id);
    formData.set('active', String(plan.is_active));

    startTransition(async () => {
      try {
        await togglePlanActive(formData);
      } catch (err) {
        setError(err.message);
      }
    });
  };

  const handleDelete = (plan) => {
    if (!confirm(`“${plan.name}” tarifini o‘chirishni tasdiqlaysizmi?`)) return;
    const formData = new FormData();
    formData.set('id', plan.id);

    startTransition(async () => {
      try {
        await deleteSubscriptionPlan(formData);
        setMessage(`“${plan.name}” tarifi o‘chirildi`);
      } catch (err) {
        setError(err.message);
      }
    });
  };

  return (
    <div className="admin-plans-container">
      {message && <div className="admin-alert-success" style={{ marginBottom: 16 }}>🎉 {message}</div>}
      {error && <div className="admin-alert-error" style={{ marginBottom: 16 }}>⚠️ {error}</div>}

      <div className="admin-grid-layout">
        {/* Left Column: Create or Edit Plan Form */}
        <div className="card admin-pane">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 className="admin-pane-title" style={{ margin: 0 }}>
              {editingPlan ? `✏️ “${editingPlan.name}” ni tahrirlash` : '➕ Yangi Tarif (Plan) Qo‘shish'}
            </h3>
            {editingPlan && (
              <button type="button" onClick={handleCancelEdit} className="btn ghost sm">
                Bekor qilish
              </button>
            )}
          </div>

          <form ref={formRef} onSubmit={handleSubmit} className="admin-form-styled">
            <div className="field">
              <label>Tarif Nomi *</label>
              <input
                name="name"
                defaultValue={editingPlan?.name || ''}
                placeholder="Masalan: 3 Oylik VIP (Maxsus)"
                required
                disabled={isPending}
              />
            </div>

            <div className="row2">
              <div className="field">
                <label>Slug (Identifikator) *</label>
                <input
                  name="slug"
                  defaultValue={editingPlan?.slug || ''}
                  placeholder="vip_3_months"
                  required={!editingPlan}
                  disabled={isPending || Boolean(editingPlan)}
                />
              </div>

              <div className="field">
                <label>Amal qilish muddati (Kunlarda) *</label>
                <input
                  name="duration_days"
                  type="number"
                  min="1"
                  max="3650"
                  defaultValue={editingPlan?.duration_days || 30}
                  required
                  disabled={isPending}
                />
              </div>
            </div>

            <div className="row2">
              <div className="field">
                <label>Narxi (O‘zbek so‘mida - UZS) *</label>
                <input
                  name="price_uzs"
                  type="number"
                  min="0"
                  step="1000"
                  defaultValue={editingPlan?.price_uzs || 25000}
                  required
                  disabled={isPending}
                />
              </div>

              <div className="field">
                <label>Tartib raqami</label>
                <input
                  name="sort_order"
                  type="number"
                  defaultValue={editingPlan?.sort_order || 0}
                  disabled={isPending}
                />
              </div>
            </div>

            <div className="field">
              <label>Qisqacha tavsifi</label>
              <textarea
                name="description"
                rows={2}
                defaultValue={editingPlan?.description || ''}
                placeholder="Ushbu tarif kimlar uchun qulay va qanday afzalliklarga ega..."
                disabled={isPending}
              />
            </div>

            <div className="field">
              <label>Afzalliklar / Xususiyatlar (Har bir qatorga bittadan)</label>
              <textarea
                name="benefits"
                rows={4}
                defaultValue={(editingPlan?.benefits || []).join('\n')}
                placeholder={'1080p Full HD sifat\n100% Reklamasiz tomosha\nYangi premyeralar navbatsiz\nVIP nishon'}
                disabled={isPending}
              />
              <p className="hint">Har bir qator obuna sahifasida «✓» belgisi bilan ko‘rsatiladi.</p>
            </div>

            <div className="row2" style={{ alignItems: 'center', marginTop: 8 }}>
              <label className="checkbox-toggle-label">
                <input
                  type="checkbox"
                  name="is_popular"
                  defaultChecked={Boolean(editingPlan?.is_popular)}
                  disabled={isPending}
                />
                <span>🔥 “Eng ommabop” belgisi</span>
              </label>

              <label className="checkbox-toggle-label">
                <input
                  type="checkbox"
                  name="is_active"
                  defaultChecked={editingPlan ? editingPlan.is_active : true}
                  disabled={isPending}
                />
                <span>🟢 Saytda faol ko‘rinsin</span>
              </label>
            </div>

            <button type="submit" className="btn primary" style={{ width: '100%', marginTop: 18 }} disabled={isPending}>
              {isPending ? '⏳ Saqlanmoqda...' : editingPlan ? '💾 O‘zgarishlarni Saqlash' : '➕ Yangi Tarifni Saqlash'}
            </button>
          </form>
        </div>

        {/* Right Column: Existing Plans List */}
        <div className="card admin-pane">
          <h3 className="admin-pane-title">📋 Mavjud Obuna Tariflari ({plans.length})</h3>
          <p className="hint" style={{ marginBottom: 16 }}>
            Foydalanuvchilar obuna sahifasida ushbu faol tariflarni ko‘rishadi.
          </p>

          <div className="admin-items-list">
            {plans.map((p) => (
              <div key={p.id} className="li-admin" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <b style={{ fontSize: 16, color: '#fff' }}>{p.name}</b>
                      {p.is_popular && <span className="save-badge">🔥 OMMABOP</span>}
                      <span className={p.is_active ? 'badge-published' : 'badge-draft'}>
                        {p.is_active ? '● Faol' : '○ Nofaol'}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                      Muddat: <b>{p.duration_days} kun</b> • Slug: <code>{p.slug}</code>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)' }}>
                      {Number(p.price_uzs).toLocaleString()} UZS
                    </span>
                  </div>
                </div>

                {p.benefits && p.benefits.length > 0 && (
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {p.benefits.map((b, idx) => (
                      <span key={idx} style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: 6 }}>
                        ✓ {b}
                      </span>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }}>
                  <button
                    type="button"
                    onClick={() => handleToggle(p)}
                    className={`btn sm ${p.is_active ? 'ghost' : 'primary'}`}
                    disabled={isPending}
                  >
                    {p.is_active ? 'Nofaol qilish' : 'Faollashtirish'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStartEdit(p)}
                    className="btn ghost sm"
                    disabled={isPending}
                  >
                    ✏️ Tahrirlash
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(p)}
                    className="btn danger sm"
                    disabled={isPending}
                  >
                    🗑️ O‘chirish
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
