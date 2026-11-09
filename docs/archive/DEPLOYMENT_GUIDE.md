# ANICITY — DEPLOYMENT & MAINTENANCE GUIDE

Ushbu hujjat Anicity platformasining jonli Vercel deployi, Supabase sozlamalari va administrator boshqaruvi bo‘yicha qo‘llanmadir.

---

## 1. Jonli Vercel Deployi Ma'lumotlari

Loyiha Vercel platformasida jonli ishlamoqda:

- **Asosiy Domen (Production URL):** [https://anicity-app.vercel.app](https://anicity-app.vercel.app)
- **Qo‘shimcha Domenlar:**
  - [https://yozora-app.vercel.app](https://yozora-app.vercel.app)
  - [https://anicity-git-main-aniverse3.vercel.app](https://anicity-git-main-aniverse3.vercel.app)
- **Vercel Project ID:** `prj_GeymrumXoMuZpRIXyqnxFs647DRy`
- **Vercel Project Name:** `anicity`
- **GitHub Repozitoriyasi:** [https://github.com/bunyotbeksapayev58-lgtm/Anicity](https://github.com/bunyotbeksapayev58-lgtm/Anicity)
- **Deployment Holati:** `READY`

---

## 2. Vercel Muhit O‘zgaruvchilari (Environment Variables)

1. `NEXT_PUBLIC_SUPABASE_URL`: `https://lngeosburovsxotywbfw.supabase.co`
2. `NEXT_PUBLIC_SUPABASE_ANON_KEY`: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
3. `NEXT_PUBLIC_SITE_URL`: `https://anicity-app.vercel.app`

---

## 3. Supabase Auth Sozlamalari

Foydalanuvchilar parolini tiklash va elektron pochtani tasdiqlash jonli domen bilan to‘g‘ri ishlashi uchun:

1. [https://supabase.com/dashboard/project/lngeosburovsxotywbfw](https://supabase.com/dashboard/project/lngeosburovsxotywbfw) manziliga kiring.
2. Chap menyudan **Authentication** → **URL Configuration** sahifasini oching.
3. Quyidagi sozlamalarni kiriting:
   - **Site URL**: `https://anicity-app.vercel.app`
   - **Redirect URLs**:
     - `http://localhost:3000/**`
     - `https://anicity-app.vercel.app/**`
4. **Save** tugmasini bosing.

---

## 4. Sayt Administratori (Admin/Owner) Tayinlash

Administrator tayinlash uchun:

1. Vebsaytda (`https://anicity-app.vercel.app/register`) o‘z hisobingiz bilan ro‘yxatdan o‘ting.
2. Supabase Dashboard → **SQL Editor** bo‘limiga o‘ting.
3. O‘z akkauntingizga admin ruxsatini berish uchun quyidagi SQL buyrug‘ini bajaring:
   ```sql
   -- Foydalanuvchiga 'owner' rolini berish (masalan username 'sapayev1231' uchun):
   UPDATE public.profiles
   SET role = 'owner'
   WHERE username = 'sapayev1231';
   ```
4. Saytga qaytib kirsangiz, yuqori navigatsiya panelida **Admin** bo‘limi ochiladi va yangi anime va epizodlar yuklash imkoniyati paydo bo‘ladi.
