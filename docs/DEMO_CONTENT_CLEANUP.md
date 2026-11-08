# AniCity — Pre-Launch Demo Content Purge & Clean-Slate Runbook

Ushbu yo‘riqnoma yangi xaridor yoki platforma egasiga sinov (test) animelari, izohlar va namuna qismlarini tozalab, platformani yangi kontent yuklash uchun 0 dan tayyorlash imkonini beradi.

---

## 1. Supabase SQL orqali Test Kontentni Tozalash

Agar siz barcha test animelari va epizodlarni o‘chirib, tizimni toza boshlamoqchi bo‘lsangiz, Supabase Dashboard → **SQL Editor** da quyidagi buyruqni bajaring:

```sql
-- 1. Epizodlar, ko'rish tarixi va sevimlilarni tozalash (Foreign keylar CASCADE bilan bog'langan)
DELETE FROM public.episodes;
DELETE FROM public.watch_progress;
DELETE FROM public.favorites;
DELETE FROM public.comments;
DELETE FROM public.ratings;
DELETE FROM public.trailers;

-- 2. Test animelarni tozalash
DELETE FROM public.animes;

-- 3. Obuna jurnallari va test tranzaksiyalarini tozalash (Admin akkauntlari saqlab qolinadi)
DELETE FROM public.subscription_transactions;
DELETE FROM public.subscription_audit_logs;
DELETE FROM public.user_subscriptions;

-- 4. Rate limit statistikasini yangilash
TRUNCATE TABLE public.rate_limits;
```

> **Eslatma:** Ushbu so‘rov administrator foydalanuvchilarini (`profiles`) va obuna tariflarini (`subscription_plans`) saqlab qoladi, faqat sinov animelari va epizodlarini tozalaydi.

---

## 2. Tozalashdan So‘ng Yangi Kontent Yuklash

1. Saytga kiring va administrator hisobingiz bilan tizimga kiring.
2. Yuqori o‘ng burchakdagi **Admin** tugmasini bosing (`/admin`).
3. **Animelar** bo‘limida yangi anime yarating (Sarlavha, Janrlar, Yil, Tavsif, Poster).
4. **Epizodlar** bo‘limida seriyalarni qo‘shing:
   - Google Drive havola orqali: `https://drive.google.com/file/d/.../view?usp=sharing`
   - Yoki to‘g‘ridan-to‘g‘ri HLS/MP4 oqim havolasi: `https://cdn.sizning-saytingiz.uz/.../master.m3u8`
