import Link from 'next/link';
import AuthForm from '@/components/AuthForm';
import { register } from '@/app/actions/auth';
import Logo from '@/components/Logo';

export const metadata = { title: "Ro'yxatdan o'tish — Yozora" };

export default function RegisterPage() {
  return (
    <section className="auth">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}><Logo size={46} /></div>
        <h1 className="grad">Yozora</h1>
        <p className="sub">Yangi hisob yarating</p>
        <AuthForm action={register} mode="register" />
        <p className="foot">Hisobingiz bormi? <Link href="/login">Kiring</Link></p>
      </div>
    </section>
  );
}
