'use client';
import { useActionState } from 'react';

// Tahrirlash formasi. defaults: mavjud anime ma'lumotlari, action: updateAnime
export default function AnimeEditForm({ action, defaults }) {
  const [state, formAction, pending] = useActionState(action, null);
  const d = defaults;
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={d.id} />
      <input type="hidden" name="oldPoster" value={d.poster_url || ''} />
      <div className="field"><label>Nomi</label><input name="title" defaultValue={d.title} required /></div>
      <div className="row2">
        <div className="field"><label>Yil</label><input name="year" type="number" min="1960" max="2100" defaultValue={d.year} /></div>
        <div className="field"><label>Holati</label>
          <select name="status" defaultValue={d.status}><option>Tugallangan</option><option>Davom etmoqda</option></select>
        </div>
      </div>
      <div className="field"><label>Janrlar (vergul bilan)</label><input name="genres" defaultValue={(d.genres || []).join(', ')} /></div>
      <div className="field"><label>Tavsif</label><textarea name="description" defaultValue={d.description} /></div>
      <div className="field"><label>Poster (URL)</label><input name="posterUrl" defaultValue={d.poster_url || ''} /></div>
      <div className="field"><label>yoki yangi poster fayl (3 MB gacha)</label><input name="poster" type="file" accept="image/*" /></div>
      <div className="field">
        <label>Qismlar (o‘zgartirsangiz, ro‘yxat almashtiriladi; bo‘sh qoldirsangiz o‘zgarmaydi)</label>
        <textarea name="episodes" placeholder={'1-qism | https://drive.google.com/file/d/XXXX/view?usp=sharing'} />
      </div>
      <button className="btn" style={{ width: '100%' }} disabled={pending}>
        {pending ? 'Saqlanmoqda...' : 'Saqlash'}
      </button>
      {state?.error && <div className="err">{state.error}</div>}
      {state?.message && <div className="ok">{state.message}</div>}
    </form>
  );
}
