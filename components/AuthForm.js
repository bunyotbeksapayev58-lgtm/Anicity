'use client';
import { useActionState } from 'react';

export default function AuthForm({ action, mode, next }) {
  const [state, formAction, pending] = useActionState(action, null);
  const isRegister = mode === 'register';

  return (
    <form action={formAction}>
      <input type="hidden" name="next" value={next || ''} />
      {isRegister && (
        <div className="field">
          <label htmlFor="username">Username</label>
          <input id="username" name="username" required minLength={3} maxLength={20}
            pattern="[A-Za-z0-9_]{3,20}" placeholder="masalan: animefan123" autoComplete="username" />
        </div>
      )}
      {isRegister ? (
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" placeholder="masalan: user@gmail.com" />
        </div>
      ) : (
        <div className="field">
          <label htmlFor="login">Email yoki Username</label>
          <input id="login" name="login" required autoComplete="username" placeholder="Email (tavsiya) yoki username" />
          <small style={{ color: 'var(--muted)', fontSize: 12, marginTop: 4, display: 'block' }}>
            💡 Tizimga emailingiz orqali to‘g‘ridan-to‘g‘ri kirishingiz mumkin.
          </small>
        </div>
      )}
      <div className="field">
        <label htmlFor="password">Parol</label>
        <input id="password" name="password" type="password" required minLength={6}
          autoComplete={isRegister ? 'new-password' : 'current-password'} />
      </div>
      <button className="btn" style={{ width: '100%' }} disabled={pending}>
        {pending ? 'Kuting...' : isRegister ? 'Ro‘yxatdan o‘tish' : 'Kirish'}
      </button>
      {state?.error && <div className="err">{state.error}</div>}
      {state?.message && <div className="ok">{state.message}</div>}
    </form>
  );
}
