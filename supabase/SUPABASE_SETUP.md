# AniCity — Supabase sozlash qo'llanmasi (YAGONA, ishonchli manba)

Bu hujjat **toza (bo'sh) Supabase Production loyihasi** uchun. Boshqa setup qo'llanma yo'q.
Hamma qadamlar shu tartibda bajariladi.

## 0. Oldindan talab
- Production loyihaning `public` sxemasida jadvallar **yo'q** bo'lishi kerak.
- Har bir SQL faylning **ichidagi matnini** nusxalab SQL Editor da ishga tushiring. **Fayl nomini yozmang**: SQL Editor uni SQL deb o'qiydi va xato beradi.

## 1. SQL migratsiyalar: yagona ketma-ketlik

| # | Fayl | Nima qiladi |
|---|---|---|
| 1 | `supabase/migrations/001_core_schema.sql` | 16 ta jadval, inline cheklovlar, boshlang'ich sozlama |
| 2 | `supabase/migrations/002_indexes.sql` | Indekslar |
| 3 | `supabase/migrations/003_functions_triggers.sql` | 12 ta funksiya, triggerlar (profil yaratish, rol himoyasi, reyting, audit) |
| 4 | `supabase/migrations/004_grants.sql` | Ruxsatlar: authenticated uchun aniq ro'yxat |
| 5 | `supabase/migrations/005_rls_policies.sql` | Qator darajasidagi xavfsizlik (RLS) |
| 6 | `supabase/migrations/006_storage.sql` | 5 ta storage bucket va ularning ruxsatlari |

Qoidalar:
- Har birini **alohida** ishga tushiring. Oldingisi "Success" bo'lgandan keyin keyingisi.
- Xato chiqsa, to'xtang va xabarni (qaysi qator) yuboring.
- Hamma fayllar qayta ishga tushirilsa ham xavfsiz (`if not exists`, `drop ... if exists`, `on conflict`). Lekin baribir xato bo'lsa, avval ishlagan qismni qayta ishlatmang: xabarni yuboring.

**Holat:** migratsiyalar statik tekshiruvdan o'tgan (`supabase/check_migrations.py`), lekin Postgres da **sinab ko'rilmagan**. Birinchi ishga tushirishda xato bo'lishi mumkin.

## 2. Autentifikatsiya sozlamalari
Dashboard → **Authentication**:
- **Providers → Email**: yoqilgan.
- **Confirm email**: production uchun **yoqilgan** bo'lsin. Owner tayinlash uchun email tasdiqlangan bo'lishi shart.
- **URL Configuration**:
  - Site URL: `http://localhost:3000` (lokal), deploydan keyin Vercel domeni.
  - Redirect URLs: `http://localhost:3000/**` va `https://<loyiha>.vercel.app/**`.

## 3. Birinchi owner (bir marta, xavfsiz)
Owner — eng yuqori rol. Uni **faqat SQL Editor orqali** tayinlash mumkin. Ilova, API yoki oddiy foydalanuvchi buni qila olmaydi:
- `bootstrap_owner` funksiyasiga EXECUTE huquqi `public`, `anon`, `authenticated`, `service_role` dan olib tashlangan.
- Funksiya faqat owner-darajadagi (postgres) sessiyada ishlaydi.
- Bir marta ishlaydi: owner allaqachon bo'lsa rad etadi.
- Foydalanuvchi emaili tasdiqlangan bo'lishi shart.

**Qadamlar:**
1. Saytda o'zingiz tanlagan username (masalan `admin`) bilan ro'yxatdan o'ting (email kiriting).
2. Emailingizdagi tasdiqlash havolasini bosing.
3. SQL Editor da:
   ```sql
   select public.bootstrap_owner('admin');
   ```
4. Natija: `owner assigned to admin`. Xato bo'lsa:
   - "email ... is not confirmed" → 2-qadamni bajaring.
   - "user ... not found" → 1-qadamni bajaring.
   - "an owner already exists" → owner allaqachon tayinlangan, qo'shimcha amal kerak emas.

Ro'yxatdan o'tgandan keyin profil avtomatik yaratilganini tekshirish: `select username, role from public.profiles;` (role = `user` bo'ladi, bootstrapdan keyin `owner`).

## 4. Rollar va rol o'zgartirish
| Rol | Huquqlari |
|---|---|
| `user` | Ko'rish, sevimlilar, ko'rish holati, izoh, baho, shikoyat |
| `moderator` | + izohlarni yashirish/o'chirish, shikoyatlarni ko'rish va hal qilish |
| `admin` | + anime, qism, banner, e'lon, sozlamalar; user/moderator rolini berish; suspenziya (admin/owner ga tegmaydi) |
| `owner` | Hammasi; admin/owner ni ham boshqaradi |

**Hech kim o'z rolini o'zi oshira olmaydi.** Uch qatlam:
1. Ustun ruxsati: `profiles` da foydalanuvchi faqat `username, display_name, avatar_url, bio` ni yangilaydi. `role` va `suspended_at` yo'q.
2. Trigger `profiles_guard`: ruxsat chetlab o'tilsa ham rol o'zgarishini rad etadi.
3. Ro'yxatdan o'tish: `handle_new_user` profilni har doim `user` bilan yaratadi, metadata'dan rol olinmaydi.

Rolni o'zgartirish (faqat admin/owner, server funksiyasi orqali):
```sql
select public.set_user_role('<uuid>', 'moderator');
select public.set_user_suspended('<uuid>', true);   -- suspenziya
select public.set_user_suspended('<uuid>', false);  -- tiklash
```
UUID ni `select id, username, role from public.profiles;` orqali topasiz. Bu amallar `admin_logs` ga yoziladi.

## 5. Audit (admin jurnali)
- `admin_logs` jadvali faqat **o'qish** uchun (admin/owner/moderator). Hech kim, hatto admin ham, to'g'ridan-to'g'ri yoza olmaydi.
- Yozuvlar avtomatik: anime, qism, banner, e'lon, sozlama, izoh va shikoyat jadvallarida **staff** o'zgartirish qilsa, trigger (`*_audit_trg`) yozadi.
- Rol va suspenziya o'zgarishlari `set_user_role` / `set_user_suspended` ichida yoziladi.
- Oddiy foydalanuvchi o'z sevimli/izoh/bahosini qo'shsa, log yozilmaydi.
- Moderator soxta audit yozuvi yarata olmaydi: `log_admin_action` degan ochiq funksiya yo'q.

## 6. Kalitlar (Project Settings → API)
| O'zgaruvchi | Qayerda | Eslatma |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Lokal va Vercel | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Lokal va Vercel | Brauzerga chiqishi xavfsiz (RLS himoyalaydi) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Faqat server** | RLS ni chetlab o'tadi. `NEXT_PUBLIC_` bilan nomlamang, GitHub ga yozmang |
| `NEXT_PUBLIC_SITE_URL` | Lokal va Vercel | Lokal: `http://localhost:3000`, production: domen |

## 7. Storage bucketlar
| Bucket | Vazifasi | Hajm | Yozish |
|---|---|---|---|
| `posters` | Anime posterlari (ilova shu nomdan foydalanadi) | 3 MB | admin/owner |
| `anime-banners` | Anime bannerlari | 5 MB | admin/owner |
| `episode-thumbnails` | Qism miniatyuralari | 2 MB | admin/owner |
| `profile-avatars` | Avatarlar (`<uid>/...` papkasi) | 2 MB | o'z papkasi yoki admin |
| `site-assets` | Sayt rasmlari | 5 MB | admin/owner |

Hammasi o'qiladigan (public). Ruxsat etilgan turlar: JPEG, PNG, WebP (site-assets da SVG ham).

## 8. Ilova bilan bog'liqlik
Ilova quyidagilarga murojaat qiladi: jadvallar `profiles`, `animes`, `episodes`, `favorites`, `watch_progress`; bucket `posters`. Ustun nomlari 001 da o'zgartirilmagan.

## 9. Tekshirish
`supabase/verify.sql` ni blok-blok ishga tushiring (faqat o'qiydi). Har bir blokning yonida kutilgan natija yozilgan. Asosiylari:
- 16 ta jadval, hammasida RLS = true
- 12 ta funksiya, `log_admin_action` yo'q
- 19 ta trigger
- 5 ta bucket
- anon hech qanday jadvalga kira olmaydi
- authenticated faqat 6 ta funksiyani chaqira oladi
- `bootstrap_owner` ga faqat owner-darajadagi rol EXECUTE ega
- `admin_logs` da authenticated faqat SELECT

## 10. Ma'lum cheklovlar
- Suspenziya bazada belgilanadi va yangi amallarni to'xtatadi. Mavjud sessiyani darhol tugatish uchun auth darajasidagi bekor qilish kerak (ilova, keyingi bosqich).
- Rate limit (so'rovlar cheklovi) hali yo'q (keyingi bosqich).
- Janrlar `animes.genres` (matn massivi) da. Normalizatsiya keyingi bosqichda.
- `watch_history` alohida jadval emas: `watch_progress` tarixni ham beradi.
- Google OAuth hozircha yo'q.
