import Link from 'next/link';
import AuthForm from '@/components/AuthForm';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import { register } from '@/app/actions/auth';
import Logo from '@/components/Logo';

export const metadata = { title: "Ro'yxatdan o'tish — Anicity" };

export default async function RegisterPage({ searchParams }) {
  const { next } = (await searchParams) || {};

  return (
    <section className="auth">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}><Logo size={46} /></div>
        <h1 className="grad">Anicity</h1>
        <p className="sub">Yangi hisob yarating</p>

        <GoogleSignInButton next={next} label="Google orqali ro‘yxatdan o‘tish" />

        <div style={{ display: 'flex', alignItems: 'center', margin: '18px 0', gap: 12, color: 'var(--muted)', fontSize: 13 }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span>yoki email bilan</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        <AuthForm action={register} mode="register" next={next} />
        <p className="foot">
          Hisobingiz bormi?{' '}
          <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`}>
            Kiring
          </Link>
        </p>
      </div>
    </section>
  );
}
