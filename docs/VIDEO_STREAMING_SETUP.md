# 🎬 ANICITY — VIDEO STREAMING VA HOSTING QO‘LLANMASI
**Eng arzon, barqaror va professional video striming yechimlari bo‘yicha qo‘llanma**

Ushbu qo‘llanma AniCity platformasi xaridori yoki administratori uchun tayyorlangan bo‘lib, videolarni eng arzon narxda, yuqori sifatda va uzluksiz uzatish yo‘llarini tushuntiradi.

---

## 1. Nega Google Drive tavsiya etilmaydi?
Loyiha Google Drive havolalarini (`drive:FILE_ID`) to‘liq qo‘llab-quvvatlaydi va bu yangi boshlovchilar uchun bepul variant hisoblanadi. Biroq:
- **Kvotali bloklanish:** Google Drive bir kunda faylni ko‘p marta yuklab olgan foydalanuvchilar soni oshganda `403 Quota Exceeded` xatosini beradi va video ochilmay qoladi.
- **Trafik nazoratsizligi:** Next.js proksi orqali o‘tkazilganda serveringizning oylik bandwith limiti tez tugaydi.

Shu sababli, **tijoriy va minglab foydalanuvchilarga xizmat ko‘rsatadigan sayt uchun quyidagi professional va arzon yechimlar tavsiya etiladi:**

---

## 2. ENG ARZON VA SIFATLI YECHIM: Bunny.net Stream ⭐ (Tavsiya etiladi)

Bunny.net — dunyodagi eng arzon va eng tezkor video striming CDN xizmati hisoblanadi.

### 💰 Narxi:
- **Video saqlash (Storage):** Oyiga $0.01 / GB (1,000 GB video saqlash atigi **$10** bo‘ladi!).
- **Trafik (Bandwidth):** $0.005 / GB (1,000 GB tomosha qilish atigi **$5**!).
- **Avtomatik Transcoding:** Bepul! Siz bitta MP4 yuklaysiz, tizim o‘zi **360p, 480p, 720p, 1080p** formatlariga o‘tkazib, HLS `.m3u8` yaratadi.

### 🚀 Qanday ulanadi? (5 daqiqada):
1. [bunny.net](https://bunny.net) saytidan ro‘yxatdan o‘ting va hisobingizga $10 mablag‘ tashlang.
2. Chap menyudan **Stream** bo‘limiga kiring va **"Add Video Library"** tugmasini bosing (Masalan: `anicity-videos`).
3. Video kutubxonangiz nomini va eng yaqin CDN zonasini (Europe / Middle East) tanlang.
4. Istalgan anime qismini (MP4) yuklang.
5. Yuklangach, videoning **Direct Play URL (HLS)** yoki **Video ID**sini oling:
   - Masalan: `https://vz-xxxxxxxx.b-cdn.net/f3a8b2c1-xxxx-xxxx/playlist.m3u8`
   - Yoki qisqacha: `bunny:f3a8b2c1-xxxx-xxxx`
6. Admin panelda yangi qism qo‘shganda shu havolani joylashtiring. 
7. AniCity pleyeri avtomatik tarzda 360p–1080p sifat selektorini va HLS oqimini ko‘rsatadi!

---

## 3. IKKINCHI YECHIM: Cloudflare R2 (Tekin Egress / Trafik) ⚡

Cloudflare R2 — Amazon S3 bilan bir xil, lekin **chiqish trafigi (Egress bandwidth) 100% BEPUL!**

### 💰 Narxi:
- **Saqlash:** $0.015 / GB oyiga.
- **Trafik:** $0.00 (Mutlaqo cheksiz bepul!).

### 🚀 Qanday ishlatiladi?
1. Videolaringizni FFmpeg yordamida HLS formatiga o‘giring:
   ```bash
   ffmpeg -i episode1.mp4 -codec: copy -start_number 0 -hls_time 10 -hls_list_size 0 -f hls master.m3u8
   ```
2. Fayllarni Cloudflare R2 dagi bucket’ga yuklang va Public Access’ni yoqing.
3. AniCity Admin paneliga HLS havolasini kiriting:
   `https://pub-xxxxxxxx.r2.dev/anime/naruto/ep1/master.m3u8`

---

## 4. UCHINCHI YECHIM: O‘zbekistondagi mahalliy Storage / VPS

Agar videolarni TAS-IX ichida tekin va tez ko‘rsatishni istasangiz:
- O‘zbekistondagi istalgan xosting provayderidan (Billur, Sarkor, Cloud.uz, Vscale) 1–2 TB diskli oddiy arzon VPS yoki Storage oling.
- Nginx o‘rnating va videolarni to‘g‘ridan-to‘g‘ri MP4 yoki HLS qilib tarqating:
  `https://cdn.sizning-domeningiz.uz/episodes/code-geass-01.mp4`

---

## 5. Xulosa va Taqqoslash Jadvali

| Provayder | 1,000 GB Video Saqlash | 5,000 GB Oylik Tomosha | Sifat tanlash (360p–1080p) | Tavsiya |
|---|---|---|---|---|
| **Bunny.net Stream** | **$10 / oy** | **$25 / oy** | **Avtomatik HLS** | ⭐⭐⭐⭐⭐ (Eng yaxshi) |
| **Cloudflare R2** | $15 / oy | **$0 / oy (Bepul!)** | Qo‘lda HLS qilish kerak | ⭐⭐⭐⭐ |
| **Google Drive** | $0–$10 / oy | Limitga uriladi (403) | Yo‘q | ⭐⭐ (Faqat test uchun) |
| **AWS S3 / CloudFront** | $23 / oy | $425 / oy (Qimmat!) | AWS MediaConvert kerak | ⭐ (Juda qimmat) |

AniCity platformasi yuqoridagi barcha provayderlar bilan mos keladigan universal video pleyer arxitekturasiga ega.
