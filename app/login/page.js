import Link from 'next/link';
import AuthForm from '@/components/AuthForm';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import { login } from '@/app/actions/auth';
import Logo from '@/components/Logo';

export const metadata = { title: 'Kirish — Anicity' };

export default async function LoginPage({ searchParams }) {
  const { next, error } = (await searchParams) || {};
  const isWatchRedirect = next && next.startsWith('/watch');

  return (
    <section className="auth">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}><Logo size={46} /></div>
        <h1 className="grad">Anicity</h1>
        <p className="sub">Hisobingizga kiring</p>

        {isWatchRedirect && (
          <div style={{
            padding: '12px 14px',
            borderRadius: 12,
            background: 'rgba(124, 92, 255, 0.15)',
            border: '1px solid rgba(124, 92, 255, 0.4)',
            color: '#ffffff',
            marginBottom: 16,
            fontSize: 14,
            lineHeight: 1.4,
            textAlign: 'center',
          }}>
            🎬 <b>Filmni tomosha qilish uchun hisobingizga kiring yoki ro‘yxatdan o‘ting.</b>
          </div>
        )}

        {error === 'link' && (
          <div className="err" style={{ marginBottom: 16, textAlign: 'center' }}>
            Havola muddati tugagan yoki noto‘g‘ri. Iltimos, qaytadan urinib ko‘ring.
          </div>
        )}

        <GoogleSignInButton next={next} label="Google bilan kirish" />

        <div style={{ display: 'flex', alignItems: 'center', margin: '18px 0', gap: 12, color: 'var(--muted)', fontSize: 13 }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span>yoki email bilan</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        <AuthForm action={login} mode="login" next={next} />
        <p className="foot">
          Hisobingiz yo&apos;qmi?{' '}
          <Link href={`/register${next ? `?next=${encodeURIComponent(next)}` : ''}`}>
            Ro&apos;yxatdan o&apos;ting
          </Link>
        </p>
      </div>
    </section>
  );
}
