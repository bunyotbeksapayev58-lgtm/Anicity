import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { logout } from '@/app/actions/auth';
import Logo from './Logo';
import { isAdminRole } from '@/lib/roles';

export default async function Header() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from('profiles').select('username, role').eq('id', user.id).single()
    : { data: null };

  return (
    <header className="topbar">
      <Link href="/" className="brand">
        <Logo /> <span className="grad">Yozora</span>
      </Link>
      <nav>
        <Link href="/">Bosh sahifa</Link>
        {user && (
          <>
            <Link href="/favorites">Sevimlilar</Link>
            <Link href="/history">Ko‘rilganlar</Link>
          </>
        )}
        {isAdminRole(profile?.role) && <Link href="/admin">Admin</Link>}
      </nav>
      <div className="right">
        {user ? (
          <>
            <span className="user">{profile?.username || user.email}</span>
            <form action={logout}>
              <button className="btn ghost sm">Chiqish</button>
            </form>
          </>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href="/login" className="btn ghost sm">Kirish</Link>
            <Link href="/register" className="btn sm">Ro‘yxatdan o‘tish</Link>
          </div>
        )}
      </div>
    </header>
  );
}
