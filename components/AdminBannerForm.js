'use client';

import { useActionState } from 'react';
import { createBanner } from '@/app/actions/admin';

export default function AdminBannerForm({ animes = [] }) {
  const [state, formAction, pending] = useActionState(createBanner, null);

  return (
    <form action={formAction} className="admin-subform">
      <div className="field">
        <label htmlFor="banner-title">Banner Sarlavhasi *</label>
        <input
          id="banner-title"
          name="title"
          required
          placeholder="Masalan: Suzume no Tojimari"
        />
      </div>

      <div className="field">
        <label htmlFor="banner-subtitle">Tavsif yoki Shior</label>
        <textarea
          id="banner-subtitle"
          name="subtitle"
          placeholder="Masalan: Taqdir eshiklarini yopish vaqti keldi..."
          style={{ minHeight: 70 }}
        />
      </div>

      <div className="row2">
        <div className="field">
          <label htmlFor="banner-anime">Bog‘langan Anime (ixtiyoriy)</label>
          <select id="banner-anime" name="anime_id">
            <option value="">-- Tanlanmagan --</option>
            {animes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title} ({a.year})
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="banner-link">Tashqi / Qo‘lda havola</label>
          <input
            id="banner-link"
            name="linkUrl"
            placeholder="/anime/xyz yoki https://..."
          />
        </div>
      </div>

      <div className="row2">
        <div className="field">
          <label htmlFor="banner-img-file">Rasm yuklash (maks 5MB)</label>
          <input id="banner-img-file" name="image" type="file" accept="image/*" />
        </div>

        <div className="field">
          <label htmlFor="banner-img-url">Yoki Rasm URL havolasi</label>
          <input
            id="banner-img-url"
            name="imageUrl"
            placeholder="https://images.unsplash.com/..."
          />
        </div>
      </div>

      <div className="row2" style={{ alignItems: 'center' }}>
        <div className="field">
          <label htmlFor="banner-sort">Tartib raqami</label>
          <input id="banner-sort" name="sort_order" type="number" defaultValue="1" min="0" />
        </div>

        <div className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 }}>
          <input
            id="banner-active"
            name="is_active"
            type="checkbox"
            defaultChecked
            style={{ width: 'auto', cursor: 'pointer' }}
          />
          <label htmlFor="banner-active" style={{ cursor: 'pointer', margin: 0 }}>
            Hozir faol bo‘lsin
          </label>
        </div>
      </div>

      {state?.error && <div className="err">{state.error}</div>}
      {state?.message && <div className="ok">{state.message}</div>}

      <button className="btn" style={{ width: '100%', marginTop: 10 }} disabled={pending}>
        {pending ? 'Saqlanmoqda...' : '+ Yangi Banner Qo‘shish'}
      </button>
    </form>
  );
}
