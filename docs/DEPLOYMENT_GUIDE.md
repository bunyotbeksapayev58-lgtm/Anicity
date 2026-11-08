# AniCity — Production Deployment & Infrastructure Runbook

Ushbu hujjat AniCity platformasini Vercel (Frontend & Edge API) va Supabase (PostgreSQL Database & Auth) platformalariga to‘liq xavfsiz deploy qilish bo‘yicha rasmiy qo‘llanmadir.

---

## 1. Talablar va Arxitektura

- **Frontend / API:** Next.js 16 (App Router) Turbopack bilan, Vercel Serverless & Global Edge tarmoqlarida ishlaydi.
- **Database & Auth:** Supabase PostgreSQL 15, RLS (Row Level Security) bilan himoyalangan.
- **Node.js talabi:** v20.x yoki v22.x LTS.

---

## 2. Supabase Sozlamalari

1. [Supabase Dashboard](https://supabase.com/dashboard) da yangi loyiha yarating.
2. **SQL Editor** bo‘limiga kiring va `supabase/migrations/` papkasidagi 18 ta SQL faylni ketma-ket bajaring:
   - `001_core_schema.sql` dan `017_distributed_rate_limiting.sql` gacha.
3. **Authentication → URL Configuration** bo‘limiga kiring:
   - **Site URL:** `https://anicity-app.vercel.app` (yoki sizning shaxsiy domeningiz).
   - **Redirect URLs:**
     - `http://localhost:3000/**`
     - `https://anicity-app.vercel.app/**`
4. **Storage** bo‘limida `posters` va `avatars` ochiq (public) bucketlari mavjudligini tasdiqlang.

---

## 3. Vercel Muhit O‘zgaruvchilari (Environment Variables)

Vercel loyihangizning **Settings → Environment Variables** bo‘limida quyidagi o‘zgaruvchilarni qo‘shing:

| O‘zgaruvchi | Tavsif | Misol |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase API URL | `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Anonymous Client Key | `eyJhbGci...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-Side Admin Key (Secret!) | `eyJhbGci...` |
| `NEXT_PUBLIC_SITE_URL` | Asosiy domen manzili | `https://anicity-app.vercel.app` |
| `VIDEO_SIGNING_KEY` | HMAC video tokeni uchun 32+ belgili maxfiy kalit | `rand_hex_32_chars` |
| `CLICK_SERVICE_ID` | Click Merchant Service ID (To‘lov uchun) | `12345` |
| `CLICK_MERCHANT_ID` | Click Merchant ID | `67890` |
| `CLICK_SECRET_KEY` | Click Secret Key | `secret_click_key` |
| `PAYME_MERCHANT_ID` | Paycom Merchant ID (To‘lov uchun) | `payme_id` |
| `PAYME_SECRET_KEY` | Paycom Secret Key | `secret_payme_key` |

---

## 4. Birinchi Administratorni Tayinlash

Saytga ro‘yxatdan o‘tgach, o‘zingizga bosh administrator (`owner`) rolini berish:

```sql
UPDATE public.profiles
SET role = 'owner'
WHERE username = 'sizning_username';
```

---

## 5. Ishlab Chiqarish Tekshiruvi (Production Verification)

Deploy yakunlangach, quyidagilarni tekshiring:
1. Bosh sahifa yuklanishi (`/`)
2. Katalog va filtrlar (`/catalog`)
3. Bepul qismlarni tomosha qilish (`/watch/[animeId]/[num]`) — mehmon rejimi login talab qilmasdan ochilishi kerak.
4. Administrator paneli (`/admin`) — faqat `owner` va `admin` rollariga ruxsat berilishi kerak.
