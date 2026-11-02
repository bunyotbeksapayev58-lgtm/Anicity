# Ma'lumotlar bazasi — hisobot (yangi arxitektura)

## Arxitektura
- 6 ta migratsiya, bitta ketma-ketlik: `001` → `006` (`supabase/SUPABASE_SETUP.md` da).
- 16 jadval, 12 funksiya, 19 trigger, 5 storage bucket, RLS barcha jadvallarda.
- Eski migratsiyalar (schema.sql va 002–007) o'chirilgan. Production `public` sxemasi bo'sh bo'lgani uchun eski tarixni saqlash kerak emas edi.
- Hujjatlar: faqat `supabase/SUPABASE_SETUP.md` (yagona SQL ketma-ketligi). Root dagi eski qo'llanma olib tashlangan.

## Ikki tuzatish (ikkinchi ko'rib chiqish)
1. **Hujjatlar:** root `SUPABASE_SETUP.md` va root `PHASE2_REPORT.md` o'chirildi. Eski `owner` instruksiyasi (`update ... set role='owner'`) olib tashlandi. Owner faqat `bootstrap_owner()` orqali tayinlanadi.
2. **Audit xavfsizligi:** `log_admin_action()` olib tashlandi. Moderator soxta audit yozuvi yarata olmasdi, lekin `authenticated` ga EXECUTE berilgan edi, bu noto'g'ri edi.
   - Yangi yondashuv: audit `audit_row_change()` trigger orqali, faqat staff o'zgarishlari uchun, `auth.uid()` bilan. Ilova yoki foydalanuvchi uni qo'lda chaqira olmaydi.
   - `admin_logs` ga hech kim yozolmaydi (faqat SELECT).

## Xavfsizlik qoidalari (statik tekshiruvchi bilan majburlanadi)
`check_migrations.py` quyidagilarni tekshiradi:
- SECURITY DEFINER funksiyalarda `set search_path` bor.
- anon/public/service_role hech qanday public funksiyaga EXECUTE ololmaydi.
- authenticated faqat 6 ta ruxsat etilgan funksiyani chaqira oladi.
- `bootstrap_owner` va trigger-funksiyalar hech kimga berilmagan.
- `log_admin_action` mavjud emas, `admin_logs` ga yozish huquqi yo'q.
- Har bir ma'lumot jadvalida audit trigger bor.
- Har bir jadvalda RLS yoqilgan.
- `profiles` da foydalanuvchi `role`, `suspended_at`, `id` ni yangilay olmaydi.
- `handle_new_user` profilni `user` roli bilan yaratadi, metadata'dan rol olmaydi.

Manfiy test: checker ataylab kiritilgan regressiyalarning hammasini ushladi (log funksiyasini qayta qo'shish, profiles ga `role` grant, search_path yo'qligi, metadata'dan rol, audit triggerni o'chirish).

## Tekshiruv holati (aniq)
| Tekshiruv | Holat |
|---|---|
| Migratsiya tartibi va bog'liqliklar (statik) | O'tdi |
| Idempotentlik (statik) | O'tdi |
| Xavfsizlik qoidalari (statik) | O'tdi |
| Ilova jadval va bucket murojaatlari (statik) | O'tdi (`profiles`, `animes`, `episodes`, `favorites`, `watch_progress`; bucket `posters`) |
| Postgres da haqiqiy ishga tushirish | **SINAB KO'RILMADI** (bu muhitda Postgres yo'q) |
| Ro'yxatdan o'tishdan profil yaratilishi | **SINAB KO'RILMADI** (Supabase kerak) |
| Owner bootstrap (haqiqiy ruxsat) | **SINAB KO'RILMADI**; faqat kod darajasida tekshirildi |
| RLS siyosatlari (haqiqiy rol bo'yicha) | **SINAB KO'RILMADI** |
| Ilova build (`npm run build`) | **SINAB KO'RILMADI** |

## Ma'lum xavflar
- SECURITY DEFINER funksiyalar `postgres` (jadval egasi) nomidan ishlaydi va RLS ni chetlab o'tadi. Ular ichida ruxsat tekshiruvi bor va ular API ga ochiq emas.
- Trigger funksiyalarining EXECUTE huquqi olib tashlangan. PostgreSQL trigger ishga tushganda EXECUTE ni qayta tekshirmaydi (faqat trigger yaratishda tekshiradi), lekin bu haqiqiy bazada sinalmagan. Birinchi ro'yxatdan o'tishda profil yaratilishi shuni tasdiqlaydi.
- Suspenziya bazada belgilanadi, mavjud sessiyani darhol tugatmaydi (keyingi bosqich).
