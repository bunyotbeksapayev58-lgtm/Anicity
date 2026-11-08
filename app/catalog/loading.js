// Ma'lumot yuklanayotganda skeleton (shimmer) ko'rsatiladi
export default function Loading() {
  return (
    <div>
      <div className="skel" style={{ height: 320, marginBottom: 24, borderRadius: 20 }} />
      <div className="grid">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="skel" style={{ aspectRatio: '2/3' }} />
        ))}
      </div>
    </div>
  );
}
