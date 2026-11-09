# AniCity — Video Oqim va Hosting Qo‘llanmasi

AniCity video pleyeri ko‘p formatli (universal) arxitekturaga ega. Siz platformani bitta provayderga bog‘lab qo‘ymasdan, o‘z imkoniyatingiz va byudjetingizga qarab turli xil video manbalaridan foydalanishingiz mumkin.

---

## 1. Qo‘llab-quvvatlanadigan Formatlar

1. **Google Drive Embed:**
   - Google Drive havolasini shunchaki qism videosi sifatida kiritasiz (masalan: `https://drive.google.com/file/d/XXX/view`).
   - Pleyer uni avtomatik taniydi, anti-popout himoyasini qo‘llaydi va toza ekranda namoyish qiladi.
   - **Afzalligi:** 100% bepul, boshlanishiga 0 xarajat bilan ishga tushirish uchun ideal.

2. **HLS Adaptiv Oqim (.m3u8):**
   - Hls.js dvigateli orqali tomoshabin internet tezligiga qarab avtomatik sifatni o‘zgartiradi (1080p, 720p, 480p, 360p).
   - Foydalanuvchi pleyer sozlamalari orqali sifatni o‘zi ham tanlashi mumkin.
   - Safari brauzerlarida Apple Native HLS orqali ishlaydi.

3. **To‘g‘ridan-to‘g‘ri MP4 / WebM:**
   - O‘zingizning VPS yoki fayl serveringizdagi to‘g‘ridan-to‘g‘ri video havolasi.

---

## 2. Videolarni Qayerda Saqlash Tavsiya Etiladi?

### 1-o‘rin: Bunny.net (Bunny Stream) — *Eng tavsiya etiladigan professional yechim* 🏆
- **Nima uchun:** Video streaming bo‘yicha dunyodagi eng arzon va qulay xizmat.
- **Narxi:** 1 GB video saqlash oyiga taxminan **$0.01** (1000 ta anime qismi saqlash oyiga $3–$5 atrofida tushadi).
- **Qulayliklari:**
  - Videoni yuklaysiz, tizim o‘zi uni avtomatik 1080p, 720p, 480p HLS formatga o‘girib beradi.
  - Video o‘g‘irlanishi yoki skachat qilinishidan himoyalangan tokenli tizim mavjud.
  - O‘zbekiston va Markaziy Osiyoga yaqin serverlari bor, video qotmasdan yuklanadi.

### 2-o‘rin: Google Drive — *Boshlanishiga 0 xarajat*
- **Nima uchun:** Loyihani yangi boshlaganda serverlarga ortiqcha xarajat qilmaslik uchun.
- **Cheklovi:** Agar bitta video juda ko‘p ko‘rilsa, Google 24 soatlik ko‘rish limitini qo‘yishi mumkin ("Playback limit exceeded").

### 3-o‘rin: Cloudflare Stream
- **Nima uchun:** Maksimal darajada himoyalangan korporativ video infratuzilma.
- **Narxi:** 1000 daqiqa video uchun $5/oy (Bunny.net ga qaraganda 2–3 baravar qimmatroq).

> ⚠️ **Muhim eslatma:** Supabase Storage’da video saqlash tavsiya etilmaydi! Supabase rasmlar (poster, avatar) va ma’lumotlar bazasi uchun mo‘ljallangan, uning oylik video trafiki (egress bandwidth) juda tez tugaydi va qimmatga tushishi mumkin.

---

## 3. Video Himoyasi va VIP Paywall

- **Server-Side VIP Tekshiruv:** Foydalanuvchi video ko‘rishni boshlaganda, server uning faol obunasi borligini tekshiradi.
- **HMAC Imzoli Token:** Ruxsat berilganda `/api/video/token` orqali muddati cheklangan (masalan, 3 soatlik) kriptografik HMAC-SHA256 token beriladi.
- **Data Leak Himoyasi:** Ommaviy anime API (`/api/animes/[id]`) da `video_url` ustuni hech qachon mijozga ko‘rsatilmaydi.
