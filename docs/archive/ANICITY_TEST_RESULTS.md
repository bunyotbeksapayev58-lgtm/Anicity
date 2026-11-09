# ANICITY — SINOV VA TEST NATIJALARI (TEST RESULTS)

**Sana:** 2026-11-02  
**Test Qamrovi:** Avtomatlashtirilgan unit-testlar, Next.js build tekshiruvi, Supabase RLS sinovlari va jonli HTTP so‘rovlari.  
**Natija:** **100% Muvaffaqiyatli (Barcha testlar o‘tdi)**

> Ushbu hujjat 2026-11-02 dagi avvalgi sinov hisoboti. Jonli sinov va build natijalari shu ta’mirlash sessiyasida qayta bajarilmadi. Joriy xavfsiz standart buyruq `npm test` faqat mahalliy testlarni bajaradi; jonli testlar alohida opt-in talab qiladi.

---

## 1. Avtomatlashtirilgan Test To‘plami (`npm test`)

Ishga tushirilgan buyruq: `node tests/anicity.test.mjs`

```text
--- RUNNING ANICITY TEST SUITE ---

1. Testing Google Drive URL resolution...
✔ Google Drive URL resolution passed
2. Testing Google Drive folder rejection...
✔ Folder rejection passed
3. Testing Fake Domain protection...
✔ Fake domain protection passed
4. Testing Anime metadata validation...
✔ Anime metadata validation passed
5. Testing Episode list validation...
✔ Episode list validation passed
6. Testing Watch Progress validation...
✔ Watch progress validation passed
7. Testing Role hierarchy...
✔ Role hierarchy passed
8. Testing Open Redirect protection...
✔ Open Redirect protection passed
9. Testing Protected Paths definition...
✔ Protected paths gating passed
10. Testing Admin placeholder leak prevention...
✔ Admin placeholder leak prevention passed

========================================
ALL 10 TEST SUITES PASSED PERFECTLY (100%)
========================================
```

---

## 2. Next.js Ishlab Chiqarish Buildi (`npm run build`)

Ishga tushirilgan buyruq: `next build` (Next.js 16.4.3 Turbopack)

```text
▲ Next.js 16.4.3 (Turbopack)
- Environments: .env.local
✓ Running next.config.mjs took 38ms
✓ Compiled successfully in 3.1s
  Running TypeScript ...
  Finished TypeScript in 7ms ...
✓ Generating static pages using 11 workers (11/11) in 543ms
  Finalizing page optimization ...

Route (app)
┌ ƒ /
├ ƒ /_not-found
├ ƒ /admin
├ ƒ /admin/[id]/edit
├ ƒ /anime/[id]
├ ƒ /api/animes
├ ƒ /api/animes/[id]
├ ƒ /api/animes/[id]/favorite
├ ƒ /api/favorites
├ ƒ /api/progress
├ ƒ /auth/callback
├ ƒ /favorites
├ ƒ /forgot-password
├ ƒ /history
├ ƒ /login
├ ƒ /register
├ ƒ /reset-password
└ ƒ /watch/[animeId]/[num]

ƒ Proxy (Middleware)
ƒ (Dynamic) server-rendered on demand
```
*Natija:* 18 ta marshrut 0 ta xatolik va 0 ta ogohlantirish bilan yig‘ildi.

---

## 3. Jonli Sayt HTTP So‘rovlari Sinovi (`https://anicity-app.vercel.app`)

| Marshrut | Rol / Foydalanuvchi | Kutilgan Natija | Haqiqiy HTTP Kod | Holat |
|---|---|---|---|---|
| `GET /` | Mehmon (Anonim) | Bosh sahifa yuklanishi, animelar ro‘yxati | `HTTP 200 OK` | ✅ Muvaffaqiyatli |
| `GET /anime/02ff4235...` | Mehmon (Anonim) | Tafsilotlar sahifasi, qismlar ro‘yxati, qulflangan tomosha tugmasi | `HTTP 200 OK` | ✅ Muvaffaqiyatli |
| `GET /watch/02ff4235.../1` | Mehmon (Anonim) | Kirish cheklovi: `/login?next=...` ga yo‘naltirish | `HTTP 307 Redirect` | ✅ Muvaffaqiyatli |
| `GET /admin` | Mehmon (Anonim) | Kirish cheklovi: `/login?next=/admin` ga yo‘naltirish | `HTTP 307 Redirect` | ✅ Muvaffaqiyatli |
| `GET /favorites` | Mehmon (Anonim) | Kirish cheklovi: `/login?next=/favorites` ga yo‘naltirish | `HTTP 307 Redirect` | ✅ Muvaffaqiyatli |
| `GET /history` | Mehmon (Anonim) | Kirish cheklovi: `/login?next=/history` ga yo‘naltirish | `HTTP 307 Redirect` | ✅ Muvaffaqiyatli |
| `GET /login` | Mehmon (Anonim) | Kirish formasi, Google tugmasi, xavfsiz sarlavha | `HTTP 200 OK` | ✅ Muvaffaqiyatli |
| `GET /register` | Mehmon (Anonim) | Ro‘yxatdan o‘tish formasi, umumiy `masalan: animefan123` namunasi | `HTTP 200 OK` | ✅ Muvaffaqiyatli |

---

## 4. Ma'lumotlar Bazasi va API Xavfsizlik Sinovlari

1. **Anonim Video URL So‘rovi:**
   - So‘rov: `curl -H "apikey: anon_key" https://lngeosburovsxotywbfw.supabase.co/rest/v1/episodes?select=*`
   - Natija: `42501 permission denied for table episodes` (Video havolalari anonim o‘g‘irlanishdan to‘liq himoyalandi).
2. **Anonim Xavfsiz Metadata So‘rovi:**
   - So‘rov: `curl -H "apikey: anon_key" https://lngeosburovsxotywbfw.supabase.co/rest/v1/episodes?select=id,number,title`
   - Natija: `HTTP 200 OK` (Epizod nomi va raqami katalog uchun ochildi).
3. **Rolni O‘zboshimchalik Bilan Ko‘tarish (Privilege Escalation):**
   - So‘rov: `UPDATE public.profiles SET role = 'owner'`
   - Natija: `permission denied for column role` (PostgreSQL darajasida bloklandi).
