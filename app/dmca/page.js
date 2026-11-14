import Link from 'next/link';
import { siteConfig } from '@/lib/siteConfig';

export const metadata = {
  title: 'DMCA va Mualliflik Huquqi — Anicity',
  description: 'Anicity platformasida raqamli mualliflik huquqlarini himoya qilish (DMCA) va kontent siyosati.',
};

export default function DmcaPage() {
  return (
    <div className="container" style={{ maxWidth: 860, margin: '40px auto 80px', padding: '0 20px' }}>
      <div className="card" style={{ padding: '36px 32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '16px', color: '#fff' }}>
          ⚖️ DMCA & Mualliflik Huquqi Siyosati
        </h1>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '24px' }}>
          <strong>Anicity</strong> platformasi mualliflik huquqi va intellektual mulk egalarining qonuniy huquqlarini to‘liq hurmat qiladi hamda Raqamli Mualliflik Huquqi To‘g‘risidagi Qonun (DMCA) talablariga rioya etadi.
        </p>

        <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '24px 0 12px', color: '#fff' }}>
          1. Kontent va Media Manbalari
        </h2>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '16px' }}>
          Anicity platformasida joylashtirilgan video kontentlar va tizerlar ommaviy foydalanish uchun ochiq manbalar, tarmoq foydalanuvchilari hamda havaskor fan-dublyaj jamoalari tomonidan taqdim etilgan materiallardir. Sayt ma’muriyati o‘z serverlarida noqonuniy fayllarni saqlamaydi va faqat havolalarni indekslaydi.
        </p>

        <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '24px 0 12px', color: '#fff' }}>
          2. Huquqbuzarlik haqida xabar berish
        </h2>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '16px' }}>
          Agar siz mualliflik huquqi egasi yoki uning qonuniy vakili bo‘lsangiz va platformadagi biron-bir material sizning huquqlaringizni buzayotgan deb hisoblasangiz, iltimos, zudlik bilan biz bilan bog‘laning.
        </p>
        <ul style={{ color: 'var(--text-secondary)', lineHeight: 1.7, paddingLeft: '24px', marginBottom: '24px' }}>
          <li>Mualliflik huquqi buzilgan asarning aniq nomi va tavsifi;</li>
          <li>Saytimizdagi qoidabuzarlik joylashgan aniq sahifa havolasi (URL);</li>
          <li>Sizning huquq egasi ekanligingizni tasdiqlovchi rasmiy hujjatlar nusxasi;</li>
          <li>Siz bilan bog‘lanish uchun aloqa ma’lumotlari (ism, telefon raqam yoki Telegram).</li>
        </ul>

        <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '24px 0 12px', color: '#fff' }}>
          3. Murojaat muddati va chora ko‘rish
        </h2>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '24px' }}>
          Asoslangan murojaat kelib tushgandan so‘ng, ma’muriyat uni <strong>24–48 soat</strong> ichida ko‘rib chiqadi va ko‘rsatilgan material platformadan darhol olib tashlanadi.
        </p>

        <div style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ fontWeight: 700, color: '#fff' }}>Rasmiy aloqa kanali:</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Telegram: {siteConfig.telegramAdminHandle}</div>
          </div>
          <a href={siteConfig.telegramAdminUrl} target="_blank" rel="noreferrer" className="btn primary sm">
            Telegram orqali bog‘lanish
          </a>
        </div>
      </div>
    </div>
  );
}
