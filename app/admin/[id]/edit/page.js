import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import AnimeEditForm from '@/components/AnimeEditForm';
import { updateAnime } from '@/app/actions/admin';
import { isAdminRole } from '@/lib/roles';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tahrirlash — Yozora' };

export default async function EditAnimePage({ params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!isAdminRole(profile?.role)) redirect('/');

  const { data: anime } = await supabase.from('animes').select('*').eq('id', id).single();
  if (!anime) notFound();
  const { data: eps } = await supabase.from('episodes').select('number, title, video_url').eq('anime_id', id).order('number');

  // Qismlarni tahrirlash uchun matn ko'rinishi (faqat ko'rsatish uchun, forma bo'sh turadi)
  const episodesText = (eps || []).map((e) => `${e.title} | ${e.video_url}`).join('\n');

  return (
    <>
      <Link href="/admin" className="back">← Admin panel</Link>
      <div className="card" style={{ maxWidth: 720 }}>
        <h2 style={{ fontSize: 18, marginBottom: 18 }}>“{anime.title}” ni tahrirlash</h2>
        <p className="hint">Joriy qismlar ({eps?.length ?? 0} ta):</p>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: 'var(--muted)', marginBottom: 18 }}>{episodesText}</pre>
        <AnimeEditForm action={updateAnime} defaults={anime} />
      </div>
    </>
  );
}
