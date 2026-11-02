import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AdminAnimeForm from '@/components/AdminAnimeForm';
import { deleteAnime } from '@/app/actions/admin';
import { isAdminRole } from '@/lib/roles';

export const metadata = { title: 'Admin — Anicity' };

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!isAdminRole(profile?.role)) redirect('/');

  const { data: animes } = await supabase
    .from('animes')
    .select('id, title, year, poster_url, status, episodes(count)')
    .order('created_at', { ascending: false });

  return (
    <>
      <h1 className="grad" style={{ fontSize: 26, marginBottom: 20 }}>Admin panel</h1>
      <div className="admin">
        <div className="card">
          <h2 style={{ fontSize: 18, marginBottom: 18 }}>Yangi anime yuklash</h2>
          <AdminAnimeForm />
        </div>
        <div className="card">
          <h2 style={{ fontSize: 18, marginBottom: 18 }}>Yuklangan animelar ({animes?.length ?? 0})</h2>
          {animes?.length ? animes.map((a) => (
            <div className="li" key={a.id}>
              <div className="thumb">
                {a.poster_url ? <img src={a.poster_url} alt="" /> : a.title.charAt(0)}
              </div>
              <div className="t">
                <b>{a.title}</b>
                <small>{a.year} • {a.episodes?.[0]?.count ?? 0} ta qism • {a.status}</small>
              </div>
              <a className="btn ghost sm" href={`/anime/${a.id}`}>Ko‘rish</a>
              <a className="btn ghost sm" href={`/admin/${a.id}/edit`}>Tahrirlash</a>
              <form action={deleteAnime}>
                <input type="hidden" name="id" value={a.id} />
                <button className="btn danger">O‘chirish</button>
              </form>
            </div>
          )) : <p className="muted">Hali anime yo‘q</p>}
        </div>
      </div>
    </>
  );
}
