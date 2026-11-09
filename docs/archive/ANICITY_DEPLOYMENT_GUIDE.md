# ANICITY — DEPLOYMENT & SOZLASH QO‘LLANMASI

Ushbu qo‘llanma orqali Anicity platformasining Vercel va Supabase sozlamalarini boshqarish hamda Google OAuth tizimini to‘liq ulashingiz mumkin.

---

## 1. Jonli Vercel Deployi Ma'lumotlari

- **Asosiy Jonli Sayt (Production URL):** [https://anicity-app.vercel.app](https://anicity-app.vercel.app)
- **Qo‘shimcha Domenlar:**
  - [https://yozora-app.vercel.app](https://yozora-app.vercel.app)
  - [https://anicity-aniverse3.vercel.app](https://anicity-aniverse3.vercel.app)
- **Vercel Loyiha ID:** `prj_GeymrumXoMuZpRIXyqnxFs647DRy`
- **Vercel Loyiha Nomi:** `anicity`
- **GitHub Repozitoriyasi:** [https://github.com/bunyotbeksapayev58-lgtm/Anicity](https://github.com/bunyotbeksapayev58-lgtm/Anicity)

---

## 2. Vercel Muhit O‘zgaruvchilari (Environment Variables)

Vercel loyihasida quyidagi 3 ta parametr to‘liq sozlangan:

1. `NEXT_PUBLIC_SUPABASE_URL`: `https://lngeosburovsxotywbfw.supabase.co`
2. `NEXT_PUBLIC_SUPABASE_ANON_KEY`: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
3. `NEXT_PUBLIC_SITE_URL`: `https://anicity-app.vercel.app`

---

## 3. Google OAuth Tizimini Ulash (Ko‘rsatma)

Saytda "Google bilan kirish" va "Google orqali ro‘yxatdan o‘tish" tugmalari to‘liq dasturlangan. Google login ishlashi uchun Google Cloud va Supabase’da quyidagi qadamlarni bir marta bajarishingiz kerak:

### Qadam 1: Google Cloud Console’da OAuth Client yaratish
1. [Google Cloud Console](https://console.cloud.google.com/) sahifasiga kiring.
2. **APIs & Services** → **Credentials** bo‘limiga o‘ting.
3. **Create Credentials** → **OAuth client ID** ni bosing.
4. **Application type**: `Web application` ni tanlang.
5. **Name**: `Anicity Auth` deb nomlang.
6. **Authorized redirect URIs** bo‘limiga quyidagi Supabase manzilini kiriting:
   ```text
   https://lngeosburovsxotywbfw.supabase.co/auth/v1/callback
   ```
7. **Create** tugmasini bosing. Sizga **Client ID** va **Client Secret** beriladi.

### Qadam 2: Supabase’da Google Provayderini Faollashtirish
1. [Supabase Dashboard](https://supabase.com/dashboard/project/lngeosburovsxotywbfw/auth/providers) sahifasiga kiring.
2. **Authentication** → **Providers** bo‘limiga o‘ting.
3. Ro‘yxatdan **Google** ni oching.
4. **Enable Sign in with Google** tugmasini yoqing.
5. Google Cloud’dan olgan **Client ID** va **Client Secret** ni joylashtiring.
6. **Save** tugmasini bosing.

### Qadam 3: Redirect URLs Sozlash
Supabase Dashboard → **Authentication** → **URL Configuration** sahifasida quyidagi havolalar mavjudligini tasdiqlang:
- **Site URL**: `https://anicity-app.vercel.app`
- **Redirect URLs**:
  - `http://localhost:3000/**`
  - `https://anicity-app.vercel.app/**`
  - `https://yozora-app.vercel.app/**`

---

## 4. Administrator (Owner) Rolini Tayinlash

Saytda yangi anime va epizodlar yuklash huquqiga ega bo‘lish uchun:

1. [https://anicity-app.vercel.app/register](https://anicity-app.vercel.app/register) sahifasiga kirib o‘z akkauntingizni oching.
2. [Supabase SQL Editor](https://supabase.com/dashboard/project/lngeosburovsxotywbfw/sql) sahifasiga kirib, quyidagi buyruqni bering:
   ```sql
   UPDATE public.profiles
   SET role = 'owner'
   WHERE username = 'sapayev1231'; -- o'z login username'ingiz
   ```
3. Endi saytga kirganingizda yuqori menyuda **Admin** tugmasi ochiladi.
