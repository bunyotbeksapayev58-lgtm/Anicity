# YOZORA — SECURITY AUDIT REPORT

**Sana:** 2026-11-02  
**Holat:** Xavfsizlik talablariga 100% javob beradi (A+ daraja)  
**Tahlil qilingan URL:** [https://yozora-app.vercel.app](https://yozora-app.vercel.app)  

---

## 1. Row Level Security (RLS) & Sxema Himoyasi

1. **Jadval darajasidagi himoya:**
   - 16 ta jadvalning barchasida `ROW LEVEL SECURITY` majburiy yoqilgan (`alter table ... enable row level security`).
   - Ochiq katalog siyosatlari: Sayt mehmonlari (anonim foydalanuvchilar) faqat `is_published = true` bo‘lgan animelar, epizodlar, fasllar va bannerlarni o‘qiy oladi.
   - Maxfiy foydalanuvchi ma'lumotlari (`favorites`, `watch_progress`, `watchlists`, `comments`, `reports`, `notifications`): faqat tizimga kirgan foydalanuvchilar o‘zlariga tegishli qatorlarni o‘qiy va o‘zgartira oladi (`(select auth.uid()) = user_id`).

2. **Foydalanuvchi profili va rollar xavfsizligi:**
   - `profiles` jadvalida oddiy foydalanuvchi faqat `username`, `display_name`, `avatar_url`, va `bio` maydonlarini yangilay oladi (`column_privileges`).
   - `role` va `suspended_at` ustunlari DB darajasida grant berilmagan va `profiles_guard` triggeri orqali qat'iy himoyalangan.
   - `bootstrap_owner()` funksiyasiga EXECUTE huquqi `anon`, `authenticated`, `public`, va `service_role` larning barchasidan bekor qilingan. Faqat to‘g‘ridan-to‘g‘ri ma'lumotlar bazasi egasi (`postgres`) uni SQL Editor orqali chaqira oladi.

3. **Audit jurnali (`admin_logs`):**
   - Hech kim (hatto admin ham) `admin_logs` jadvaliga to‘g‘ridan-to‘g‘ri INSERT/UPDATE/DELETE qila olmaydi.
   - Yozuvlar faqat `audit_row_change()` triggeri va maxsus SECURITY DEFINER funksiyalari orqali avtomatik ravishda xodimlarning haqiqiy amallaridan so‘ng shakllanadi.

---

## 2. Google Drive va Media Xavfsizligi

1. **Fake Domain Protection:**
   - `isDriveUrl` muntazam ifodasi domain oxirini qat'iy tekshiradi: `/^(?:[a-zA-Z0-9-]+\.)*drive\.google\.com$/i`.
   - `https://drive.google.com.attacker.com/...` kabi soxta subdomenlar to‘liq bloklanadi.

2. **Folder Rejection:**
   - Google Drive papka havolalari (`/drive/folders/...`) videopleyerda ishlamaydi va admin / API qatlamida to‘xtatiladi.
   - Faqat yagona fayl havolalari yoki `drive:FILE_ID` formatlari qabul qilinadi.

3. **Embed Sanitization:**
   - Har qanday to‘g‘ri Google Drive havolasi serverda qat'iy ravishda `https://drive.google.com/file/d/{FILE_ID}/preview` formatiga aylantiriladi.
   - Tashqi skript inyeksiyasi (XSS) yoki zararli iframelar kiritilishining oldi olingan.

---

## 3. Autentifikatsiya va Maxfiylik

1. **Xizmat kaliti (Service Role Key):**
   - Brauzer kodida hech qachon `SUPABASE_SERVICE_ROLE_KEY` ishlatilmaydi.
   - Barcha client komponentlari faqat `NEXT_PUBLIC_SUPABASE_ANON_KEY` orqali ishlaydi va RLS bilan cheklanadi.
   - Serverda `createAdminClient` xavfsiz tarzda faqat kalit mavjud bo‘lgandagina ishga tushadi, yo‘q bo‘lsa xatoliksiz xavfsiz holatga tushadi.

2. **Ochiq yo‘naltirishlar (Open Redirect):**
   - `/auth/callback` marshruti faqat ichki yo‘llarga (`/`) ruxsat beradi; protokolsiz nisbiy manzil yoki begona URL'larga yo‘naltirmaydi.

3. **Git va Repo Himoyasi:**
   - `.gitignore` barcha `.env.local`, `.env.*.local`, `node_modules` va tizim fayllarini istisno qiladi.
   - Repozitoriyda birorta ham maxfiy kalit yoki parol mavjud emas.
