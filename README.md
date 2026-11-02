# Anicity

Anime tomosha platformasi. Next.js (App Router) + Supabase (Auth, Postgres, Storage). Vercel ga deploy qilingan.

- **Jonli sayt:** [https://anicity-app.vercel.app](https://anicity-app.vercel.app)
- **GitHub:** [https://github.com/bunyotbeksapayev58-lgtm/Anicity](https://github.com/bunyotbeksapayev58-lgtm/Anicity)

## Ishga tushirish
1. Supabase loyiha yarating va **`supabase/SUPABASE_SETUP.md`** dagi qadamlarni bajaring (SQL tartibi, owner, bucketlar).
2. Sozlamalar:
   ```bash
   cp .env.example .env.local   # qiymatlarni to'ldiring
   npm install
   npm run dev                  # http://localhost:3000
   ```
3. Production: GitHub → Vercel, env o'zgaruvchilarni qo'shing, Supabase Auth da Site URL ni domenga o'zgartiring.

## Tuzilma
- `app/` — sahifalar va server actions, `app/api/` — REST API
- `components/` — UI komponentlari
- `lib/` — Supabase klientlari, validatsiya, rollar, yordamchilar
- `supabase/migrations/` — ma'lumotlar bazasi (001–006, tartib muhim)
- `supabase/check_migrations.py` — migratsiyalarning statik tekshiruvi
- `supabase/verify.sql` — o'qish rejimidagi tekshiruv

## Imkoniyatlar
- Ro'yxatdan o'tish, login (username yoki email), parolni tiklash
- Sevimlilar, ko'rish holati ("Davom ettirish"), tarix
- Janr filtri, qidiruv, animatsiyalar, skeleton yuklash
- Admin panel: anime va qismlar (Google Drive havolasi bilan), tahrirlash, o'chirish
- Rollar: user, moderator, admin, owner; suspenziya

## REST API
Autentifikatsiya: Supabase sessiyasi (cookie). Admin amallari faqat admin/owner uchun.

| Metod | Yo'l | Kim | Vazifa |
|---|---|---|---|
| GET | `/api/animes?q=&limit=&offset=` | user | Ro'yxat (qidiruv, sahifalash) |
| POST | `/api/animes` | admin | Anime + qismlar yaratish |
| GET | `/api/animes/:id` | user | Anime va qismlar |
| PATCH | `/api/animes/:id` | admin | Yangilash (`episodes` berilsa ro'yxat almashtiriladi) |
| DELETE | `/api/animes/:id` | admin | O'chirish (poster bilan) |
| POST/DELETE | `/api/animes/:id/favorite` | user | Sevimli qo'shish/olib tashlash |
| GET | `/api/favorites` | user | Sevimlilar |
| GET/POST | `/api/progress` | user | Ko'rish holati |

Xato kodlari: `401` kirish yo'q, `403` ruxsat yo'q, `404` topilmadi, `422` validatsiya (`details`), `500` server xatosi.

## Xavfsizlik eslatmalari
- `SUPABASE_SERVICE_ROLE_KEY` faqat serverda. Hech qachon `NEXT_PUBLIC_` bilan nomlamang.
- Mualliflik huquqi himoyalangan kontentni yuklashdan oldin huquqlaringizni tekshiring.
- Video fayllar saytda saqlanmaydi, faqat havola (Google Drive yoki boshqa hosting) orqali ulanadi.

## Video manbasi: Google Drive
- Videolar Google Drive da saqlanadi, saytga faqat havola qo'yiladi.
- Faylning ulashish havolasini qo'ying (`https://drive.google.com/file/d/.../view?usp=sharing`). Papka havolasi qabul qilinmaydi.
- Faylni **"Anyone with the link"** (havolasi bor har kim) qilib qo'ying, aks holda pleer ishlamaydi.
- Drive pleeri ko'rish holatini (qaysi daqiqada to'xtagan) saqlay olmaydi. Faqat to'g'ridan-to'g'ri `.mp4`/`.webm` havolalarda saqlanadi.
