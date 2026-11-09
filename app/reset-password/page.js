import ActionForm from '@/components/ActionForm';
import Logo from '@/components/Logo';
import { resetPassword } from '@/app/actions/auth';

export const metadata = { title: 'Yangi parol — Anicity' };

export default function ResetPage() {
  return (
    <section className="auth">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}><Logo size={46} /></div>
        <h1 className="grad">Yangi parol</h1>
        <p className="sub">Yangi parolni kiriting</p>
        <ActionForm action={resetPassword} submitLabel="Parolni saqlash"
          fields={[
            { name: 'password', label: 'Yangi parol', type: 'password', autoComplete: 'new-password', minLength: 8 },
            { name: 'confirm', label: 'Parolni tasdiqlang', type: 'password', autoComplete: 'new-password', minLength: 8 },
          ]} />
      </div>
    </section>
  );
}
