# AniCity — Admin Panel va Kontent Boshqaruvi

Ushbu qo‘llanma **AniCity** platformasining ma’murlari va moderatorlari uchun tayyorlangan. Unda yangi animelarni joylash, qismlarni biriktirish, foydalanuvchilar va obunalarni boshqarish amallari tushuntirilgan.

---

## 1. Admin panelga kirish

Admin panelga kirish manzillari:
- **Bosh adminlar uchun:** `/admin`
- **Yordamchi adminlar (moderatorlar) uchun:** `/assistant-admin`

Panelga faqat profilingizdagi roli `owner`, `admin` yoki `assistant` bo‘lgan foydalanuvchilar kira oladi. Oddiy foydalanuvchilar yoki mehmonlar bu sahifaga kirmoqchi bo‘lsa, tizim ularni avtomatik `/login` sahifasiga yo‘naltiradi.

---

## 2. Yangi Anime qo‘shish

1. `/admin` sahifasini oching va **"Yangi Anime Qo‘shish"** tugmasini bosing.
2. Quyidagi maydonlarni to‘ldiring:
   - **Sarlavha (Title):** Animening asosiy nomi (masalan: *Code Geass: Qo‘zg‘olonchi Lelush*).
   - **Muqobil nom (Alt Title):** Inglizcha yoki yaponcha nomi.
   - **Chiqarilgan yili (Year):** Masalan: 2006.
   - **Holati (Status):** *Tugallangan* yoki *Davom etmoqda*.
   - **Janrlar (Genres):** Mos janrlarni vergul bilan kiriting (masalan: *Sarguzasht, Fantastika, Drama*).
   - **Tavsif (Description):** Anime sujeti haqida qisqacha ma’lumot.
   - **Poster va Banner:** Rasm havolalari (http/https formatida).
   - **VIP Anime:** Agar butun anime faqat VIP a’zolar uchun bo‘lishini xohlasangiz, `is_vip_only` belgisini yoqing.
3. **"Saqlash"** tugmasini bosing. Anime katalogda paydo bo‘ladi.

---

## 3. Qismlar (Epizodlar)ni boshqarish

Anime yaratilgandan so‘ng, uning sahifasiga kirib **"Qismlar boshqaruvi"** bo‘limiga o‘tasiz:

### Qism qo‘shish:
- **Fasl (Season):** Odatda 1.
- **Qism raqami (Number):** 1, 2, 3...
- **Sarlavha:** Masalan: *1-qism: Yangi boshlanish*.
- **Video havolasi (Video URL):** 
  - Google Drive havolasi (masalan: `https://drive.google.com/file/d/.../view`),
  - HLS oqimi (`.m3u8` havola),
  - Yoki to‘g‘ridan-to‘g‘ri MP4 havola.
- **VIP talabi (Requires VIP):** Agar ushbu qism faqat pullik a’zolarga ko‘rinishini xohlasangiz, shu katakchani belgilaysiz (masalan, dastlabki 3 ta qismni bepul, qolganlarini VIP qilib qo‘yish mumkin).

---

## 4. Foydalanuvchilar va Rollarni boshqarish

Admin panelining **"Foydalanuvchilar"** bo‘limida barcha ro‘yxatdan o‘tgan foydalanuvchilar ro‘yxati turadi:
- **Owner (Loyiha egasi):** Cheksiz huquqlar.
- **Admin:** Barcha bo‘limlarni boshqara oladi, narxlarni o‘zgartiradi, boshqalarga rol bera oladi.
- **Assistant (Yordamchi):** Faqat kontent (anime va qismlar) qo‘sha oladi, billing yoki boshqa adminlar rolini o‘zgartira olmaydi.
- **User:** Oddiy tomoshabin.

### Foydalanuvchini bloklash (Ban/Suspend):
Agar qaysidir foydalanuvchi qoidalarni buzsa, uning kartasidagi **"Bloklash"** tugmasi orqali uning hisobini vaqtincha yoki butunlay to‘xtatib qo‘yish mumkin. Bloklangan foydalanuvchi tizimga kira olmaydi.

---

## 5. Qo‘lda VIP berish va Audit jurnali

Ba’zida foydalanuvchi to‘lovni karta orqali tashlab berganda yoki konkursda yutganda, unga qo‘lda VIP berish talab etiladi:
1. Foydalanuvchi profiliga o‘ting.
2. **"VIP Berish"** tugmasini bosib, tarif rejasi (1 oylik, 3 oylik, 1 yillik) va sababini tanlaysiz.
3. Tizim avtomatik uning hisobiga VIP muddatini qo‘shadi.
4. Barcha qo‘lda berilgan VIP amallari **`subscription_audit_logs`** jadvaliga qayd etiladi: qaysi admin, qachon, kimga va nega VIP bergani doimo saqlanib turadi.
