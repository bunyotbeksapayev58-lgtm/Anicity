import Link from 'next/link';
import AuthForm from '@/components/AuthForm';
import { login } from '@/app/actions/auth';
import Logo from '@/components/Logo';

export const metadata = { title: 'Kirish — Yozora' };

export default function LoginPage() {
  return (
    <section className="auth">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}><Logo size={46} /></div>
        <h1 className="grad">Yozora</h1>
        <p className="sub">Hisobingizga kiring</p>
        <AuthForm action={login} mode="login" />
        <p className="foot">Hisobingiz yo&apos;qmi? <Link href="/register">Ro&apos;yxatdan o&apos;ting</Link></p>
      </div>
    </section>
  );
}
