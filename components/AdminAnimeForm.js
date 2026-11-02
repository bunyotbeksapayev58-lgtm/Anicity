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
      <div className="field">
        <label>Anime Nomi</label>
        <input name="title" required placeholder="Masalan: Solo Leveling" />
      </div>

      <div className="row2">
        <div className="field">
          <label>Yil</label>
          <input name="year" type="number" min="1960" max="2100" defaultValue={2025} />
        </div>
        <div className="field">
          <label>Holati</label>
          <select name="status">
            <option value="Davom etmoqda">Davom etmoqda (Ongoing)</option>
            <option value="Tugallangan">Tugallangan</option>
          </select>
        </div>
      </div>

      <div className="row2">
        <div className="field">
          <label>Haftalik Chiqish Kuni (Ongoing jadvali uchun)</label>
          <select name="releaseDay">
            <option value="">Belgilanmagan (Jadvalsiz)</option>
            <option value="dushanba">Dushanba</option>
            <option value="seshanba">Seshanba</option>
            <option value="chorshanba">Chorshanba</option>
            <option value="payshanba">Payshanba</option>
            <option value="juma">Juma</option>
            <option value="shanba">Shanba</option>
            <option value="yakshanba">Yakshanba</option>
          </select>
        </div>
        <div className="field">
          <label>Dublyaj / Fandub Jamoasi</label>
          <input name="fandubTeam" defaultValue="Anicity Dub" placeholder="Anicity Dub" />
        </div>
      </div>

      <div className="row2">
        <div className="field">
          <label>Studiya</label>
          <input name="studio" placeholder="Masalan: MAPPA, Ufotable, A-1 Pictures" />
        </div>
        <div className="field">
          <label>Janrlar (vergul bilan ajratilgan)</label>
          <input name="genres" placeholder="Action, Fantaziya, Shounen" />
        </div>
      </div>

      <div className="field">
        <label>Tavsif (Synopsis)</label>
        <textarea name="description" rows={3} placeholder="Anime haqida qisqacha ma’lumot..." />
      </div>

      <div className="row2">
        <div className="field">
          <label>Poster (URL)</label>
          <input name="posterUrl" placeholder="https://..." />
        </div>
        <div className="field">
          <label>Katta Keng Banner / Backdrop (URL)</label>
          <input name="bannerUrl" placeholder="https://..." />
        </div>
      </div>

      <div className="field">
        <label>yoki kompyuterdan poster fayl yuklash (3 MB gacha)</label>
        <input name="poster" type="file" accept="image/*" />
      </div>

      <div className="field">
        <label>Epizodlar ro‘yxati</label>
        <textarea
          name="episodes"
          required
          rows={5}
          placeholder={'1-qism | https://drive.google.com/file/d/XXXX/view?usp=sharing\n2-qism | https://drive.google.com/file/d/YYYY/view?usp=sharing'}
        />
      </div>
      <p className="hint">
        Har qatorga: <b>“Epizod nomi | havola”</b>. Google Drive (Share → “Anyone with the link”) yoki to‘g‘ridan-to‘g‘ri MP4 havolasini kiriting.
      </p>

      <button className="btn" style={{ width: '100%' }} disabled={pending}>
        {pending ? 'Yuklanmoqda...' : '🚀 Saytga chiqarish'}
      </button>

      {state?.error && <div className="err">{state.error}</div>}
      {state?.message && <div className="ok">{state.message}</div>}
    </form>
  );
}
