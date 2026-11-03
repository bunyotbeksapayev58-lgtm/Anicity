import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { authorizeAdminOperation } from '@/lib/admin-access';
import AnimeEditForm from '@/components/AnimeEditForm';
import { updateAnime } from '@/app/actions/admin';

export const dynamic = 'force-dynamic';

export default async function AssistantAnimeEditPage({ params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/assistant-admin');
  const { data: profile, error: profileError } = await supabase
    .from('profiles').select('role, suspended_at').eq('id', user.id).single();
  if (profileError || profile?.suspended_at || profile?.role !== 'assistant_admin') redirect('/assistant-admin');

  const access = await authorizeAdminOperation(supabase, 'anime_edit');
  if (access.error) redirect('/assistant-admin');
  const { data: anime, error } = await supabase.from('animes').select('*').eq('id', id).single();
  if (error || !anime) notFound();

  return (
    <div className="admin-page-pro" style={{ maxWidth: 900, margin: '0 auto', padding: '28px 20px 60px' }}>
      <Link href="/assistant-admin" className="back">← Cheklangan boshqaruv</Link>
      <div className="card" style={{ maxWidth: 900, marginTop: 18 }}>
        <h1 className="admin-pane-title">“{anime.title}” ni tahrirlash</h1>
        <AnimeEditForm action={updateAnime} defaults={anime} assistant />
      </div>
    </div>
  );
}
