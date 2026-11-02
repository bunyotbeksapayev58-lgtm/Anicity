import Link from 'next/link';
import ActionForm from '@/components/ActionForm';
import Logo from '@/components/Logo';
import { forgotPassword } from '@/app/actions/auth';

export const metadata = { title: 'Parolni tiklash — Yozora' };

export default function ForgotPage() {
  return (
    <section className="auth">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}><Logo size={46} /></div>
        <h1 className="grad">Parolni tiklash</h1>
        <p className="sub">Emailingizga tiklash havolasi yuboramiz</p>
        <ActionForm action={forgotPassword} submitLabel="Havola yuborish"
          fields={[{ name: 'email', label: 'Email', type: 'email', autoComplete: 'email' }]} />
        <p className="foot"><Link href="/login">Kirish sahifasiga qaytish</Link></p>
      </div>
    </section>
  );
}
