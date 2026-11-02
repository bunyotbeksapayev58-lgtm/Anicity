'use client';

export default function ErrorPage({ error, reset }) {
  return (
    <div className="empty">
      <h2 style={{ marginBottom: 8 }}>Xatolik yuz berdi</h2>
      <p className="muted" style={{ marginBottom: 20 }}>{error?.message}</p>
      <button className="btn" onClick={() => reset()}>Qayta urinish</button>
    </div>
  );
}
