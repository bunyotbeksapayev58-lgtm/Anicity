> Eslatma: bu Phase 1 tarixi. Ma'lumotlar bazasi keyinchalik qayta qurilgan: hozirgi tartib `supabase/SUPABASE_SETUP.md` da.

# Yozora — 1-bosqich audit hisoboti

Usul: statik tekshiruv (kodni o'qish va grep orqali). Build, npm install va Supabase bilan real ulanish bu sessiyada bajarilmadi (tarmoq o'chiq). Shuning uchun quyidagi topilmalar "kod darajasida tasdiqlangan", "ishlashi sinalgan" emas.

## Topilmalar

| # | Muammo | Joy | Jiddiylik | Sababi | Holat |
|---|---|---|---|---|---|
| 1 | Qidiruvda LIKE belgilari (% va _) escape qilinmagan | app/api/animes/route.js | Past | `_` har qanday belgiga mos keladi, natija noto'g'ri bo'ladi | Tuzatildi |
| 2 | Username bo'yicha email sizishi (ochiq RPC) | supabase (002 gacha) | Yuqori | anon chaqira oladigan SECURITY DEFINER funksiya | Qayta qurilgan migratsiyalarda olib tashlangan (`supabase/migrations/`), login serverda |
| 3 | /api so'rovlari login sahifasiga yo'naltirilgan | middleware.js | O'rta | Middleware API ni ham ushlagan | Tuzatildi (API o'zi 401/403 qaytaradi) |
| 4 | Username band bo'lsa umumiy Supabase xatosi | app/actions/auth.js | Past | Trigger xatosi foydalanuvchiga yetib borgan | Oldindan tekshiruv qo'shildi |
| 5 | Anime o'chirilganda poster Storage da qolgan | app/actions/admin.js, API DELETE | O'rta | Storage bilan bog'liq tozalash yo'q edi | Tuzatildi |
| 6 | Data API uchun aniq GRANT yo'q | supabase | O'rta | Yangi jadvallar avtomatik ochilmasligi mumkin | Hozirgi `004_grants.sql` da hal qilingan |
| 7 | RLS da auth.uid() har qatorda baholanadi | favorites, watch_progress | Past (unumdorlik) | Supabase tavsiyasi | Hozirgi `005_rls_policies.sql` da `(select auth.uid())` bilan |

## Tekshirilgan va to'g'ri topilganlar (xavf yo'q)
- Service role kaliti faqat serverda (app/actions/auth.js, lib/supabase/admin.js); 'use client' fayllarida yo'q.
- Barcha API marshrutlari requireUser yoki requireAdmin chaqiradi.
- Admin server actions (create, update, delete) assertAdmin orqali tekshiriladi, va RLS (is_admin) ham shuni himoya qiladi.
- Progress saqlash 5 soniyada bir marta (ortiqcha yozuv yo'q).
- TODO yoki placeholder yo'q.

## Hali amalga oshirilmagan (spetsifikatsiyadan)
Bular xato emas, lekin spetsifikatsiyada so'ralgan va hali yo'q:
- Jadvallar: genres, anime_genres, seasons, watchlists, comments, ratings, notifications, reports, site_settings, banners, announcements, admin_logs, watch_history (hozir watch_progress bor).
- Storage buckets: anime-banners, episode-thumbnails, profile-avatars, site-assets (hozir faqat posters).
- Rollar: USER, MODERATOR, ADMIN, OWNER (hozir faqat admin/user).
- Google OAuth, hisob bloklash, izohlar, reytinglar, tavsiyalar, sitemap, robots.txt, Open Graph, testlar.
- Build va real sinov: bu muhitda bajarilmadi.

## Keyingi qadam
Spetsifikatsiyani 13 bosqichga bo'lib, har birini alohida bajarish va haqiqatan sinash kerak. Birinchi navbatda 2-bosqich (ma'lumotlar bazasi va rollar) va 8-bosqich (admin) muhim, chunki qolgan funksiyalar shularga tayanadi.
