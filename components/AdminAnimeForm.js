'use client';
import { useActionState, useRef, useEffect } from 'react';
import { createAnime } from '@/app/actions/admin';

export default function AdminAnimeForm() {
  const [state, formAction, pending] = useActionState(createAnime, null);
  const formRef = useRef(null);

  useEffect(() => {
    if (state?.message) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction}>
      <div className="field"><label>Nomi</label><input name="title" required /></div>
      <div className="row2">
        <div className="field"><label>Yil</label><input name="year" type="number" min="1960" max="2100" defaultValue={2026} /></div>
        <div className="field"><label>Holati</label>
          <select name="status"><option>Tugallangan</option><option>Davom etmoqda</option></select>
        </div>
      </div>
      <div className="field"><label>Janrlar (vergul bilan)</label><input name="genres" placeholder="Action, Drama" /></div>
      <div className="field"><label>Tavsif</label><textarea name="description" /></div>
      <div className="field"><label>Poster (URL)</label><input name="posterUrl" placeholder="https://..." /></div>
      <div className="field"><label>yoki poster fayl (3 MB gacha)</label><input name="poster" type="file" accept="image/*" /></div>
      <div className="field">
        <label>Epizodlar</label>
        <textarea name="episodes" required placeholder={'1-qism | https://drive.google.com/file/d/XXXX/view?usp=sharing\n2-qism | https://drive.google.com/file/d/YYYY/view?usp=sharing'} />
      </div>
      <p className="hint">Har qatorga: “Epizod nomi | havola”. Google Drive ulashish havolasini qo‘ying (Share → “Anyone with the link”). Havola avtomatik pleerga moslanadi.</p>
      <button className="btn" style={{ width: '100%' }} disabled={pending}>
        {pending ? 'Yuklanmoqda...' : 'Saytga qo‘shish'}
      </button>
      {state?.error && <div className="err">{state.error}</div>}
      {state?.message && <div className="ok">{state.message}</div>}
    </form>
  );
}
