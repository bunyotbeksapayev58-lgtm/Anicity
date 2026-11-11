import Link from 'next/link';

export const metadata = {
  title: 'Foydalanish Shartlari',
  description: 'Anicity platformasidan foydalanish shartlari, foydalanuvchilar qoidalari va majburiyatlari.',
};

export default function TermsPage() {
  return (
    <div className="container" style={{ maxWidth: 920, margin: '40px auto 80px', padding: '0 20px' }}>
      <div className="card" style={{ padding: '40px 36px', background: 'rgba(16, 18, 27, 0.85)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <span style={{ fontSize: '32px' }}>📜</span>
          <div>
            <h1 style={{ fontSize: '30px', fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>
              Foydalanish Shartlari
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
              Oxirgi yangilanish: 2026-yil 11-noyabr • Versiya 2.1
            </p>
          </div>
        </div>

        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: '28px', fontSize: '15px' }}>
          Ushbu hujjat <strong>Anicity</strong> platformasi xizmatlaridan foydalanish bo‘yicha umumiy shartlar va qoidalarni belgilaydi. Saytdan foydalanish, ro‘yxatdan o‘tish yoki VIP obunani xarid qilish orqali siz ushbu shartlarga to‘liq va so‘zsiz rozilik bildirasiz.
        </p>

        <section style={{ marginBottom: '28px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '20px 0 10px', color: '#fff', borderLeft: '3px solid #8b5cf6', paddingLeft: '12px' }}>
            1. Xizmatdan foydalanish huquqi va shaxsiy maqsad
          </h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '12px' }}>
            Anicity foydalanuvchilarga faqat shaxsiy, notijoriy maqsadda anime kontentlarini 4K va Full HD sifatda tomosha qilish imkoniyatini taqdim etadi. Saytdagi materiallarni o‘zboshimchalik bilan yuklab olib, qayta sotish, tijoriy prokatga berish yoki ommaviy ko‘rsatuvlarda noqonuniy foydalanish taqiqlanadi.
          </p>
        </section>

        <section style={{ marginBottom: '28px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '20px 0 10px', color: '#fff', borderLeft: '3px solid #8b5cf6', paddingLeft: '12px' }}>
            2. Foydalanuvchi hisobi va xavfsizlik
          </h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '12px' }}>
            Foydalanuvchi o‘z hisobi, paroli va elektron pochtasining maxfiyligini saqlash uchun shaxsan javobgardir.
          </p>
          <ul style={{ color: 'var(--text-secondary)', paddingLeft: '24px', lineHeight: 1.8 }}>
            <li>Har qanday begona shaxsga akkaunt ma’lumotlarini ommaviy tarqatish qat’iyan man etiladi;</li>
            <li>Akkauntingizga begona shaxslar kirganini sezsangiz, darhol parolingizni o‘zgartiring va ma’muriyatga xabar bering;</li>
            <li>Bitta profil ostida cheksiz parallel seanslar ochish va akkauntni tijoriy tarzda ijaraga berish qoidabuzarlik hisoblanadi.</li>
          </ul>
        </section>

        <section style={{ marginBottom: '28px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '20px 0 10px', color: '#fff', borderLeft: '3px solid #8b5cf6', paddingLeft: '12px' }}>
            3. Qat’iy taqiqlar (Anti-abuse va xavfsizlik)
          </h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '12px' }}>
            Platformada quyidagi harakatlar qat’iyan man etiladi va aniqlangan taqdirda akkaunt ogohlantirishsiz bloklanadi:
          </p>
          <ul style={{ color: 'var(--text-secondary)', paddingLeft: '24px', lineHeight: 1.8 }}>
            <li>Avtomatlashtirilgan botlar, skreperlar yoki parserlar yordamida platforma bazasini va video havolalarini ruxsatsiz yig‘ish;</li>
            <li>Serverlarga sun’iy haddan tashqari yuklama berish (DDoS yoki DoS hujumlari);</li>
            <li>Pleyerning xavfsizlik tokenlarini buzish yoki chetlab o‘tishga urinish;</li>
            <li>Foydalanuvchilarning shaxsiy ma’lumotlarini o‘g‘irlashga qaratilgan harakatlar.</li>
          </ul>
        </section>

        <section style={{ marginBottom: '28px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '20px 0 10px', color: '#fff', borderLeft: '3px solid #8b5cf6', paddingLeft: '12px' }}>
            4. VIP Obuna va to‘lov shartlari
          </h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '12px' }}>
            VIP obuna foydalanuvchiga reklamasiz tomosha, 4K Ultra HD video sifati va tezkor yuklanish imkoniyatlarini taqdim etadi:
          </p>
          <ul style={{ color: 'var(--text-secondary)', paddingLeft: '24px', lineHeight: 1.8 }}>
            <li>To‘lovlar milliy Click va Payme to‘lov shlyuzlari orqali O‘zbekiston so‘mida amalga oshiriladi;</li>
            <li>Tariflar saytning <Link href="/premium" style={{ color: '#a78bfa' }}>VIP Tariflar</Link> bo‘limida shaffof ko‘rsatilgan;</li>
            <li>Obuna sotib olingandan so‘ng xizmat darhol faollashadi. Texnik nosozlik sabab xizmat taqdim etilmagan holatlarda mablag‘ qaytarilishi yoki obuna muddati uzaytirilishi kafolatlanadi.</li>
          </ul>
        </section>

        <section style={{ marginBottom: '28px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '20px 0 10px', color: '#fff', borderLeft: '3px solid #8b5cf6', paddingLeft: '12px' }}>
            5. Intellektual mulk va mualliflik huquqi (DMCA)
          </h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            Anicity mualliflik huquqlarini hurmat qiladi. Barcha video materiallar ochiq manbalar, tizerlar va litsenziyali ruxsatnomalar asosida taqdim etiladi. Agar siz mualliflik huquqi egasi bo‘lsangiz va kontent bo‘yicha e’tirozingiz bo‘lsa, bizning <Link href="/dmca" style={{ color: '#a78bfa', textDecoration: 'underline' }}>DMCA & Mualliflik Huquqi</Link> sahifamiz orqali murojaat qilishingiz mumkin.
          </p>
        </section>

        <section style={{ marginBottom: '28px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '20px 0 10px', color: '#fff', borderLeft: '3px solid #8b5cf6', paddingLeft: '12px' }}>
            6. Mas’uliyatni cheklash va xizmat barqarorligi
          </h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            Platforma doimiy 99.9% uptime barqarorligini ta’minlashga intiladi. Biroq, global internet provayderlaridagi uzilishlar, profilaktika ishlari yoki fors-major holatlari tufayli yuzaga keladigan vaqtinchalik uzilishlar uchun platforma to‘liq moddiy javobgarlikni o‘z zimmasiga olmaydi.
          </p>
        </section>

        <section style={{ marginBottom: '28px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '20px 0 10px', color: '#fff', borderLeft: '3px solid #8b5cf6', paddingLeft: '12px' }}>
            7. Nizolarni hal qilish va qonunchilik
          </h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            Ushbu shartlar O‘zbekiston Respublikasining amaldagi qonunchiligi bilan tartibga solinadi. Barcha kelib chiqadigan nizolar va tushunmovchiliklar muzokaralar va o‘zaro kelishuv yo‘li bilan hal etiladi.
          </p>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '20px 0 10px', color: '#fff', borderLeft: '3px solid #8b5cf6', paddingLeft: '12px' }}>
            8. Bog‘lanish
          </h2>
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '16px 20px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <p style={{ color: '#fff', margin: '4px 0' }}>💬 Telegram: <a href="https://t.me/anicity_admin" target="_blank" rel="noreferrer" style={{ color: '#a78bfa' }}>@anicity_admin</a></p>
            <p style={{ color: '#fff', margin: '4px 0' }}>📢 Rasmiy kanal: <a href="https://t.me/anicity_uz" target="_blank" rel="noreferrer" style={{ color: '#a78bfa' }}>@anicity_uz</a></p>
          </div>
        </section>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <Link href="/" className="btn primary sm">
            ← Bosh sahifaga qaytish
          </Link>
          <Link href="/privacy" className="btn secondary sm">
            Maxfiylik siyosati →
          </Link>
          <Link href="/cookies" className="btn secondary sm">
            Cookie siyosati →
          </Link>
        </div>
      </div>
    </div>
  );
}
