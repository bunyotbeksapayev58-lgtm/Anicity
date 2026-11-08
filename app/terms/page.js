import Link from 'next/link';

export const metadata = {
  title: 'Foydalanish Shartlari — Anicity',
  description: 'Anicity platformasidan foydalanish shartlari va qoidalari.',
};

export default function TermsPage() {
  return (
    <div className="container" style={{ maxWidth: 860, margin: '40px auto 80px', padding: '0 20px' }}>
      <div className="card" style={{ padding: '36px 32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '16px', color: '#fff' }}>
          📜 Foydalanish Shartlari
        </h1>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '24px' }}>
          Ushbu foydalanish shartlari <strong>Anicity</strong> platformasidan foydalanish qoidalarini belgilaydi. Saytdan foydalanish orqali siz quyidagi shartlarga to‘liq rozilik bildirasiz.
        </p>

        <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '24px 0 12px', color: '#fff' }}>
          1. Xizmatdan foydalanish huquqi
        </h2>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '16px' }}>
          Platforma foydalanuvchilarga shaxsiy, notijoriy maqsadda anime kontentlarini tomosha qilish imkonini beradi. Har qanday materialni noqonuniy ko‘chirish, o‘zgartirish yoki tijoriy maqsadlarda tarqatish qat’iyan taqiqlanadi.
        </p>

        <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '24px 0 12px', color: '#fff' }}>
          2. Foydalanuvchi hisobi va xavfsizlik
        </h2>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '16px' }}>
          Ro‘yxatdan o‘tgan foydalanuvchilar o‘z akkaunti xavfsizligi va parolini sir saqlash uchun shaxsan javobgardir. Har qanday zararli harakatlar, botlar yoki platforma ishiga xalaqit berishga urinishlar hisobni darhol bloklanishiga olib keladi.
        </p>

        <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '24px 0 12px', color: '#fff' }}>
          3. VIP Obuna va Xizmatlar
        </h2>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '16px' }}>
          VIP obuna foydalanuvchilarga reklamasiz tomosha, yuqori tezlik va qo‘shimcha imkoniyatlarni taqdim etadi. Obuna to‘lovlari va muddatlari belgilangan tarif rejalari asosida amalga oshiriladi.
        </p>

        <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '24px 0 12px', color: '#fff' }}>
          4. Mas’uliyatni cheklash
        </h2>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '24px' }}>
          Anicity platformasi uchinchi tomon serverlarida joylashgan videolarning to‘xtovsiz ishlashiga to‘liq kafolat bermaydi, ammo eng yuqori sifat va barqarorlikni ta’minlashga intiladi.
        </p>

        <Link href="/" className="btn primary sm">
          ← Bosh sahifaga qaytish
        </Link>
      </div>
    </div>
  );
}
