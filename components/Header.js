import { createClient } from '@/lib/supabase/server';
import { logout } from '@/app/actions/auth';
import Navbar from './Navbar';

export default async function Header() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from('profiles').select('username, display_name, avatar_url, role').eq('id', user.id).single()
    : { data: null };
  const { data: subscriptions, error: subscriptionsError } = user
    ? await supabase.from('user_subscriptions').select('status, starts_at, expires_at').eq('user_id', user.id).eq('status', 'active')
    : { data: [] };
  if (subscriptionsError) throw new Error('Obuna holatini tekshirishda xatolik: ' + subscriptionsError.message);
  const now = new Date();
  const isVip = (subscriptions || []).some((subscription) =>
    new Date(subscription.starts_at) <= now && new Date(subscription.expires_at) > now
  );

  return <Navbar user={user} profile={{ ...profile, isVip }} logoutAction={logout} />;
}
