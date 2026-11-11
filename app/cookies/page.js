import Link from 'next/link';

export const metadata = {
  title: 'Cookie Siyosati',
  description: 'Anicity platformasida cookie (fayllar)dan foydalanish siyosati va foydalanuvchi roziligi qoidalari.',
};

export default function CookiesPage() {
  return (
    <div className="container" style={{ maxWidth: 920, margin: '40px auto 80px', padding: '0 20px' }}>
      <div className="card" style={{ padding: '40px 36px', background: 'rgba(16, 18, 27, 0.85)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <span style={{ fontSize: '32px' }}>🍪</span>
          <div>
            <h1 style={{ fontSize: '30px', fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>
              Cookie Siyosati
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
              Oxirgi yangilanish: 2026-yil 11-noyabr • Versiya 2.1
            </p>
          </div>
        </div>

        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: '28px', fontSize: '15px' }}>
          Ushbu Cookie Siyosati <strong>Anicity</strong> platformasida sizning qurilmangizga saqlanadigan cookie (fayllar) va o‘xshash texnologiyalardan (masalan, brauzer LocalStorage) qanday foydalanishimizni batafsil tushuntiradi.
        </p>

        <section style={{ marginBottom: '28px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '20px 0 10px', color: '#fff', borderLeft: '3px solid #8b5cf6', paddingLeft: '12px' }}>
            1. Cookie nima?
          </h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            Cookie — bu siz biror veb-saytga tashrif buyurganingizda brauzeringiz orqali qurilmangizga (kompyuter, planshet yoki smartfon) yuklanadigan kichik matnli ma’lumotlar faylidir. Ular saytning to‘g‘ri ishlashi, sizning seansingizni eslab qolishi va saytdan foydalanish qulayligini ta’minlash uchun xizmat qiladi.
          </p>
        </section>

        <section style={{ marginBottom: '28px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '20px 0 10px', color: '#fff', borderLeft: '3px solid #8b5cf6', paddingLeft: '12px' }}>
            2. Anicity qanday cookie turlaridan foydalanadi?
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '16px 20px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <h3 style={{ fontSize: '17px', color: '#fff', fontWeight: 700, marginBottom: '6px' }}>
                🟢 1. Qat’iy Zaruriy Cookie fayllari (Strictly Necessary)
              </h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '14px' }}>
                Bu fayllar platformaning asosiy funksiyalari ishlashi uchun shart. Masalan: xavfsiz tizimga kirish (Supabase Auth tokenlari), foydalanuvchi avtorizatsiyasi, sahifalar o‘rtasida xavfsiz o‘tish va CSRF xurujlaridan himoyalanish. Bularsiz saytdan foydalanib bo‘lmaydi.
              </p>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '16px 20px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <h3 style={{ fontSize: '17px', color: '#fff', fontWeight: 700, marginBottom: '6px' }}>
                🟣 2. Funksional va Shaxsiy Sozlamalar Cookie fayllari
              </h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '14px' }}>
                Bu fayllar siz tanlagan sozlamalarni eslab qoladi: video pleyer ovoz darajasi, oxirgi tanlangan sifat (4K / 1080p), subtitr parametrlari va interfeys tili.
              </p>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '16px 20px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <h3 style={{ fontSize: '17px', color: '#fff', fontWeight: 700, marginBottom: '6px' }}>
                🔵 3. Analitika va Statistika Cookie fayllari (Google Analytics 4 & GTM)
              </h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '14px' }}>
                Bu fayllar saytga tashrif buyuruvchilar soni, qaysi sahifalar ommabopligi va sayt qanday tezlikda yuklanayotganini anonim tarzda tahlil qilishga yordam beradi. Ular shaxsiy shaxsingizni aniqlamaydi va faqat umumiy agregat statistikani shakllantiradi.
              </p>
            </div>
          </div>
        </section>

        <section style={{ marginBottom: '28px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '20px 0 10px', color: '#fff', borderLeft: '3px solid #8b5cf6', paddingLeft: '12px' }}>
            3. Cookie fayllarini qanday boshqarish va o‘chirish mumkin?
          </h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '12px' }}>
            Siz har doim brauzeringiz sozlamalari orqali cookie fayllarini to‘liq tozalashingiz yoki ularni bloklashingiz mumkin:
          </p>
          <ul style={{ color: 'var(--text-secondary)', paddingLeft: '24px', lineHeight: 1.8 }}>
            <li><strong>Google Chrome:</strong> Sozlamalar → Maxfiylik va xavfsizlik → Cookie fayllari va boshqa sayt ma’lumotlari;</li>
            <li><strong>Mozilla Firefox:</strong> Sozlamalar → Maxfiylik va himoya → Cookie va sayt ma’lumotlari;</li>
            <li><strong>Apple Safari:</strong> Sozlamalar → Maxfiylik → Barcha cookie fayllarini bloklash yoki tozalash;</li>
            <li><strong>Microsoft Edge:</strong> Sozlamalar → Cookie fayllari va sayt ruxsatlari.</li>
          </ul>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginTop: '12px' }}>
            <em>Eslatma: Qat’iy zaruriy cookie fayllarini to‘liq o‘chirib qo‘ysangiz, saytga kirish yoki avtorizatsiyadan o‘tish funksiyasi cheklanishi mumkin.</em>
          </p>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '20px 0 10px', color: '#fff', borderLeft: '3px solid #8b5cf6', paddingLeft: '12px' }}>
            4. Savollar va bog‘lanish
          </h2>
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '16px 20px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <p style={{ color: '#fff', margin: '4px 0' }}>💬 Telegram Yordam: <a href="https://t.me/anicity_admin" target="_blank" rel="noreferrer" style={{ color: '#a78bfa' }}>@anicity_admin</a></p>
          </div>
        </section>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <Link href="/" className="btn primary sm">
            ← Bosh sahifaga qaytish
          </Link>
          <Link href="/privacy" className="btn secondary sm">
            Maxfiylik siyosati →
          </Link>
          <Link href="/terms" className="btn secondary sm">
            Foydalanish shartlari →
          </Link>
        </div>
      </div>
    </div>
  );
}
