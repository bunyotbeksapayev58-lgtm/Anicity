# YOZORA — DEPLOYMENT GUIDE (VERCEL & SUPABASE)

Ushbu qo‘llanma orqali Yozora loyihasini Vercel platformasida bir necha daqiqada ishga tushirishingiz mumkin.

---

## 1. Vercel'da loyiha yaratish

### Usul 1: Vercel Dashboard (Tavsiya etiladi — 1 marta bosish bilan)
1. [https://vercel.com/new](https://vercel.com/new) manziliga kiring.
2. **Import Git Repository** bo‘limidan **`bunyotbeksapayev58-lgtm/Yozora`** repozitoriyasini tanlang (yoki "Import" tugmasini bosing).
3. **Configure Project** oynasida:
   - **Framework Preset**: `Next.js` (avtomatik tanlanadi).
   - **Root Directory**: `./` (standart).
   - **Build Command**: `next build` (yoki standart).
4. **Environment Variables** bo‘limiga quyidagi 3 ta parametrlarni kiriting:
   - `NEXT_PUBLIC_SUPABASE_URL`: `https://lngeosburovsxotywbfw.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxuZ2Vvc2J1cm92c3hvdHl3YmZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0NDc5NTEsImV4cCI6MjEwOTAyMzk1MX0.ynN4uCMVD9tDKmk4ihxIutZHSXaxzo_kuJImhXLcTi0`
   - `NEXT_PUBLIC_SITE_URL`: `https://yozora-app.vercel.app` (yoki sizga Vercel beradigan domen).
5. **Deploy** tugmasini bosing.
6. Taxminan 45–60 soniyada vebsayt jonli ishga tushadi!

---

## 2. Supabase Auth sozlamalarini yangilash

Deploy yakunlangach, Vercel bergan URL manzilini (masalan: `https://yozora-app.vercel.app`) oling:

1. [https://supabase.com](https://supabase.com) dashboardiga kiring.
2. **Project**: `english-ai-academy` (ref: `lngeosburovsxotywbfw`).
3. Chap menyudan **Authentication** → **URL Configuration** ga o‘ting:
   - **Site URL**: `https://yozora-app.vercel.app`
   - **Redirect URLs** ro‘yxatiga quyidagilarni qo‘shing:
     - `http://localhost:3000/**`
     - `https://yozora-app.vercel.app/**`
4. **Save** tugmasini bosing.

---

## 3. Sayt Administratori (Owner) ni belgilash

Saytda admin imkoniyatlaridan (yangi anime yuklash, tahrirlash, o‘chirish) foydalanish uchun:

1. Saytingizga kiring (`/register` sahifasida ro‘yxatdan o‘ting yoki mavjud hisob bilan kiring).
2. Supabase Dashboard → **SQL Editor** ga kiring va quyidagi buyruqni bering:
   ```sql
   -- Foydalanuvchi username'iga 'admin' yoki 'owner' roli berish:
   UPDATE public.profiles
   SET role = 'admin'
   WHERE username = 'sapayev1231';
   ```
3. Endi saytga qaytib kirsangiz, yuqori menyuda **Admin** tugmasi ochiladi!
