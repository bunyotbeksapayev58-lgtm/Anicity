import { createClient } from '@/lib/supabase/server';
import { logout } from '@/app/actions/auth';
import Navbar from './Navbar';

export default async function Header() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let profile = null;
  let isVip = false;

  if (user) {
    const profilePromise = supabase
      .from('profiles')
      .select('username, display_name, avatar_url, role')
      .eq('id', user.id)
      .single();

    const subscriptionsPromise = supabase
      .from('user_subscriptions')
      .select('status, starts_at, expires_at')
      .eq('user_id', user.id)
      .eq('status', 'active');

    const [{ data: profData }, { data: subsData, error: subscriptionsError }] = await Promise.all([
      profilePromise,
      subscriptionsPromise,
    ]);

    if (subscriptionsError) throw new Error('Obuna holatini tekshirishda xatolik: ' + subscriptionsError.message);

    profile = profData;
    const now = new Date();
    isVip = (subsData || []).some((subscription) =>
      new Date(subscription.starts_at) <= now && new Date(subscription.expires_at) > now
    );
  }

  return <Navbar user={user} profile={{ ...profile, isVip }} logoutAction={logout} />;
}
