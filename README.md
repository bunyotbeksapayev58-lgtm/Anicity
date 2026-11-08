# AniCity — Professional Anime Streaming Platform

> **Full-Stack Anime Streaming, Community & Monetization Engine**  
> Texnologiyalar: **Next.js 16 (App Router)** • **React 19** • **Supabase (PostgreSQL & Auth)** • **Vercel**

- 🌐 **Jonli ko‘rish (Production):** [https://anicity-app.vercel.app](https://anicity-app.vercel.app)
- 📦 **Versiya:** 1.0.0 (Tijoriy sotuvga to‘liq tayyor nashr)
- 🧪 **Avtomatlashgan testlar:** 25 ta to‘liq test to‘plami (100% muvaffaqiyatli)

---

## ⚡ Asosiy Imkoniyatlar

1. **Zamonaviy Kinematik UI/UX:**
   - Dark neo-cyber dizayn, responsive 360px mobil ekranlardan 4K monitorlargacha moslashuvchan.
   - Bosh sahifa hero banneri, trenddagi, yangi premyeralar, yuqori baholanganlar va tavsiyalar bo‘limlari.
   - Haftalik relizlar jadvali (Dushanba–Yakshanba).
   - Janrlar bo‘yicha ko‘p qirrali filtr va tezkor qidiruv tizimi.

2. **Ko‘p Formatli Video Pleyer:**
   - **Mehmon rejimi (Guest Mode):** Yangi foydalanuvchilar ro‘yxatdan o‘tmasdan bepul qismlarni tomosha qila oladi.
   - **Google Drive Embed:** Google Drive havolalari orqali tekin va oson oqimli video namoyishi (Anti-popout himoyasi bilan).
   - **HLS (.m3u8) & Direct MP4:** Hls.js adaptiv oqim (multi-quality 1080p/720p/480p) va server-side HMAC kriptografik video tokenlari (`/api/video/token`).
   - Mobil moslashuvchan pleyer (360px, 375px, 390px, 430px) va fullscreen/teatr rejimlari.

3. **Monetizatsiya va VIP Obuna:**
   - O‘zbekiston milliy to‘lov tizimlari: **Click.uz** (Prepare/Complete 2 bosqichli MD5 protokoli) va **Payme.uz** (JSON-RPC 2.0 protokoli).
   - Avtomatlashtirilgan VIP faollashtirish, obuna muddatini hisoblash va audit jurnali (`subscription_audit_logs`).
   - VIP qismlar va 4K sifat uchun xavfsiz avtomatik paywall.

4. **Keng Qamrovli Boshqaruv (Admin & Assistant Panel):**
   - Anime va epizodlarni mustaqil yaratish (decoupled anime creation).
   - Epizodlarni almashtirish, sifatini belgilash va treylerlar biriktirish.
   - Foydalanuvchi rollarini boshqarish (`owner`, `admin`, `assistant`, `user`).
   - Yordamchi adminlar uchun cheklangan huquqlar tizimi (`assistant_permissions`).

5. **Xavfsizlik va Ma’lumotlar Bazasi:**
   - Supabase PostgreSQL: 18 ta ketma-ket tartibli migratsiya (001–017).
   - Qator darajasidagi to‘liq xavfsizlik (Row Level Security — RLS).
   - Vercel Serverless uchun taqsimlangan atomik rate limiting (`rate_limits` jadvali va `check_rate_limit` RPC).
   - Kriptografik xavfsizlik: Xaridor paketida hech qanday maxfiy kalitlar (secrets) qoldirilmagan.

6. **Huquqiy va SEO Asoslari:**
   - Dinamik `/sitemap.xml` va `/robots.txt`.
   - Tayyor huquqiy sahifalar: `/dmca` (Mualliflik huquqi), `/terms` (Foydalanish shartlari), `/privacy` (Maxfiylik siyosati).

---

## 🚀 Tezkor Ishga Tushirish

### 1. Talablar
- Node.js 20+ yoki 22+
- npm yoki pnpm
- Supabase hisobi (bepul yoki Pro)

### 2. O‘rnatish va muhitni sozlash
```bash
# 1. Repozitoriy papkasiga kiring
cd anicity

# 2. Bog'liqliklarni o'rnating
npm install

# 3. Muhit o'zgaruvchilari faylini nusxalang
cp .env.example .env.local
```

`.env.local` faylini ochib, Supabase Dashboard (`Project Settings -> API`) dagi manzillarni kiriting:
```env
NEXT_PUBLIC_SUPABASE_URL=https://sizning-loyihangiz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sizning_anon_kalitingiz
SUPABASE_SERVICE_ROLE_KEY=sizning_service_role_kalitingiz
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 3. Testlarni tekshirish
```bash
npm test
```
*Barcha 25 ta regressiya testlari 100% muvaffaqiyatli yakunlanadi.*

### 4. Dasturchi rejimida ishga tushirish
```bash
npm run dev
```
Brauzerda oching: [http://localhost:3000](http://localhost:3000)

### 5. Production Build
```bash
npm run build
```
*Next.js Turbopack 18 ta marshrutni to‘liq yig‘adi.*

---

## 📚 Hujjatlar Katalogi (`docs/`)

Loyihaning barcha texnik va biznes yo‘riqnomalari `docs/` papkasida to‘liq jamlangan:

1. 📄 **[BUYER_HANDOVER.md](docs/BUYER_HANDOVER.md)** — Yangi xaridor uchun to‘liq loyihani qabul qilib olish va boshqaruv yo‘riqnomasi.
2. 🛡️ **[ADMIN_GUIDE.md](docs/ADMIN_GUIDE.md)** — Administrator paneli, anime va qismlarni yuklash, rollar va moderatsiya.
3. 🗄️ **[DATABASE.md](docs/DATABASE.md)** — Supabase PostgreSQL arxitekturasi, ERD sxemasi va 18 ta SQL migratsiya ro‘yxati.
4. 💳 **[PAYMENTS.md](docs/PAYMENTS.md)** — Click.uz va Payme.uz to‘lov protokoli, sandbox sinovlari va webhook sozlamalari.
5. 🎬 **[VIDEO_STREAMING.md](docs/VIDEO_STREAMING.md)** — Google Drive, HLS va MP4 video yetkazib berish va HMAC xavfsizlik arxitekturasi.
6. 🏗️ **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** — Tizim arxitekturasi, komponentlar iyerarxiyasi va ma’lumotlar oqimi.

---

## ⚖️ Mualliflik Huquqi va Kontent Eslatmasi

AniCity — bu to‘liq tayyor anime veb-platformasi (Dasturiy Dvigatel / SaaS Engine).
Platformani sotib olgan yangi egasi o‘z platformasiga yuklaydigan barcha anime videolari, audio dublyajlari va rasmlari uchun o‘zi litsenziya oladi yoki ochiq/mualliflik roziligi bo‘lgan materiallarni joylashtiradi. Saytda DMCA bildirishnomalari uchun tayyor avtomatlashtirilgan mexanizm va `/dmca` sahifasi integratsiya qilingan.
