'use client';

import { useActionState } from 'react';
import { createTrailer } from '@/app/actions/admin';

export default function AdminTrailerForm({ animes = [] }) {
  const [state, formAction, pending] = useActionState(createTrailer, null);

  return (
    <form action={formAction} className="admin-subform">
      <div className="field">
        <label htmlFor="trailer-title">Treyler / Lavha Nomi *</label>
        <input
          id="trailer-title"
          name="title"
          required
          placeholder="Masalan: Suzume — Rasmiy Treyler (O‘zbekcha)"
        />
      </div>

      <div className="field">
        <label htmlFor="trailer-video-url">Video Havolasi (YouTube / MP4 / Drive) *</label>
        <input
          id="trailer-video-url"
          name="video_url"
          required
          placeholder="https://www.youtube.com/watch?v=... yoki https://..."
        />
      </div>

      <div className="row2">
        <div className="field">
          <label htmlFor="trailer-anime">Bog‘langan Anime (ixtiyoriy)</label>
          <select id="trailer-anime" name="anime_id">
            <option value="">-- Tanlanmagan --</option>
            {animes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title} ({a.year})
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="trailer-clip-type">Turi</label>
          <select id="trailer-clip-type" name="clip_type" defaultValue="trailer">
            <option value="trailer">Rasmiy Treyler</option>
            <option value="teaser">Tizer</option>
            <option value="pv">Promosion Video (PV)</option>
            <option value="clip">Qisqa Lavha / Sahna</option>
          </select>
        </div>
      </div>

      <div className="row2">
        <div className="field">
          <label htmlFor="trailer-thumb-file">Muqova rasmi yuklash</label>
          <input id="trailer-thumb-file" name="thumbnail" type="file" accept="image/*" />
        </div>

        <div className="field">
          <label htmlFor="trailer-thumb-url">Yoki Muqova rasm URL</label>
          <input
            id="trailer-thumb-url"
            name="thumbnailUrl"
            placeholder="https://images.unsplash.com/..."
          />
        </div>
      </div>

      <div className="row2" style={{ alignItems: 'center' }}>
        <div className="field">
          <label htmlFor="trailer-duration">Davomiyligi (masalan: 02:18)</label>
          <input id="trailer-duration" name="duration_text" defaultValue="02:00" placeholder="02:18" />
        </div>

        <div className="field">
          <label htmlFor="trailer-sort">Tartib raqami</label>
          <input id="trailer-sort" name="sort_order" type="number" defaultValue="1" min="0" />
        </div>
      </div>

      <div className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }}>
        <input
          id="trailer-active"
          name="is_active"
          type="checkbox"
          defaultChecked
          style={{ width: 'auto', cursor: 'pointer' }}
        />
        <label htmlFor="trailer-active" style={{ cursor: 'pointer', margin: 0 }}>
          Hozir saytda ko‘rinsin (Faol)
        </label>
      </div>

      <div className="field">
        <label htmlFor="trailer-desc">Qisqa izoh (ixtiyoriy)</label>
        <textarea
          id="trailer-desc"
          name="description"
          placeholder="Treyler yoki sahna haqida qisqacha..."
          style={{ minHeight: 60 }}
        />
      </div>

      {state?.error && <div className="err">{state.error}</div>}
      {state?.message && <div className="ok">{state.message}</div>}

      <button className="btn" style={{ width: '100%', marginTop: 10 }} disabled={pending}>
        {pending ? 'Saqlanmoqda...' : '+ Yangi Treyler Qo‘shish'}
      </button>
    </form>
  );
}
