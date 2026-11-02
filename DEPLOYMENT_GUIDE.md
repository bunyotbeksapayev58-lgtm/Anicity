# YOZORA — DEPLOYMENT & MAINTENANCE GUIDE

Ushbu hujjat Yozora loyihasining jonli Vercel deployi, Supabase sozlamalari va administrator boshqaruvi bo‘yicha qo‘llanmadir.

---

## 1. Jonli Vercel Deployi Ma'lumotlari

Loyiha Vercel platformasida avtomatlashtirilgan tarzda deploy qilindi va jonli ishlamoqda:

- **Asosiy Domen (Production URL):** [https://yozora-app.vercel.app](https://yozora-app.vercel.app)
- **Qo‘shimcha Domenlar:**
  - [https://yozora-app-aniverse3.vercel.app](https://yozora-app-aniverse3.vercel.app)
  - [https://yozora-app-git-main-aniverse3.vercel.app](https://yozora-app-git-main-aniverse3.vercel.app)
- **Vercel Project ID:** `prj_GeymrumXoMuZpRIXyqnxFs647DRy`
- **GitHub Repozitoriyasi:** [https://github.com/bunyotbeksapayev58-lgtm/Yozora](https://github.com/bunyotbeksapayev58-lgtm/Yozora)
- **Deployment Holati:** `READY`

---

## 2. Vercel Muhit O‘zgaruvchilari (Environment Variables)

Vercel loyihasida quyidagi 3 ta o‘zgaruvchi `production`, `preview` va `development` muhitlari uchun kiritilgan:

1. `NEXT_PUBLIC_SUPABASE_URL`: `https://lngeosburovsxotywbfw.supabase.co`
2. `NEXT_PUBLIC_SUPABASE_ANON_KEY`: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
3. `NEXT_PUBLIC_SITE_URL`: `https://yozora-app.vercel.app`

---

## 3. Supabase Auth Sozlamalari (Tavsiya etiladigan amallar)

Foydalanuvchilar parolini tiklash va elektron pochtani tasdiqlash jonli domen bilan to‘g‘ri ishlashi uchun:

1. [https://supabase.com/dashboard/project/lngeosburovsxotywbfw](https://supabase.com/dashboard/project/lngeosburovsxotywbfw) manziliga kiring.
2. Chap menyudan **Authentication** → **URL Configuration** sahifasini oching.
3. Quyidagi sozlamalarni kiriting:
   - **Site URL**: `https://yozora-app.vercel.app`
   - **Redirect URLs**:
     - `http://localhost:3000/**`
     - `https://yozora-app.vercel.app/**`
4. **Save** tugmasini bosing.

---

## 4. Sayt Administratori (Admin/Owner) Tayinlash

Loyihada xavfsizlik qoidasiga ko‘ra, hech bir foydalanuvchiga avtomatik `admin` yoki `owner` roli berilmaydi. Administrator tayinlash uchun:

1. Vebsaytda (`https://yozora-app.vercel.app/register`) o‘z hisobingiz bilan ro‘yxatdan o‘ting (yoki mavjud hisobingizdan foydalaning).
2. Supabase Dashboard → **SQL Editor** bo‘limiga o‘ting.
3. O‘z akkauntingizga admin ruxsatini berish uchun quyidagi SQL buyrug‘ini bajaring:
   ```sql
   -- Foydalanuvchiga 'admin' rolini berish (masalan username 'sapayev1231' uchun):
   UPDATE public.profiles
   SET role = 'admin'
   WHERE username = 'sapayev1231';
   ```
4. Yoki to‘liq `owner` rolini berish uchun:
   ```sql
   UPDATE public.profiles
   SET role = 'owner'
   WHERE username = 'sapayev1231';
   ```
5. Saytga qaytib kirsangiz, yuqori navigatsiya panelida **Admin** bo‘limi ochiladi va yangi animelar yuklash hamda ularni boshqarish imkoniyati paydo bo‘ladi.
