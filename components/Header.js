import { createClient } from '@/lib/supabase/server';
import { logout } from '@/app/actions/auth';
import Navbar from './Navbar';

export default async function Header() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from('profiles').select('username, role').eq('id', user.id).single()
    : { data: null };

  return <Navbar user={user} profile={profile} logoutAction={logout} />;
}
