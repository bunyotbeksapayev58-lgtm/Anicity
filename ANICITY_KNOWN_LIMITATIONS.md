# ANICITY — TEXNIK CHEKLOVLAR VA XUSUSIYATLAR (KNOWN LIMITATIONS)

Ushbu hujjat Anicity tizimining me'moriy xususiyatlari, tashqi xizmatlar integratsiyasi va xolis texnik cheklovlarini yoritadi.

---

## 1. Google Drive Video Pleyeri Cheklovlari

1. **Cross-Origin Iframe va Vaqtni Avtomatik Saqlash Cheklovi:**
   - Google Drive videolari saytga xavfsiz `<iframe>` ko‘rinishida joylashtiriladi (`https://drive.google.com/file/d/{id}/preview`).
   - Brauzerlarning Same-Origin Policy (SOP) xavfsizlik qoidasi tufayli tashqi domen (Google) dagi iframe ichidagi video ijrosining aniq sekundlarini (`currentTime`, `duration`, `ended` hodisalari) tashqi JavaScript o‘qiy olmaydi.
   - **Qabul qilingan yechim:** Direct MP4/WebM videolari uchun `<Player>` to‘liq avtomatlashtirilgan. Google Drive iframelari uchun esa foydalanuvchiga qulay "✓ Ko‘rildi deb belgilash" (Mark as watched) tugmasi va "Oldingi / Keyingi qism" navigatsiyasi taqdim etilgan.

2. **Google Drive Fayl Ruxsatlari va Oqim Himoyasi:**
   - Google Drive orqali yuklangan har bir video fayl Google Drive sozlamalarida *"Havolaga ega bo‘lgan har bir kishi (Anyone with the link)"* ko‘rish rejimida bo‘lishi shart.
   - Bizning backend va Supabase RLS tizimimiz ushbu havolani tizimga kirmagan mehmonlarga yuborilishini 100% bloklaydi.
   - Biroq, autentifikatsiyadan o‘tgan foydalanuvchi videoni tomosha qilayotganda brauzer tarmog‘i (Network Inspector) orqali iframe manbasini ko‘rishi mumkin. Bu Google Drive embed texnologiyasining tabiiy xususiyati bo‘lib, to‘liq DRM (Digital Rights Management) himoyasi uchun kelajakda Cloudflare Stream, AWS CloudFront Signed URLs yoki HLS shifrlash kabi ixtisoslashgan video hostinglardan foydalanish tavsiya etiladi.

---

## 2. Supabase Bepul Tarifi Cheklovlari

1. **Loyiha Soni:**
   - Supabase bepul tarifi (Free Plan) hisobda ko‘pi bilan 2 ta faol loyihaga ruxsat beradi. Shu sababli mavjud `lngeosburovsxotywbfw` loyihasi Anicity uchun to‘liq moslashtirildi.
2. **Storage Fayl Hajmi Cheklovlari:**
   - `posters`: maksimal 3 MB.
   - `anime-banners`: maksimal 5 MB.
   - `episode-thumbnails`: maksimal 2 MB.
   - `profile-avatars`: maksimal 2 MB.
   - `site-assets`: maksimal 5 MB.

---

## 3. Google OAuth Faollashtirish Talabi

- Dastur kodi va UI ("Google bilan kirish" tugmasi, redirect handler va `handle_new_user()` bazaviy triggeri) 100% tayyor va sinovdan o‘tkazilgan.
- Google orqali kirish haqiqiy foydalanuvchilar uchun ishlashi uchun Google Cloud Console’da Web Client ID olinishi va Supabase Dashboard’ga kiritilishi talab etiladi (qarang: `ANICITY_DEPLOYMENT_GUIDE.md`).
