-- =====================================================================
-- 001 — Yadro sxema: barcha jadvallar, ustunlar va inline cheklovlar
-- Toza (bo'sh) public sxemaga mo'ljallangan. "if not exists" tufayli
-- qayta ishga tushirish xato bermaydi.
-- Ilova (Next.js) ishlatadigan ustun nomlari o'zgartirilmagan.
-- =====================================================================

-- ---------- profiles: foydalanuvchi profili (auth.users bilan 1:1) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  role text not null default 'user'
    constraint profiles_role_check check (role in ('user', 'moderator', 'admin', 'owner')),
  display_name text,
  avatar_url text,
  bio text constraint profiles_bio_len check (bio is null or char_length(bio) <= 500),
  suspended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- animes ----------
create table if not exists public.animes (
  id uuid primary key default gen_random_uuid(),
  title text not null constraint animes_title_len check (char_length(title) between 1 and 200),
  alt_title text,
  description text default '',
  year int constraint animes_year_range check (year is null or year between 1960 and 2100),
  type text not null default 'tv' constraint animes_type_valid check (type in ('tv', 'movie', 'ova', 'ona', 'special')),
  status text default 'Tugallangan'
    constraint animes_status_valid check (status in ('Tugallangan', 'Davom etmoqda')),
  genres text[] not null default '{}',
  studio text,
  director text,
  poster_url text,
  banner_url text,
  is_published boolean not null default true,
  rating_avg numeric(4,2) not null default 0 constraint animes_rating_range check (rating_avg between 0 and 10),
  rating_count int not null default 0 constraint animes_rating_count_nonneg check (rating_count >= 0),
  view_count bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- seasons (episodes dan oldin yaratiladi: FK uchun) ----------
create table if not exists public.seasons (
  id uuid primary key default gen_random_uuid(),
  anime_id uuid not null references public.animes(id) on delete cascade,
  number int not null constraint seasons_number_positive check (number > 0),
  title text,
  created_at timestamptz not null default now(),
  unique (anime_id, number)
);

-- ---------- episodes ----------
create table if not exists public.episodes (
  id uuid primary key default gen_random_uuid(),
  anime_id uuid not null references public.animes(id) on delete cascade,
  season_id uuid references public.seasons(id) on delete set null,
  number int not null constraint episodes_number_positive check (number > 0),
  title text,
  video_url text not null constraint episodes_url_http check (video_url ~* '^https?://'),
  thumbnail_url text,
  is_published boolean not null default true,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (anime_id, number)
);

-- ---------- episode_subtitles ----------
create table if not exists public.episode_subtitles (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references public.episodes(id) on delete cascade,
  language text not null constraint subtitles_language_len check (char_length(language) between 2 and 10),
  label text not null constraint subtitles_label_len check (char_length(label) between 1 and 60),
  url text not null constraint subtitles_url_http check (url ~* '^https?://'),
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- favorites (ilova: upsert onConflict user_id,anime_id) ----------
create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  anime_id uuid not null references public.animes(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, anime_id)
);

-- ---------- watch_progress (ilova: upsert onConflict user_id,episode_id) ----------
-- Tarix (watch history) shu jadvaldan olinadi: har qism uchun oxirgi holat.
create table if not exists public.watch_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  episode_id uuid not null references public.episodes(id) on delete cascade,
  anime_id uuid not null references public.animes(id) on delete cascade,
  position_sec double precision not null default 0 constraint progress_position_nonneg check (position_sec >= 0),
  duration_sec double precision not null default 0 constraint progress_duration_nonneg check (duration_sec >= 0),
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, episode_id)
);

-- ---------- watchlists ----------
create table if not exists public.watchlists (
  user_id uuid not null references auth.users(id) on delete cascade,
  anime_id uuid not null references public.animes(id) on delete cascade,
  status text not null default 'plan_to_watch'
    constraint watchlists_status_valid check (status in ('plan_to_watch', 'watching', 'completed', 'on_hold', 'dropped')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, anime_id)
);

-- ---------- ratings (1–10) ----------
create table if not exists public.ratings (
  user_id uuid not null references auth.users(id) on delete cascade,
  anime_id uuid not null references public.animes(id) on delete cascade,
  score smallint not null constraint ratings_score_range check (score between 1 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, anime_id)
);

-- ---------- comments (javob: parent_id) ----------
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  anime_id uuid not null references public.animes(id) on delete cascade,
  episode_id uuid references public.episodes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.comments(id) on delete cascade,
  body text not null constraint comments_body_len check (char_length(body) between 1 and 2000),
  is_spoiler boolean not null default false,
  status text not null default 'visible' constraint comments_status_valid check (status in ('visible', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- reports (shikoyatlar) ----------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null constraint reports_target_type_valid check (target_type in ('comment', 'anime', 'user')),
  target_id text not null,
  reason text not null constraint reports_reason_len check (char_length(reason) between 3 and 500),
  status text not null default 'open' constraint reports_status_valid check (status in ('open', 'resolved', 'dismissed')),
  resolved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- ---------- notifications ----------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null constraint notifications_type_len check (char_length(type) between 2 and 40),
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- site_settings (kalit-qiymat) ----------
create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- ---------- banners ----------
create table if not exists public.banners (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  image_url text not null,
  link_url text,
  anime_id uuid references public.animes(id) on delete set null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  constraint banners_dates_valid check (ends_at is null or starts_at is null or ends_at > starts_at)
);

-- ---------- announcements ----------
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  is_published boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  published_at timestamptz
);

-- ---------- admin_logs (faqat funksiyalar orqali yoziladi) ----------
create table if not exists public.admin_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------- Boshlang'ich sozlama (mavjud bo'lsa o'zgarmaydi) ----------
insert into public.site_settings (key, value)
values ('site', '{"name": "Yozora"}'::jsonb)
on conflict (key) do nothing;
