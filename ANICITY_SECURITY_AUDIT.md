# ANICITY — XAVFSIZLIK AUDITI HISOBOTI (SECURITY AUDIT)

**Sana:** 2026-11-02  
**Auditor:** Anicity Lead Security Engineer  
**Tekshirilgan Muhit:** Production (`https://anicity-app.vercel.app`), Supabase (`lngeosburovsxotywbfw`)  
**Umumiy Xavfsizlik Bahosi:** **A+ (A'lo)**

---

## 1. Topilgan va Tuzatilgan Zaifliklar Xulosasi

| № | Zaiflik Tavsifi | Dastlabki Daraja | Holat | Qo‘llanilgan Tuzatish |
|---|---|---|---|---|
| 1 | **Video URL Anonim Oqishi:** PostgREST API orqali `anon` foydalanuvchi `select=*` bilan epizodlarning `video_url` manzilini bevosita ko‘chirib olishi mumkin edi. | **High** | **Tuzatildi** | `public.episodes` jadvalidan `video_url` ustuniga `anon` huquqi bekor qilindi (`REVOKE`). Faqat xavfsiz metadata qoldirildi. |
| 2 | **Login Qilmasdan Film Ko‘rish:** Mehmon foydalanuvchi to‘g‘ridan-to‘g‘ri `/watch/...` sahifasiga kirganda pleer ochilayotgan edi. | **High** | **Tuzatildi** | `proxy.js` middleware'iga `/watch` qo‘shildi (`HTTP 307` redirect). Server komponentida ham qat'iy tekshiruv kiritildi. |
| 3 | **Admin Login Nomining Oshkor Bo‘lishi:** Ro‘yxatdan o‘tish formasidagi placeholder admin loginini ko‘rsatib turgan edi (`placeholder="masalan: sapayev1231"`). | **Medium** | **Tuzatildi** | Placeholder umumiy `masalan: animefan123` ga almashtirildi va barcha kodlar tozalandi. |
| 4 | **Open Redirect Xavfi:** Login va ro‘yxatdan o‘tishdan keyin `next` parametri begona saytlarga (`https://attacker.com`) yo‘naltirish xavfini tug‘dirishi mumkin edi. | **Medium** | **Tuzatildi** | `safeNext` funksiyasi kiritildi: havola qat'iy ravishda `/` bilan boshlanishi va `//` bilan boshlanmasligi tekshiriladi. |
| 5 | **Xavfsizlik HTTP Headerlarining Yetishmasligi:** Next.js javoblarida nosniff, frame-options kabi asosiy headerlar kiritilmagan edi. | **Low** | **Tuzatildi** | `next.config.mjs` da `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`, `Permissions-Policy` o‘rnatildi. |

---

## 2. Tafsilotli Xavfsizlik Tahlili

### A. Autentifikatsiya va Ruxsatlar (Authentication & Authorization)
- **Role Escalation Himoyasi:**
  - `public.profiles` jadvalida `authenticated` foydalanuvchilarga faqat `avatar_url`, `bio`, `display_name`, va `username` ustunlarini yangilashga ruxsat berilgan.
  - `role` va `suspended_at` ustunlariga PostgREST orqali UPDATE huquqi **berilmagan**.
  - Qo‘shimcha ravishda `profiles_guard` triggeri `current_user in ('anon', 'authenticated')` bo‘lganda rol o‘zgarishini `42501` xatosi bilan to‘xtatadi.
- **Admin Panel Himoyasi:**
  - `/admin` va `/admin/[id]/edit` sahifalari ham `proxy.js` orqali, ham server komponentida `isAdminRole(profile?.role)` tekshiruvi bilan himoyalangan. Oddiy foydalanuvchi admin panelga kira olmaydi (`redirect('/')`).

### B. Ma'lumotlar Bazasi va RLS (Row Level Security)
- Barcha 16 ta jadvalda RLS (`ROW LEVEL SECURITY`) faollashtirilgan.
- Foydalanuvchilarning shaxsiy ma'lumotlari (`favorites`, `watch_progress`, `watchlists`, `comments`, `notifications`) faqat `auth.uid() = user_id` bo‘lgandagina ko‘rinadi va o‘zgartiriladi.

### C. Google Drive Video Integratsiyasi Himoyasi
- **Soxta Domenlar Himoyasi:** `isDriveUrl()` regex tekshiruvi `drive.google.com.attacker.com` kabi soxta domenlarni to‘liq bloklaydi.
- **Papka Havolalarini Rad Etish:** `isDriveFolderUrl()` Google Drive papkalarini (`/drive/folders/...`) qabul qilmaydi va foydalanuvchiga xatolik ko‘rsatadi.
- **Havolani Xavfsiz Aylantirish:** Har qanday havola faqat `https://drive.google.com/file/d/{id}/preview` formatiga aylantirilib, iframe orqali ko‘rsatiladi.

### D. Maxfiylik va Kalitlar Xavfsizligi
- `SUPABASE_SERVICE_ROLE_KEY` hech qachon mijoz (brauzer) kodiga chiqarilmagan.
- Barcha maxfiy kalitlar faqat Vercel Environment Variables va lokal `.env.local` ichida saqlanadi.
- Git repozitoriyasiga hech qanday maxfiy kalit yoki parol commit qilinmagan.
