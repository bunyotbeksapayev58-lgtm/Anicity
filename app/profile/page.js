import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSubscriptionSummary } from '@/lib/subscriptions';
import ProfileView from '@/components/ProfileView';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Mening Profilim — Anicity',
};

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?next=/profile');
  }

  // 1. Fetch user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, bio, created_at')
    .eq('id', user.id)
    .single();

  // 2. Fetch User Subscriptions History
  const { data: userSubsRaw, error: userSubsError } = await supabase
    .from('user_subscriptions')
    .select('id, plan_name, status, starts_at, expires_at, grant_type, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (userSubsError) {
    throw new Error('Obuna ma’lumotini yuklashda xatolik: ' + userSubsError.message);
  }

  const userSubs = userSubsRaw || [];
  const subscription = getSubscriptionSummary(userSubs);

  // 3. Fetch Watch History (Ko'rish tarixi)
  const { data: historyRaw } = await supabase
    .from('watch_progress')
    .select('position_sec, duration_sec, updated_at, episode_id, anime_id, episodes(number, title, anime_id, animes(id, title, poster_url, year, status, genres, rating_avg))')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(16);

  const historyList = (historyRaw || []).filter((h) => h.episodes?.animes);

  // 4. Fetch Favorites (Saqlangan animelar)
  const { data: favoritesRaw } = await supabase
    .from('favorites')
    .select('created_at, animes(id, title, poster_url, year, status, genres, rating_avg, studio, view_count)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(24);

  const favoritesList = (favoritesRaw || []).map((f) => f.animes).filter(Boolean);

  const now = new Date();
  const isVip = subscription.isVip;
  const expDate = subscription.expiresAt ? new Date(subscription.expiresAt) : null;
  let daysLeft = null;
  if (isVip && expDate) {
    daysLeft = Math.max(1, Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  }

  const joinDate = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('uz-UZ', { year: 'numeric', month: 'long' })
    : 'Yaqinda';

  const expDateFormatted = expDate
    ? expDate.toLocaleDateString('uz-UZ', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  return (
    <ProfileView
      user={user}
      profile={profile}
      subscription={subscription}
      userSubs={userSubs}
      historyList={historyList}
      favoritesList={favoritesList}
      daysLeft={daysLeft}
      joinDate={joinDate}
      expDateFormatted={expDateFormatted}
    />
  );
}
