# AniCity — Ma’lumotlar Bazasi va Sxemalar

AniCity ma’lumotlar bazasi **Supabase Managed PostgreSQL** asosida ishlaydi. Tizim qat’iy relyatsion qoidalar, xavfsiz RLS (Row Level Security) siyosatlari va avtomatlashtirilgan triggerlar bilan himoyalangan.

---

## 1. Migratsiyalar Ketma-ketligi (`supabase/migrations/`)

Bazadagi barcha jadvallar, indekslar va funksiyalar 19 ta tartibli migratsiya orqali boshqariladi:

| Migratsiya | Tavsifi |
| :--- | :--- |
| `001_core_schema.sql` | Asosiy jadvallar: `profiles`, `animes`, `seasons`, `episodes`, `subtitles`, `ratings`, `favorites`, `watch_history`. |
| `002_indexes.sql` | Tezkor qidiruv va filtrlash uchun indekslar (`gin_trgm`, `btree`). |
| `003_functions_triggers.sql` | Avtomatik `updated_at`, reyting hisoblash va audit triggerlari. |
| `004_storage_buckets.sql` | Avatarlar va bannerlar uchun Supabase Storage chelaklari. |
| `005_rls_policies.sql` | Ommaviy va avtorizatsiyalangan foydalanuvchilar uchun RLS siyosatlari. |
| `006_demo_seed.sql` | Dastlabki sinov ma’lumotlari (namunaviy animelar). |
| `007_trailers.sql` | Animelarga YouTube treylerlarini biriktirish imkoniyati. |
| `008_admin_decoupled_episodes.sql` | Animeni epizodlarsiz ham yaratish va saqlash erkinligi. |
| `009_subscriptions_system.sql` | VIP tariflar (`subscription_plans`), tranzaksiyalar (`subscription_transactions`) va audit loglari. |
| `010_video_banners.sql` | Bosh sahifa hero bo‘limida fon videosini o‘ynatish mexanizmi. |
| `011_schema_security_repairs.sql` | Xavfsizlik tuzatishlari va cheklovlar. |
| `012_profile_usernames_and_avatars.sql` | Unikal username va avatar saqlash qoidalari. |
| `013_profiles_assistant_admins.sql` | Yordamchi adminlar (moderatorlar) uchun alohida ruxsatlar. |
| `014_assistant_permissions.sql` | Moderatorlarning huquqlarini batafsil sozlash jadvali. |
| `015_assistant_security_audit_fixes.sql` | Ruxsatnomalar ustidan qo‘shimcha nazorat funksiyalari. |
| `016_episode_replacement_identity.sql` | Epizodlarni almashtirishda unikal indekslarni saqlash. |
| `017_distributed_rate_limiting.sql` | Vercel Serverless uchun umumiy atomik rate limit jadvali (`rate_limits`) va `check_rate_limit` RPC. |
| `018_vip_access_columns.sql` | Baza darajasida VIP himoyasi: `episodes.requires_vip` va `animes.is_vip_only` ustunlari. |

---

## 2. Asosiy Jadvallar

### `public.animes`
- `id` (UUID, Primary Key)
- `title` (TEXT) — animening nomi
- `alt_title` (TEXT) — ikkinchi nomi
- `description` (TEXT) — tavsifi
- `year` (INT) — chiqarilgan yili
- `status` (TEXT) — "Tugallangan" yoki "Davom etmoqda"
- `genres` (TEXT[]) — janrlar massivi
- `poster_url`, `banner_url` (TEXT)
- `is_vip_only` (BOOLEAN) — faqat VIP a’zolar uchun ekanligi

### `public.episodes`
- `id` (UUID, Primary Key)
- `anime_id` (UUID, FK -> animes.id)
- `season_number` (INT) — fasl raqami (default: 1)
- `number` (INT) — qism raqami
- `title` (TEXT) — qism nomi
- `video_url` (TEXT) — video manzili (Google Drive, HLS yoki MP4)
- `quality` (TEXT) — masalan: '1080p', '4K'
- `requires_vip` (BOOLEAN) — ushbu qismni ko‘rish uchun VIP kerakligi
- `is_published` (BOOLEAN) — qism ommaga ko‘rinishi

### `public.subscription_plans`
- `id` (UUID, Primary Key)
- `name` (TEXT) — "1 Oylik VIP", "3 Oylik VIP", "1 Yillik VIP"
- `slug` (TEXT)
- `price_uzs` (BIGINT) — so‘mdagi narxi (masalan: 25000)
- `duration_days` (INT) — kunlar soni (30, 90, 365)
- `benefits` (TEXT[]) — imtiyozlar ro‘yxati
- `is_active` (BOOLEAN) — sotuvda ochiqligi

### `public.user_subscriptions`
- `id` (UUID, Primary Key)
- `user_id` (UUID, FK -> profiles.id)
- `plan_name` (TEXT)
- `status` (TEXT) — 'active', 'expired', 'cancelled'
- `starts_at` (TIMESTAMPTZ)
- `expires_at` (TIMESTAMPTZ) — obuna tugash sanasi

### `public.subscription_transactions`
- `id` (UUID, Primary Key)
- `transaction_id` (TEXT, UNIQUE) — provayder tranzaksiya ID si
- `user_id` (UUID)
- `plan_id` (UUID)
- `amount_uzs` (BIGINT)
- `provider` (TEXT) — 'click', 'payme', 'manual'
- `status` (TEXT) — 'pending', 'completed', 'failed', 'cancelled'

---

## 3. Xavfsizlik (Row Level Security — RLS)

- Har bir jadvalda RLS faollashtirilgan (`ENABLE ROW LEVEL SECURITY`).
- Oddiy foydalanuvchilar faqat o‘zlariga tegishli profil, ko‘rishlar tarixi va obunalarini o‘qiy oladi.
- Ommaviy API marshrutlarida (`/api/animes/[id]`) epizodlarning to‘g‘ridan-to‘g‘ri `video_url` manzili berilmaydi, faqat imzolangan video token orqali ruxsat etiladi.
- Administratorlik huquqlari server-side `is_admin()` funksiyasi orqali tekshiriladi.
