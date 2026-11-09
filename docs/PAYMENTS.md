# AniCity — To‘lov Tizimlari (Click va Payme)

AniCity platformasida O‘zbekistondagi ikkita asosiy milliy to‘lov tizimi — **Click.uz** va **Payme.uz** to‘liq integratsiya qilingan. Tizim avtomatlashtirilgan bo‘lib, foydalanuvchi to‘lov qilishi bilan uning profiliga VIP a’zolik beriladi.

---

## 1. To‘lov Arxitekturasi

Platformada to‘lov jarayoni 2 qismdan iborat:

1. **Frontend / Checkout (`/api/payments/checkout`):**
   - Foydalanuvchi `/premium` sahifasida kerakli tarifni tanlaydi va `Click` yoki `Payme` tugmasini bosadi.
   - Server foydalanuvchi sessiyasini tekshiradi, tarif narxini bazadan oladi va xavfsiz to‘lov havolasini tayyorlab beradi.
   - Foydalanuvchi Click yoki Payme rasmiy kassa sahifasiga o‘tadi.

2. **Backend Webhook (`/api/payments/webhook`):**
   - Click yoki Payme serveri to‘lov amalga oshgani haqida AniCity serveriga so‘rov (webhook) yuboradi.
   - Tizim imzoni tekshiradi, summani tarif narxi bilan solishtiradi va `user_subscriptions` jadvalida VIP muddatini faollashtiradi.

---

## 2. Click.uz Integratsiyasi

Click rasmiy protokoli bo‘yicha 2 bosqichli (**Prepare** va **Complete**) tizimda ishlaydi:

- **Prepare bosqichi (`action: 0`):**
  - Click foydalanuvchi mavjudligini va to‘lov summasini tekshiradi.
  - Bizning server summani tarif narxiga mos kelishini tekshiradi va tranzaksiyani `pending` holatda bazaga saqlaydi.
- **Complete bosqichi (`action: 1`):**
  - Pul yechilgach, Click yakuniy tasdiq yuboradi.
  - Server `merchant_prepare_id` va summani qayta solishtiradi, tranzaksiyani `completed` ga o‘tkazadi va foydalanuvchiga VIP obunani beradi.
- **Xavfsizlik:** Click MD5 imzosi `crypto.timingSafeEqual` orqali taqqoslanadi (Timing Attack xavfi yo‘q).

---

## 3. Payme.uz Integratsiyasi

Payme (Paycom) rasmiy **JSON-RPC 2.0** protokoli asosida ishlaydi:

- **CheckPerformTransaction:** Foydalanuvchi va to‘lov summasini (tiyinda) tekshirish.
- **CreateTransaction:** Tranzaksiya yaratish va uning holatini kuzatish.
- **PerformTransaction:** Pul muvaffaqiyatli yechilganda VIP obunani faollashtirish.
- **CancelTransaction:** To‘lov bekor qilinganda yoki pul qaytarilganda, foydalanuvchining faol VIP obunasini avtomatik bekor qilish (`cancelled`) va audit jurnaliga yozish.
- **CheckTransaction:** Tranzaksiya holatini tekshirish.
- **GetStatement:** Payme sertifikatsiyasi talab qiladigan vaqt oralig‘idagi tranzaksiyalar hisobotini qaytarish.

---

## 4. Jonli To‘lovni Sozlash (Merchant O‘rnatish)

Kod va protokollar to‘liq tayyor. Haqiqiy pul qabul qilishni boshlash uchun quyidagi amallar bajariladi:

### 1-qadam: Shartnoma tuzish
1. **Click:** [merchant.click.uz](https://merchant.click.uz) saytidan ariza topshirasiz (yuridik shaxs yoki YTT sifatida).
2. **Payme:** [business.payme.uz](https://business.payme.uz) orqali Paycom bilan shartnoma imzolaysiz.

### 2-qadam: Muhit o‘zgaruvchilarini kiritish
Shartnoma tuzilgach, berilgan kalitlarni Vercel Dashboard (yoki `.env.local`) ga kiritasiz:
```env
# Click Sozlamalari
CLICK_SERVICE_ID=sizning_service_id
CLICK_MERCHANT_ID=sizning_merchant_id
CLICK_SECRET_KEY=sizning_click_secret_key

# Payme Sozlamalari
PAYME_MERCHANT_ID=sizning_payme_merchant_id
PAYME_SECRET_KEY=sizning_payme_secret_key
```

### 3-qadam: Webhook manzillarini ko‘rsatish
Click va Payme kabinetlarida Webhook URL sifatida quyidagi manzillarni belgilaysiz:
- Click uchun: `https://sizning-domeningiz.uz/api/payments/webhook?provider=click`
- Payme uchun: `https://sizning-domeningiz.uz/api/payments/webhook?provider=payme`

Shundan so‘ng barcha to‘lovlar to‘liq avtomatik tarzda sizning hisob-raqamingizga tusha boshlaydi.
