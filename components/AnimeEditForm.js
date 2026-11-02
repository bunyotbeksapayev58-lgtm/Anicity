'use client';
import { useActionState } from 'react';

export default function AnimeEditForm({ action, defaults }) {
  const [state, formAction, pending] = useActionState(action, null);
  const d = defaults;

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={d.id} />
      <input type="hidden" name="oldPoster" value={d.poster_url || ''} />

      <div className="field">
        <label>Nomi</label>
        <input name="title" defaultValue={d.title} required />
      </div>

      <div className="row2">
        <div className="field">
          <label>Yil</label>
          <input name="year" type="number" min="1960" max="2100" defaultValue={d.year} />
        </div>
        <div className="field">
          <label>Holati</label>
          <select name="status" defaultValue={d.status || 'Davom etmoqda'}>
            <option value="Davom etmoqda">Davom etmoqda</option>
            <option value="Tugallangan">Tugallangan</option>
          </select>
        </div>
      </div>

      <div className="row2">
        <div className="field">
          <label>Chiqish kuni (Jadval)</label>
          <select name="releaseDay" defaultValue={d.release_day || ''}>
            <option value="">Belgilanmagan</option>
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
          <label>Dublyaj jamoasi</label>
          <input name="fandubTeam" defaultValue={d.fandub_team || 'Anicity Dub'} />
        </div>
      </div>

      <div className="row2">
        <div className="field">
          <label>Studiya</label>
          <input name="studio" defaultValue={d.studio || ''} placeholder="MAPPA, Ufotable..." />
        </div>
        <div className="field">
          <label>Janrlar (vergul bilan)</label>
          <input name="genres" defaultValue={(d.genres || []).join(', ')} />
        </div>
      </div>

      <div className="field">
        <label>Tavsif</label>
        <textarea name="description" rows={3} defaultValue={d.description || ''} />
      </div>

      <div className="row2">
        <div className="field">
          <label>Poster (URL)</label>
          <input name="posterUrl" defaultValue={d.poster_url || ''} />
        </div>
        <div className="field">
          <label>Banner / Backdrop (URL)</label>
          <input name="bannerUrl" defaultValue={d.banner_url || ''} />
        </div>
      </div>

      <div className="field">
        <label>yoki yangi poster fayl (3 MB gacha)</label>
        <input name="poster" type="file" accept="image/*" />
      </div>

      <div className="field">
        <label>Qismlar (o‘zgartirsangiz, ro‘yxat yangilanadi; bo‘sh qoldirsangiz o‘zgarmaydi)</label>
        <textarea
          name="episodes"
          rows={5}
          placeholder={'1-qism | https://drive.google.com/file/d/XXXX/view?usp=sharing'}
        />
      </div>

      <button className="btn" style={{ width: '100%' }} disabled={pending}>
        {pending ? 'Saqlanmoqda...' : 'O‘zgarishlarni saqlash'}
      </button>

      {state?.error && <div className="err">{state.error}</div>}
      {state?.message && <div className="ok">{state.message}</div>}
    </form>
  );
}
