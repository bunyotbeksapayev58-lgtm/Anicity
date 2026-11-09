# AniCity — Yangi Egasi Uchun Qo‘llanma (Handover Guide)

Assalomu alaykum! Ushbu qo‘llanma **AniCity** platformasini yangi serverga o‘rnatish, ma’lumotlar bazasini sozlash va to‘lov tizimlarini ulash bo‘yicha amaliy qadamlarni o‘z ichiga oladi.

Loyiha zamonaviy stekda qurilgan: **Next.js 16 (App Router)**, **React 19**, **Supabase (PostgreSQL + Auth)** va **Vercel**.

---

## 1. Talab qilinadigan narsalar

Loyihani to‘liq o‘zingizning nomingizda ishga tushirish uchun quyidagilar kerak bo‘ladi:
1. **GitHub hisob** — kodni o‘zingizning shaxsiy yoki tashkilot repozitoriyingizga saqlash uchun.
2. **Supabase hisob** (bepul yoki Pro) — ma’lumotlar bazasi va foydalanuvchilar autentifikatsiyasi uchun ([supabase.com](https://supabase.com)).
3. **Vercel hisob** (bepul yoki Pro) — veb-saytni internetda joylashtirish (hosting) uchun ([vercel.com](https://vercel.com)).
4. **Shaxsiy domen** (ixtiyoriy, masalan: `anicity.uz`).
5. **Node.js 20+** yoki **22+** (lokal kompyuterda ishga tushirish uchun).

---

## 2. Loyihani o‘rnatish va lokal ishga tushirish

1. Arxivni oching va terminalda papkaga kiring:
   ```bash
   cd anicity
   ```

2. Kerakli paketlarni o‘rnating:
   ```bash
   npm install
   ```

3. Muhit o‘zgaruvchilarini nusxalang:
   ```bash
   cp .env.example .env.local
   ```

4. `.env.local` faylini tahrirlab, o‘zingizning Supabase loyihangiz kalitlarini kiriting:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://sizning-loyihangiz.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sizning_anon_kalitingiz
   SUPABASE_SERVICE_ROLE_KEY=sizning_service_role_kalitingiz
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```

5. Testlarni tekshiring (barcha 25 ta test paketi xatosiz o‘tishi kerak):
   ```bash
   npm test
   ```

6. Dasturchi rejimida ishga tushiring:
   ```bash
   npm run dev
   ```
   Brauzerda oching: `http://localhost:3000`

---

## 3. Supabase ma’lumotlar bazasini sozlash

1. [Supabase Dashboard](https://supabase.com/dashboard) ga kiring va yangi loyiha oching (masalan, Frankfurt yoki London mintaqasida).
2. Chap menyudan **SQL Editor** bo‘limiga kiring.
3. Loyihadagi `supabase/migrations/` papkasi ichida **19 ta SQL migratsiya fayli** mavjud:
   - `001_core_schema.sql` dan boshlab `018_vip_access_columns.sql` gacha bo‘lgan barcha fayllarni tartib bilan SQL Editorda ishga tushiring (Run).
   - *Eslatma:* Agar `supabase-cli` ishlatsangiz, shunchaki `supabase db push` buyrug‘ini berishingiz kifoya.
4. Barcha jadvallar (`animes`, `episodes`, `profiles`, `subscription_plans`, `subscription_transactions`, `rate_limits` va h.k.) avtomatik yaratiladi va RLS (Row Level Security) xavfsizlik qoidalari faollashadi.

---

## 4. Administrator akkauntini yaratish

1. Saytga kiring va oddiy foydalanuvchi sifatida ro‘yxatdan o‘ting (`/register`).
2. Supabase Dashboard’da **Table Editor -> profiles** jadvaliga o‘ting.
3. O‘zingizning profilingiz qatorini topib, `role` ustunini `user` dan **`owner`** yoki **`admin`** ga o‘zgartiring.
4. Endi saytda `/admin` manziliga kirsangiz, to‘liq boshqaruv paneli ochiladi.

---

## 5. Vercel’ga yuklash (Deploy qilish)

1. Kodni o‘zingizning GitHub hisobingizga yuklang (`git push`).
2. [Vercel](https://vercel.com) ga kiring, **"Add New Project"** tugmasini bosing va GitHub repozitoriyingizni tanlang.
3. **Environment Variables** bo‘limiga quyidagi o‘zgaruvchilarni qo‘shing:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://sizning-loyihangiz.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = sizning anon kalitingiz
   - `SUPABASE_SERVICE_ROLE_KEY` = sizning service role kalitingiz
   - `NEXT_PUBLIC_SITE_URL` = sizning Vercel domeningiz (masalan: `https://anicity.uz`)
4. **Deploy** tugmasini bosing. 1–2 daqiqada sayt to‘liq jonli holatga o‘tadi.

---

## 6. To‘lov tizimlarini ulash (Click & Payme)

Batafsil yo‘riqnoma [`docs/PAYMENTS.md`](PAYMENTS.md) faylida keltirilgan. Qisqacha:
- Click va Payme bilan shartnoma tuzganingizdan keyin, ular sizga beradigan Merchant ID va Maxfiy kalitlarni Vercel Environment Variables’ga kiritasiz:
  - `CLICK_SERVICE_ID`, `CLICK_MERCHANT_ID`, `CLICK_SECRET_KEY`
  - `PAYME_MERCHANT_ID`, `PAYME_SECRET_KEY`
- Click va Payme kabinetida Webhook URL manzilini ko‘rsatasiz:
  - Click: `https://sizning-saytingiz.uz/api/payments/webhook?provider=click`
  - Payme: `https://sizning-saytingiz.uz/api/payments/webhook?provider=payme`
- Foydalanuvchilar `/premium` sahifasidagi to‘lov tugmalari orqali avtomatlashtirilgan tarzda VIP obuna xarid qila oladilar.

---

## 7. Yordam va Texnik Maslahat

Loyiha bo‘yicha qo‘shimcha texnik tafsilotlar quyidagi hujjatlarda jamlangan:
- [Admin Paneli Yo‘riqnomasi](ADMIN_GUIDE.md)
- [Baza Arxitekturasi va Jadvallar](DATABASE.md)
- [To‘lov Tizimlari Tafsilotlari](PAYMENTS.md)
- [Video Oqim va Hosting Maslahatlari](VIDEO_STREAMING.md)
- [Tizim Arxitekturasi](ARCHITECTURE.md)
