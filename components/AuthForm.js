'use client';
import { useActionState, useState } from 'react';

export default function AuthForm({ action, mode, next }) {
  const [state, formAction, pending] = useActionState(action, null);
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState({});
  const [clientErrors, setClientErrors] = useState({});
  const isRegister = mode === 'register';

  const validateField = (name, value) => {
    let err = '';
    const trimmed = String(value || '').trim();

    if (name === 'email') {
      if (!trimmed) {
        err = 'Email manzilini kiritish shart';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        err = 'To‘g‘ri formatdagi email manzil kiriting (masalan: user@gmail.com)';
      }
    } else if (name === 'username') {
      if (!trimmed) {
        err = 'Username kiritish shart';
      } else if (trimmed.length < 3 || trimmed.length > 20) {
        err = 'Username 3 tadan 20 tagacha belgi bo‘lishi lozim';
      } else if (!/^[A-Za-z0-9_]+$/.test(trimmed)) {
        err = 'Faqat lotin harflari, raqamlar va _ belgisi mumkin';
      }
    } else if (name === 'password') {
      if (!value) {
        err = 'Parol kiritish shart';
      } else if (value.length < 8) {
        err = 'Parol kamida 8 ta belgidan iborat bo‘lishi lozim';
      }
    }

    setClientErrors((prev) => ({ ...prev, [name]: err }));
    return !err;
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    validateField(name, value);
  };

  return (
    <form action={formAction} className="auth-form-pro">
      <input type="hidden" name="next" value={next || ''} />

      {isRegister && (
        <div className="field">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            name="username"
            required
            minLength={3}
            maxLength={20}
            pattern="[A-Za-z0-9_]{3,20}"
            placeholder="masalan: animefan123"
            autoComplete="username"
            onBlur={handleBlur}
            className={touched.username && clientErrors.username ? 'input-error' : ''}
          />
          {touched.username && clientErrors.username && (
            <span className="field-hint-error">{clientErrors.username}</span>
          )}
        </div>
      )}

      {isRegister ? (
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="masalan: user@gmail.com"
            onBlur={handleBlur}
            className={touched.email && clientErrors.email ? 'input-error' : ''}
          />
          {touched.email && clientErrors.email && (
            <span className="field-hint-error">{clientErrors.email}</span>
          )}
        </div>
      ) : (
        <div className="field">
          <label htmlFor="login">Email yoki Username</label>
          <input
            id="login"
            name="login"
            required
            autoComplete="username"
            placeholder="Email (tavsiya) yoki username"
            onBlur={handleBlur}
          />
          <small style={{ color: 'var(--muted)', fontSize: 12, marginTop: 4, display: 'block' }}>
            💡 Tizimga emailingiz orqali to‘g‘ridan-to‘g‘ri kirishingiz mumkin.
          </small>
        </div>
      )}

      <div className="field">
        <label htmlFor="password">Parol</label>
        <div className="password-input-wrap">
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            required
            minLength={8}
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            onBlur={handleBlur}
            className={touched.password && clientErrors.password ? 'input-error' : ''}
          />
          <button
            type="button"
            className="password-toggle-btn"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
            title={showPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
          >
            {showPassword ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
        {touched.password && clientErrors.password && (
          <span className="field-hint-error">{clientErrors.password}</span>
        )}
      </div>

      <button className="btn btn-auth-submit" style={{ width: '100%' }} disabled={pending}>
        {pending ? (
          <>
            <svg className="btn-spinner-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
              <path d="M12 2a10 10 0 0 1 10 10" />
            </svg>
            <span>Kuting...</span>
          </>
        ) : (
          <span>{isRegister ? 'Ro‘yxatdan o‘tish' : 'Kirish'}</span>
        )}
      </button>

      {state?.error && <div className="err">{state.error}</div>}
      {state?.message && <div className="ok">{state.message}</div>}
    </form>
  );
}
