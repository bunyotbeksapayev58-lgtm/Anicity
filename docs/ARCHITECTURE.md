# AniCity — Tizim Arxitekturasi

AniCity — bu yuqori unumdorlikka ega, zamonaviy anime onlayn kinoteatr platformasi.

---

## 1. Texnologiyalar Steki

| Qatlam | Texnologiya | Vazifasi |
| :--- | :--- | :--- |
| **Frontend & Backend** | Next.js 16 (App Router) | Server-Side Rendering (SSR), Server Actions, API marshrutlari |
| **Foydalanuvchi interfeysi** | React 19 | Interaktiv komponentlar, Optimistic UI |
| **Ma’lumotlar bazasi** | Supabase (PostgreSQL 15+) | Relyatsion jadvallar, RLS xavfsizlik, Auth, RPC |
| **Kompilyator** | Next.js Turbopack | Tezkor build va sahifalar yig‘ilishi |
| **Video dvigateli** | Hls.js + HTML5 Video | Adaptiv oqim, ko‘p sifatli pleyer |
| **Deploy & Hosting** | Vercel Serverless | Global Edge tarmog‘i, avtomatik masshtablanish |

---

## 2. Papkalar Strukturasi

```
anicity/
├── app/                      # Next.js 16 App Router sahifalari
│   ├── actions/              # Server Actions (auth, admin, profil amallari)
│   ├── admin/                # Bosh admin paneli
│   ├── anime/[id]/           # Anime sahifasi (batafsil ma’lumot, treyler)
│   ├── api/                  # Backend REST va Webhook marshrutlari
│   │   ├── animes/           # Anime qidirish va olish
│   │   ├── payments/         # Click, Payme checkout va webhook
│   │   ├── progress/         # Ko‘rish daqiqasini saqlash
│   │   └── video/token/      # Imzolangan video token berish
│   ├── assistant-admin/      # Moderatorlar uchun cheklangan panel
│   ├── catalog/              # Janr va yil bo‘yicha filtrlar katalogi
│   ├── premium/              # VIP obunalar va Click/Payme to‘lov
│   ├── watch/[animeId]/[num] # Video tomosha qilish sahifasi
│   ├── layout.js             # Asosiy dizayn va navigatsiya
│   └── page.js               # Bosh sahifa (Hero banner, trendlar)
├── components/               # UI komponentlari (Player, Navbar, Cards)
├── docs/                     # Loyiha qo‘llanmalari (6 ta asosiy qo‘llanma)
├── lib/                      # Biznes mantiq, xavfsizlik, to‘lovlar
│   ├── payments/             # Click va Payme protokollari
│   ├── rate-limit.js         # Taqsimlangan rate limiter
│   └── subscriptions.js      # Obuna hisoblash algoritmlari
├── supabase/migrations/      # 19 ta PostgreSQL migratsiyasi
└── tests/                    # 25 ta avtomatlashgan regressiya testlari
```

---

## 3. Xavfsizlik Tamoyillari

1. **Zero Secret Leakage:** Repozitoriyda va mijoz kodida birorta ham maxfiy kalit (`service_role`, `secret_key`) ochiq qoldirilmagan.
2. **Kriptografik Tokenlar:** Videolar HMAC-SHA256 imzosi bilan himoyalangan, to‘lov imzolari `crypto.timingSafeEqual` bilan solishtiriladi.
3. **Taqsimlangan Rate Limiting:** Vercel serverless instansiyalari o‘rtasida umumiy brute-force himoyasi (`rate_limits` jadvali va `check_rate_limit` RPC).
4. **Content Security Policy (CSP):** XSS va Clickjacking hujumlaridan himoya qilish uchun qat’iy CSP va xavfsizlik sarlavhalari sozlangan.
