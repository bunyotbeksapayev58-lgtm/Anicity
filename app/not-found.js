import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="empty">
      <h1 className="grad" style={{ fontSize: 48 }}>404</h1>
      <p style={{ margin: '10px 0 20px' }}>Sahifa topilmadi</p>
      <Link className="btn" href="/">Bosh sahifa</Link>
    </div>
  );
}
