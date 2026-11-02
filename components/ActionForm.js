'use client';
import { useActionState } from 'react';

// Umumiy forma: fields = [{ name, label, type, autoComplete, minLength }]
export default function ActionForm({ action, fields, submitLabel }) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction}>
      {fields.map((f) => (
        <div className="field" key={f.name}>
          <label htmlFor={f.name}>{f.label}</label>
          <input id={f.name} name={f.name} type={f.type || 'text'} required
            autoComplete={f.autoComplete} minLength={f.minLength} />
        </div>
      ))}
      <button className="btn" style={{ width: '100%' }} disabled={pending}>
        {pending ? 'Kuting...' : submitLabel}
      </button>
      {state?.error && <div className="err">{state.error}</div>}
      {state?.message && <div className="ok">{state.message}</div>}
    </form>
  );
}
