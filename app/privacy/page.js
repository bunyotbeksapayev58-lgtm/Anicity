import Link from 'next/link';

export const metadata = {
  title: 'Maxfiylik Siyosati — Anicity',
  description: 'Anicity platformasida foydalanuvchilar shaxsiy ma’lumotlarini himoya qilish siyosati.',
};

export default function PrivacyPage() {
  return (
    <div className="container" style={{ maxWidth: 860, margin: '40px auto 80px', padding: '0 20px' }}>
      <div className="card" style={{ padding: '36px 32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '16px', color: '#fff' }}>
          🛡️ Maxfiylik Siyosati
        </h1>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '24px' }}>
          <strong>Anicity</strong> platformasi foydalanuvchilarining shaxsiy ma’lumotlari va maxfiyligini qat’iy himoya qiladi. Ushbu sahifa sizning ma’lumotlaringiz qanday to‘planishi va ishlatilishini tushuntiradi.
        </p>

        <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '24px 0 12px', color: '#fff' }}>
          1. Qanday ma’lumotlar to‘planadi?
        </h2>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '16px' }}>
          Ro‘yxatdan o‘tish va xizmatdan foydalanish jarayonida biz faqat zaruriy ma’lumotlarni qabul qilamiz: elektron pochta manzili, foydalanuvchi nomi, ko‘rish tarixi va obuna holati.
        </p>

        <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '24px 0 12px', color: '#fff' }}>
          2. Ma’lumotlar qanday himoyalanadi?
        </h2>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '16px' }}>
          Barcha shaxsiy ma’lumotlar zamonaviy shifrlash protokollari (SSL/TLS) hamda xavfsiz Supabase ma’lumotlar bazasi orqali himoyalanadi. Parollar hech qachon ochiq ko‘rinishda saqlanmaydi (bcrypt orqali xeshlangan).
        </p>

        <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '24px 0 12px', color: '#fff' }}>
          3. Uchinchi shaxslarga bermaslik kafolati
        </h2>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '24px' }}>
          Biz foydalanuvchilarning shaxsiy ma’lumotlarini hech qachon begona shaxslarga sotmaymiz va marketing maqsadlarida bermaymiz.
        </p>

        <Link href="/" className="btn primary sm">
          ← Bosh sahifaga qaytish
        </Link>
      </div>
    </div>
  );
}
