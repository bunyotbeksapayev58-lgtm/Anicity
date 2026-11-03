import { redirect } from 'next/navigation';
import AdminAnimeSection from '@/components/AdminAnimeSection';
import AssistantVideoAnalyzer from '@/components/AssistantVideoAnalyzer';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Cheklangan boshqaruv — Anicity' };

const PERMISSION_KEYS = [
  'anime_view', 'anime_create', 'anime_edit', 'anime_delete', 'video_upload',
  'episode_create', 'episode_edit', 'episode_delete', 'video_analyze', 'video_review',
  'comment_moderate', 'report_view',
];

export default async function AssistantAdminPage({ searchParams }) {
  const params = (await searchParams) || {};
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/assistant-admin');

  const { data: profile, error: profileError } = await supabase
    .from('profiles').select('role, suspended_at').eq('id', user.id).single();
  if (profileError || profile?.suspended_at) redirect('/');
  if (profile?.role !== 'assistant_admin') {
    if (profile?.role === 'admin' || profile?.role === 'owner') redirect('/admin');
    redirect('/');
  }

  const permissionResults = await Promise.all(PERMISSION_KEYS.map((p_permission) =>
    supabase.rpc('assistant_has_permission', { p_permission })
  ));
  if (permissionResults.some((result) => result.error)) {
    throw new Error('Ruxsatlar tekshirilmadi. Keyinroq qayta urinib ko‘ring.');
  }
  const permissions = Object.fromEntries(PERMISSION_KEYS.map((key, index) => [
    key, permissionResults[index].data === true,
  ]));

  const canManageEpisodes = Boolean(
    (permissions.episode_create && permissions.video_upload) || permissions.episode_edit || permissions.episode_delete
  );
  const canReadAnime = Boolean(
    permissions.anime_view || permissions.anime_edit || permissions.anime_delete || canManageEpisodes
  );
  let animes = [];
  if (canReadAnime) {
    const { data, error } = await supabase
      .from('animes')
      .select('id, title, year, poster_url, status, release_day, episodes(id, season_number, number, title, video_url, thumbnail_url, is_published, quality, description)')
      .order('created_at', { ascending: false });
    if (error) throw new Error('Ruxsatli kontent ro‘yxati yuklanmadi.');
    animes = data || [];
  }

  const hasAnimeTools = permissions.anime_view || permissions.anime_create || permissions.anime_edit ||
    permissions.anime_delete || canManageEpisodes;
  const firstTab = permissions.anime_create
    ? 'form'
    : canManageEpisodes
      ? 'episodes'
      : 'list';
  const requestedTab = params.tab === 'form' && permissions.anime_create
    ? 'form'
    : params.tab === 'episodes' && canManageEpisodes
      ? 'episodes'
      : params.tab === 'list' && canReadAnime
        ? 'list'
        : firstTab;

  return (
    <div className="admin-page-pro" style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 20px 60px' }}>
      <div className="card admin-pane" style={{ marginBottom: 20 }}>
        <h1 className="admin-pane-title">🛡️ Cheklangan boshqaruv</h1>
        <p className="hint">Bu sahifada faqat sizga berilgan ruxsatlar doirasidagi amallar mavjud. Ruxsatlar serverda har bir amal oldidan qayta tekshiriladi.</p>
      </div>
      {hasAnimeTools ? (
        <AdminAnimeSection
          animes={animes}
          initialSubTab={requestedTab}
          initialAnimeId={params.animeId || null}
          permissions={permissions}
        />
      ) : (
        <div className="card admin-pane">
          <p>Sizga kontent boshqaruvi uchun ruxsat berilmagan.</p>
        </div>
      )}
      {permissions.episode_create && !permissions.video_upload && (
        <div className="admin-alert-error" role="status">Qism yaratish uchun episode_create bilan birga video_upload ruxsati ham kerak.</div>
      )}
      {permissions.video_analyze && <AssistantVideoAnalyzer />}
      {(permissions.video_analyze || permissions.video_review || permissions.comment_moderate || permissions.report_view) && (
        <div className="card admin-pane" style={{ marginTop: 20 }}>
          <h2 className="admin-pane-title">Qo‘shimcha ruxsatlar</h2>
          <p className="hint">Quyidagi ruxsatlar yoqilgan, ammo tegishli ishchi interfeys hozircha ulanmagan:</p>
          <ul>
            {permissions.video_review && <li>Video ko‘rib chiqish</li>}
            {permissions.comment_moderate && <li>Izohlarni moderatsiya qilish</li>}
            {permissions.report_view && <li>Hisobotlarni ko‘rish</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
