import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { logout } from '@/app/actions/auth';
import Logo from './Logo';
import { isAdminRole } from '@/lib/roles';

export default async function Header() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, role')
    .eq('id', user.id)
    .single();

  return (
    <header className="topbar">
      <Link href="/" className="brand">
        <Logo /> <span className="grad">Yozora</span>
      </Link>
      <nav>
        <Link href="/">Bosh sahifa</Link>
        <Link href="/favorites">Sevimlilar</Link>
        <Link href="/history">Ko‘rilganlar</Link>
        {isAdminRole(profile?.role) && <Link href="/admin">Admin</Link>}
      </nav>
      <div className="right">
        <span className="user">{profile?.username}</span>
        <form action={logout}>
          <button className="btn ghost sm">Chiqish</button>
        </form>
      </div>
    </header>
  );
}
