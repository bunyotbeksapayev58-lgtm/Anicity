import Link from 'next/link';

export const metadata = {
  title: 'Maxfiylik Siyosati',
  description: 'Anicity platformasida foydalanuvchilar shaxsiy ma’lumotlarini himoya qilish siyosati va xavfsizlik standartlari.',
};

export default function PrivacyPage() {
  return (
    <div className="container" style={{ maxWidth: 920, margin: '40px auto 80px', padding: '0 20px' }}>
      <div className="card" style={{ padding: '40px 36px', background: 'rgba(16, 18, 27, 0.85)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <span style={{ fontSize: '32px' }}>🛡️</span>
          <div>
            <h1 style={{ fontSize: '30px', fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>
              Maxfiylik Siyosati
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
              Oxirgi yangilanish: 2026-yil 11-noyabr • Versiya 2.1
            </p>
          </div>
        </div>

        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: '28px', fontSize: '15px' }}>
          Ushbu Maxfiylik Siyosati <strong>Anicity</strong> (keyingi o‘rinlarda «Platforma» yoki «Biz») xizmatlaridan foydalanganda shaxsiy ma’lumotlaringiz qanday to‘planishi, ishlatilishi, saqlanishi va himoyalanishini belgilaydi. Biz O‘zbekiston Respublikasining <em>«Shaxsga doir ma’lumotlar to‘g‘risida»</em>gi Qonuni (O‘RQ-547) va xalqaro xavfsizlik (GDPR) tamoyillariga qat’iy amal qilamiz.
        </p>

        <section style={{ marginBottom: '28px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '20px 0 10px', color: '#fff', borderLeft: '3px solid #8b5cf6', paddingLeft: '12px' }}>
            1. Qanday ma’lumotlarni to‘playmiz?
          </h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '12px' }}>
            Biz faqatgina xizmatni to‘liq va sifatli taqdim etish uchun zarur bo‘lgan minimal miqdordagi ma’lumotlarni to‘playmiz:
          </p>
          <ul style={{ color: 'var(--text-secondary)', paddingLeft: '24px', lineHeight: 1.8 }}>
            <li><strong>Akkaunt ma’lumotlari:</strong> Elektron pochta manzili, foydalanuvchi nomi (display name), profil rasmi (avatar).</li>
            <li><strong>Xizmat ko‘rsatish tarixi:</strong> Ko‘rilgan anime qismlari, tomosha davomiyligi (video progress), sevimlilar ro‘yxati va obuna holati.</li>
            <li><strong>Texnik loglar va qurilma ma’lumotlari:</strong> IP manzil, brauzer turi, operatsion tizim va xizmatga kirish vaqtlari (xavfsizlik va DDOS hujumlaridan himoyalanish uchun).</li>
          </ul>
        </section>

        <section style={{ marginBottom: '28px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '20px 0 10px', color: '#fff', borderLeft: '3px solid #8b5cf6', paddingLeft: '12px' }}>
            2. To‘lov ma’lumotlari xavfsizligi (Click va Payme)
          </h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '12px' }}>
            Anicity platformasi foydalanuvchilarning bank kartasi to‘liq raqamlari, amal qilish muddatlari yoki CVV/CVC maxfiy kodlarini <strong>hech qachon o‘z serverlarida saqlamaydi va qabul qilmaydi</strong>.
          </p>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            Barcha VIP obuna to‘lovlari litsenziyaga ega milliy to‘lov tizimlari (Click va Payme) rasmiy xavfsiz shlyuzlari (PCI DSS standartlari) orqali to‘g‘ridan-to‘g‘ri shifrlangan kanal orqali amalga oshiriladi. Biz faqat to‘lov muvaffaqiyatli o‘tganligi haqidagi tranzaksiya identifikatorini qabul qilamiz.
          </p>
        </section>

        <section style={{ marginBottom: '28px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '20px 0 10px', color: '#fff', borderLeft: '3px solid #8b5cf6', paddingLeft: '12px' }}>
            3. Ma’lumotlarni saqlash va shifrlash choralari
          </h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '12px' }}>
            Foydalanuvchilar ma’lumotlarining xavfsizligi bizning eng ustuvor vazifamizdir:
          </p>
          <ul style={{ color: 'var(--text-secondary)', paddingLeft: '24px', lineHeight: 1.8 }}>
            <li>Barcha tarmoq almashinuvi zamonaviy <strong>SSL/TLS 256-bit</strong> shifrlash protokoli orqali amalga oshiriladi.</li>
            <li>Foydalanuvchi parollari bazada ochiq ko‘rinishda emas, balki qaytarib bo‘lmas <strong>bcrypt</strong> kriptografik xeshlari ko‘rinishida saqlanadi.</li>
            <li>Ma’lumotlar bazasi darajasida <strong>Row-Level Security (RLS)</strong> protokollari joriy etilgan bo‘lib, har bir foydalanuvchi faqat o‘ziga tegishli ma’lumotlarni ko‘ra oladi.</li>
          </ul>
        </section>

        <section style={{ marginBottom: '28px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '20px 0 10px', color: '#fff', borderLeft: '3px solid #8b5cf6', paddingLeft: '12px' }}>
            4. Cookie fayllari va kuzatuv texnologiyalari
          </h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '12px' }}>
            Biz platforma xavfsizligini ta’minlash, foydalanuvchi seansini saqlab turish va video pleyer sozlamalarini (ovoz balandligi, pleyer sifati) eslab qolish uchun texnik zaruriy cookie fayllaridan foydalanamiz. Batafsil ma’lumotni bizning alohida <Link href="/cookies" style={{ color: '#a78bfa', textDecoration: 'underline' }}>Cookie Siyosati</Link> sahifamizdan olishingiz mumkin.
          </p>
        </section>

        <section style={{ marginBottom: '28px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '20px 0 10px', color: '#fff', borderLeft: '3px solid #8b5cf6', paddingLeft: '12px' }}>
            5. Uchinchi shaxslarga bermaslik kafolati
          </h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            Biz sizning shaxsiy ma’lumotlaringizni hech qachon begona uchinchi shaxslarga, reklama agentliklariga yoki spamerlarga <strong>sotmaymiz, ijaraga bermaymiz va tarqatmaymiz</strong>. Ma’lumotlar faqatgina qonuniy asosda va vakolatli sud yoki davlat organlarining rasmiy talabnomasi bo‘lgandagina taqdim etilishi mumkin.
          </p>
        </section>

        <section style={{ marginBottom: '28px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '20px 0 10px', color: '#fff', borderLeft: '3px solid #8b5cf6', paddingLeft: '12px' }}>
            6. Foydalanuvchi huquqlari (Ma’lumotlarni o‘chirish huquqi)
          </h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '12px' }}>
            Har bir foydalanuvchi o‘z ma’lumotlari ustidan to‘liq nazoratga ega:
          </p>
          <ul style={{ color: 'var(--text-secondary)', paddingLeft: '24px', lineHeight: 1.8 }}>
            <li>O‘z shaxsiy profilini, ismini va rasmini istalgan paytda tahrirlash;</li>
            <li>Tomosha tarixini tozalash;</li>
            <li>O‘z akkauntini va unga bog‘liq barcha ma’lumotlarni butunlay o‘chirib tashlashni («Right to be forgotten») talab qilish. Buning uchun qo‘llab-quvvatlash xizmatiga murojaat qilish kifoya.</li>
          </ul>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '20px 0 10px', color: '#fff', borderLeft: '3px solid #8b5cf6', paddingLeft: '12px' }}>
            7. Bog‘lanish va qo‘llab-quvvatlash
          </h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '16px' }}>
            Maxfiylik siyosati yoki shaxsiy ma’lumotlaringiz xavfsizligi bo‘yicha savollaringiz bo‘lsa, rasmiy qo‘llab-quvvatlash xizmatimizga murojaat qiling:
          </p>
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '16px 20px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <p style={{ color: '#fff', margin: '4px 0' }}>💬 Telegram: <a href="https://t.me/anicity_admin" target="_blank" rel="noreferrer" style={{ color: '#a78bfa' }}>@anicity_admin</a></p>
            <p style={{ color: '#fff', margin: '4px 0' }}>📢 Rasmiy kanal: <a href="https://t.me/anicity_uz" target="_blank" rel="noreferrer" style={{ color: '#a78bfa' }}>@anicity_uz</a></p>
          </div>
        </section>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <Link href="/" className="btn primary sm">
            ← Bosh sahifaga qaytish
          </Link>
          <Link href="/terms" className="btn secondary sm">
            Foydalanish shartlari →
          </Link>
          <Link href="/cookies" className="btn secondary sm">
            Cookie siyosati →
          </Link>
        </div>
      </div>
    </div>
  );
}
