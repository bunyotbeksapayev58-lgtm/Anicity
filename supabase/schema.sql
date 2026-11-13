-- ============================================================================
-- ANICITY PLATFORM — FULL TURNKEY CONSOLIDATED DATABASE SCHEMA
-- Single-file deployment for Supabase / PostgreSQL.
-- Compiled from all 20 production migrations (001 through 019 in sequential order).
-- Includes all core tables, indexes, triggers, auth hooks (handle_new_user),
-- rate limiting, assistant boundaries, admin RPCs, VIP gating, and RLS policies.
-- ============================================================================


-- ============================================================================
-- SECTION: 001_core_schema.sql
-- ============================================================================

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


-- ============================================================================
-- SECTION: 002_indexes.sql
-- ============================================================================

-- =====================================================================
-- 002 — Indekslar (hammasi "if not exists")
-- =====================================================================

-- username: katta-kichik harf farqisiz noyob
create unique index if not exists profiles_username_lower_idx on public.profiles (lower(username));

-- animes
create index if not exists animes_published_idx on public.animes (is_published, created_at desc);
create index if not exists animes_rating_idx on public.animes (rating_avg desc);
create index if not exists animes_views_idx on public.animes (view_count desc);
create index if not exists animes_title_idx on public.animes using gin (to_tsvector('simple', title));
create index if not exists animes_genres_idx on public.animes using gin (genres);

-- episodes / seasons / subtitles
create index if not exists episodes_anime_idx on public.episodes (anime_id, number);
create index if not exists episodes_season_idx on public.episodes (season_id);
create index if not exists seasons_anime_idx on public.seasons (anime_id);
create index if not exists episode_subtitles_episode_idx on public.episode_subtitles (episode_id);

-- foydalanuvchi ma'lumotlari
create index if not exists favorites_user_idx on public.favorites (user_id, created_at desc);
create index if not exists progress_user_idx on public.watch_progress (user_id, updated_at desc);
create index if not exists progress_anime_idx on public.watch_progress (user_id, anime_id);
create index if not exists watchlists_user_status_idx on public.watchlists (user_id, status);
create index if not exists ratings_anime_idx on public.ratings (anime_id);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

-- izohlar va shikoyatlar
create index if not exists comments_anime_idx on public.comments (anime_id, created_at desc);
create index if not exists comments_parent_idx on public.comments (parent_id);
create index if not exists reports_status_idx on public.reports (status, created_at desc);
-- Bir foydalanuvchi bitta obyektga bir martadan ko'p ochiq shikoyat qila olmaydi
create unique index if not exists reports_one_open_idx
  on public.reports (reporter_id, target_type, target_id) where status = 'open';

-- bannerlar va admin jurnali
create index if not exists banners_active_idx on public.banners (is_active, sort_order);
create index if not exists admin_logs_created_idx on public.admin_logs (created_at desc);


-- ============================================================================
-- SECTION: 003_functions_triggers.sql
-- ============================================================================

-- =====================================================================
-- 003 — Funksiyalar va triggerlar
-- Hamma funksiyalar: search_path qat'iy belgilangan. Ruxsatlar 004 da.
-- =====================================================================

-- ---------- updated_at ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------- Rol tekshiruvchilar (RLS siyosatlarida ishlatiladi) ----------
-- Suspenziya qilingan foydalanuvchi hech qanday rolga ega emas (false)
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('moderator', 'admin', 'owner') and suspended_at is null
  );
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'owner') and suspended_at is null
  );
$$;

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'owner' and suspended_at is null
  );
$$;

-- Faol (suspenziya qilinmagan) foydalanuvchi: kontent yaratish uchun
create or replace function public.is_active_user()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and suspended_at is null
  );
$$;

-- ---------- Ro'yxatdan o'tish: profil yaratish ----------
-- Rol HECH QACHON metadata'dan olinmaydi: har doim 'user'.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_username text;
begin
  v_username := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
    split_part(new.email, '@', 1)
  );
  insert into public.profiles (id, username, role)
  values (new.id, v_username, 'user');
  return new;
end $$;

-- ---------- Himoya: oddiy foydalanuvchi rol va suspenziyani o'zgartira olmaydi ----------
-- Ruxsat ustun darajasida ham cheklangan (004), bu qo'shimcha himoya qatlami.
-- current_user: PostgREST orqali 'authenticated'/'anon'; SECURITY DEFINER funksiyalarda 'postgres'.
create or replace function public.profiles_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user in ('anon', 'authenticated') then
    if new.id is distinct from old.id
       or new.role is distinct from old.role
       or new.suspended_at is distinct from old.suspended_at then
      raise exception 'role and suspension can only be changed by an administrator'
        using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

-- ---------- Ratings: animes.rating_avg / rating_count ni hisoblash ----------
create or replace function public.recalc_anime_rating()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_anime uuid := coalesce(new.anime_id, old.anime_id);
begin
  update public.animes
  set rating_avg = coalesce(
        (select round(avg(r.score)::numeric, 2) from public.ratings r where r.anime_id = v_anime), 0),
      rating_count = (select count(*)::int from public.ratings r where r.anime_id = v_anime)
  where id = v_anime;
  return null;
end $$;

-- ---------- Rolni o'zgartirish ----------
-- admin: faqat user/moderator ga o'zgartiradi (admin/owner ga tegmaydi)
-- owner: hammasiga. Hech kim o'z rolini o'zgartira olmaydi.
create or replace function public.set_user_role(p_target uuid, p_new_role text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_old_role text;
begin
  select role into v_actor_role from public.profiles
    where id = v_actor and suspended_at is null;
  if v_actor_role is null or v_actor_role not in ('admin', 'owner') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_new_role not in ('user', 'moderator', 'admin', 'owner') then
    raise exception 'invalid role';
  end if;
  if p_target = v_actor then
    raise exception 'cannot change own role';
  end if;
  select role into v_old_role from public.profiles where id = p_target;
  if v_old_role is null then
    raise exception 'user not found';
  end if;
  if v_actor_role = 'admin' and (v_old_role in ('admin', 'owner') or p_new_role in ('admin', 'owner')) then
    raise exception 'admins cannot change admin or owner roles' using errcode = '42501';
  end if;

  update public.profiles set role = p_new_role where id = p_target;
  insert into public.admin_logs (actor_id, action, target_type, target_id, details)
  values (v_actor, 'set_role', 'user', p_target::text,
          jsonb_build_object('from', v_old_role, 'to', p_new_role));
end $$;

-- ---------- Suspenziya / tiklash ----------
create or replace function public.set_user_suspended(p_target uuid, p_suspended boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_target_role text;
begin
  select role into v_actor_role from public.profiles
    where id = v_actor and suspended_at is null;
  if v_actor_role is null or v_actor_role not in ('admin', 'owner') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_target = v_actor then
    raise exception 'cannot suspend yourself';
  end if;
  select role into v_target_role from public.profiles where id = p_target;
  if v_target_role is null then
    raise exception 'user not found';
  end if;
  if v_actor_role = 'admin' and v_target_role in ('admin', 'owner') then
    raise exception 'admins cannot suspend admin or owner' using errcode = '42501';
  end if;

  update public.profiles
    set suspended_at = case when p_suspended then now() else null end
    where id = p_target;
  insert into public.admin_logs (actor_id, action, target_type, target_id, details)
  values (v_actor, case when p_suspended then 'suspend' else 'restore' end, 'user', p_target::text,
          jsonb_build_object('role', v_target_role));
end $$;

-- ---------- BIRINCHI OWNER: faqat SQL Editor (postgres) dan, bir marta ----------
-- Ilovadan va API dan chaqirib bo'lmaydi (005 da barcha rollardan EXECUTE olib tashlanadi).
-- Shartlar: hali owner yo'q, foydalanuvchi mavjud, emaili tasdiqlangan.
create or replace function public.bootstrap_owner(p_username text)
returns text language plpgsql security definer set search_path = public, auth as $$
declare
  v_id uuid;
  v_confirmed timestamptz;
begin
  if exists (select 1 from public.profiles where role = 'owner') then
    raise exception 'an owner already exists; use set_user_role() from the admin panel';
  end if;

  select p.id, u.email_confirmed_at into v_id, v_confirmed
  from public.profiles p
  join auth.users u on u.id = p.id
  where lower(p.username) = lower(trim(p_username));

  if v_id is null then
    raise exception 'user % not found', p_username;
  end if;
  if v_confirmed is null then
    raise exception 'email of % is not confirmed; confirm it first', p_username;
  end if;

  update public.profiles set role = 'owner' where id = v_id;
  insert into public.admin_logs (actor_id, action, target_type, target_id, details)
  values (null, 'bootstrap_owner', 'user', v_id::text, jsonb_build_object('username', p_username));
  return 'owner assigned to ' || p_username;
end $$;

-- ---------- AUDIT: ma'lumot o'zgarishlarini trigger orqali yozish ----------
-- Qo'lda chaqiriladigan funksiya EMAS: yozuv faqat haqiqiy INSERT/UPDATE/DELETE dan keyin,
-- auth.uid() asosida paydo bo'ladi. Faqat staff (moderator/admin/owner) amallari yoziladi.
-- Oddiy foydalanuvchi o'z sevimlisi/izohini yozganda log bo'lmaydi.
create or replace function public.audit_row_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_id text;
  v_changes jsonb := '{}'::jsonb;
begin
  if auth.uid() is null or not public.is_staff() then
    return null;
  end if;

  if tg_op = 'DELETE' then
    v_id := (to_jsonb(old) ->> 'id');
  else
    v_id := (to_jsonb(new) ->> 'id');
  end if;

  if tg_op = 'UPDATE' then
    select coalesce(jsonb_object_agg(n.key, n.value), '{}'::jsonb) into v_changes
    from jsonb_each(to_jsonb(new)) as n(key, value)
    where (to_jsonb(old) -> n.key) is distinct from n.value
      and n.key not in ('updated_at');
  end if;

  insert into public.admin_logs (actor_id, action, target_type, target_id, details)
  values (
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    v_id,
    jsonb_build_object('changed', v_changes)
  );
  return null;
end $$;

-- ---------- Triggerlar ----------
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists profiles_guard_trg on public.profiles;
create trigger profiles_guard_trg
  before update on public.profiles
  for each row execute function public.profiles_guard();

drop trigger if exists ratings_recalc_trg on public.ratings;
create trigger ratings_recalc_trg
  after insert or update or delete on public.ratings
  for each row execute function public.recalc_anime_rating();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists animes_set_updated_at on public.animes;
create trigger animes_set_updated_at before update on public.animes
  for each row execute function public.set_updated_at();

drop trigger if exists episodes_set_updated_at on public.episodes;
create trigger episodes_set_updated_at before update on public.episodes
  for each row execute function public.set_updated_at();

drop trigger if exists watchlists_set_updated_at on public.watchlists;
create trigger watchlists_set_updated_at before update on public.watchlists
  for each row execute function public.set_updated_at();

drop trigger if exists ratings_set_updated_at on public.ratings;
create trigger ratings_set_updated_at before update on public.ratings
  for each row execute function public.set_updated_at();

drop trigger if exists comments_set_updated_at on public.comments;
create trigger comments_set_updated_at before update on public.comments
  for each row execute function public.set_updated_at();

drop trigger if exists site_settings_set_updated_at on public.site_settings;
create trigger site_settings_set_updated_at before update on public.site_settings
  for each row execute function public.set_updated_at();

-- ---------- Audit triggerlari (ma'lumot jadvallari) ----------
drop trigger if exists animes_audit_trg on public.animes;
create trigger animes_audit_trg after insert or update or delete on public.animes
  for each row execute function public.audit_row_change();

drop trigger if exists episodes_audit_trg on public.episodes;
create trigger episodes_audit_trg after insert or update or delete on public.episodes
  for each row execute function public.audit_row_change();

drop trigger if exists seasons_audit_trg on public.seasons;
create trigger seasons_audit_trg after insert or update or delete on public.seasons
  for each row execute function public.audit_row_change();

drop trigger if exists episode_subtitles_audit_trg on public.episode_subtitles;
create trigger episode_subtitles_audit_trg after insert or update or delete on public.episode_subtitles
  for each row execute function public.audit_row_change();

drop trigger if exists banners_audit_trg on public.banners;
create trigger banners_audit_trg after insert or update or delete on public.banners
  for each row execute function public.audit_row_change();

drop trigger if exists announcements_audit_trg on public.announcements;
create trigger announcements_audit_trg after insert or update or delete on public.announcements
  for each row execute function public.audit_row_change();

drop trigger if exists site_settings_audit_trg on public.site_settings;
create trigger site_settings_audit_trg after insert or update or delete on public.site_settings
  for each row execute function public.audit_row_change();

drop trigger if exists comments_audit_trg on public.comments;
create trigger comments_audit_trg after insert or update or delete on public.comments
  for each row execute function public.audit_row_change();

drop trigger if exists reports_audit_trg on public.reports;
create trigger reports_audit_trg after insert or update or delete on public.reports
  for each row execute function public.audit_row_change();


-- ============================================================================
-- SECTION: 004_grants.sql
-- ============================================================================

-- =====================================================================
-- 004 — Ruxsatlar (GRANT / REVOKE)
-- Tartib muhim: avval hammasini olib tashlash, keyin faqat kerakligini berish.
-- Qoida: ilova (authenticated) faqat aniq ro'yxatdagi funksiyalarni chaqira oladi.
-- =====================================================================

grant usage on schema public to anon, authenticated;

-- 1) Jadvallar: authenticated — keng ruxsat (qatorlar RLS bilan cheklanadi)
grant select, insert, update, delete on all tables in schema public to authenticated;

-- 2) anon — hech narsa (sayt login talab qiladi)
revoke all on all tables in schema public from anon;

-- 3) Funksiyalar: hammasidan ruxsatni olib tashlaymiz (service_role ham kiradi)
revoke execute on all functions in schema public from public, anon, authenticated, service_role;

-- 4) authenticated ga faqat aniq ro'yxat (ilova chaqiradigan yoki RLS ishlatadigan funksiyalar)
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_owner() to authenticated;
grant execute on function public.is_active_user() to authenticated;
grant execute on function public.set_user_role(uuid, text) to authenticated;
grant execute on function public.set_user_suspended(uuid, boolean) to authenticated;

-- 5) Quyidagilar HECH KIMGA berilmaydi (faqat trigger yoki postgres):
--    handle_new_user, profiles_guard, recalc_anime_rating, audit_row_change, set_updated_at
--    bootstrap_owner — faqat SQL Editor (postgres) dan. Aniq revoke ham qo'yilgan:
revoke execute on function public.bootstrap_owner(text) from public, anon, authenticated, service_role;

-- 6) profiles: foydalanuvchi faqat ochiq maydonlarni yangilaydi (role va suspended_at YO'Q)
revoke insert, update, delete on public.profiles from authenticated;
grant update (username, display_name, avatar_url, bio) on public.profiles to authenticated;

-- 7) admin_logs: faqat o'qish. Hech kim (hatto admin ham) to'g'ridan-to'g'ri yoza olmaydi.
--    Yozuvlar faqat SECURITY DEFINER trigger va funksiyalar orqali paydo bo'ladi.
revoke all on public.admin_logs from authenticated;
grant select on public.admin_logs to authenticated;

-- 8) Kelajakdagi jadvallar uchun standart
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public revoke all on tables from anon;


-- ============================================================================
-- SECTION: 005_rls_policies.sql
-- ============================================================================

-- =====================================================================
-- 005 — RLS: qatorlar darajasidagi ruxsatlar
-- Har bir policy oldin "drop policy if exists" bilan o'chiriladi (idempotent).
-- =====================================================================

alter table public.profiles enable row level security;
alter table public.animes enable row level security;
alter table public.seasons enable row level security;
alter table public.episodes enable row level security;
alter table public.episode_subtitles enable row level security;
alter table public.favorites enable row level security;
alter table public.watch_progress enable row level security;
alter table public.watchlists enable row level security;
alter table public.ratings enable row level security;
alter table public.comments enable row level security;
alter table public.reports enable row level security;
alter table public.notifications enable row level security;
alter table public.site_settings enable row level security;
alter table public.banners enable row level security;
alter table public.announcements enable row level security;
alter table public.admin_logs enable row level security;

-- ---------- profiles ----------
drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles for select to authenticated using (true);

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- ---------- animes: nashr qilinganlar (yoki staff); yozish — admin/owner ----------
drop policy if exists "animes read" on public.animes;
create policy "animes read" on public.animes for select to authenticated
  using (is_published or public.is_staff());

drop policy if exists "animes admin write" on public.animes;
create policy "animes admin write" on public.animes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- seasons / episodes / subtitles: ota-anime nashr qilingan bo'lsa ----------
drop policy if exists "seasons read" on public.seasons;
create policy "seasons read" on public.seasons for select to authenticated
  using (public.is_staff()
    or exists (select 1 from public.animes a where a.id = seasons.anime_id and a.is_published));

drop policy if exists "seasons admin write" on public.seasons;
create policy "seasons admin write" on public.seasons for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "episodes read" on public.episodes;
create policy "episodes read" on public.episodes for select to authenticated
  using (public.is_staff()
    or (episodes.is_published and exists (
          select 1 from public.animes a where a.id = episodes.anime_id and a.is_published)));

drop policy if exists "episodes admin write" on public.episodes;
create policy "episodes admin write" on public.episodes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "subtitles read" on public.episode_subtitles;
create policy "subtitles read" on public.episode_subtitles for select to authenticated
  using (public.is_staff()
    or exists (
      select 1 from public.episodes e join public.animes a on a.id = e.anime_id
      where e.id = episode_subtitles.episode_id and e.is_published and a.is_published));

drop policy if exists "subtitles admin write" on public.episode_subtitles;
create policy "subtitles admin write" on public.episode_subtitles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- favorites / watch_progress: faqat o'z qatorlari ----------
drop policy if exists "favorites own" on public.favorites;
create policy "favorites own" on public.favorites for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "progress own" on public.watch_progress;
create policy "progress own" on public.watch_progress for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ---------- watchlists / ratings: o'z qatorlari; yozish faqat faol foydalanuvchi ----------
drop policy if exists "watchlists own" on public.watchlists;
create policy "watchlists own" on public.watchlists for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and public.is_active_user());

drop policy if exists "ratings own" on public.ratings;
create policy "ratings own" on public.ratings for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and public.is_active_user());

-- ---------- comments ----------
drop policy if exists "comments read" on public.comments;
create policy "comments read" on public.comments for select to authenticated
  using (
    (comments.status = 'visible' and exists (
       select 1 from public.animes a where a.id = comments.anime_id and a.is_published))
    or comments.user_id = (select auth.uid())
    or public.is_staff()
  );

drop policy if exists "comments insert own" on public.comments;
create policy "comments insert own" on public.comments for insert to authenticated
  with check ((select auth.uid()) = user_id and public.is_active_user());

drop policy if exists "comments update own" on public.comments;
create policy "comments update own" on public.comments for update to authenticated
  using ((select auth.uid()) = user_id and public.is_active_user())
  with check ((select auth.uid()) = user_id and public.is_active_user());

drop policy if exists "comments staff moderate" on public.comments;
create policy "comments staff moderate" on public.comments for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists "comments delete own or staff" on public.comments;
create policy "comments delete own or staff" on public.comments for delete to authenticated
  using ((select auth.uid()) = user_id or public.is_staff());

-- ---------- reports ----------
drop policy if exists "reports insert own" on public.reports;
create policy "reports insert own" on public.reports for insert to authenticated
  with check ((select auth.uid()) = reporter_id and public.is_active_user());

drop policy if exists "reports read own or staff" on public.reports;
create policy "reports read own or staff" on public.reports for select to authenticated
  using ((select auth.uid()) = reporter_id or public.is_staff());

drop policy if exists "reports staff update" on public.reports;
create policy "reports staff update" on public.reports for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- ---------- notifications: faqat o'z bildirishnomalari ----------
drop policy if exists "notifications own" on public.notifications;
create policy "notifications own" on public.notifications for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ---------- site_settings: hamma o'qiydi, faqat admin/owner yozadi ----------
drop policy if exists "site settings read" on public.site_settings;
create policy "site settings read" on public.site_settings for select to authenticated using (true);

drop policy if exists "site settings admin write" on public.site_settings;
create policy "site settings admin write" on public.site_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- banners: faol va muddati ichida; yozish — admin/owner ----------
drop policy if exists "banners read" on public.banners;
create policy "banners read" on public.banners for select to authenticated
  using (public.is_staff()
    or (banners.is_active
        and (banners.starts_at is null or banners.starts_at <= now())
        and (banners.ends_at is null or banners.ends_at > now())));

drop policy if exists "banners admin write" on public.banners;
create policy "banners admin write" on public.banners for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- announcements ----------
drop policy if exists "announcements read" on public.announcements;
create policy "announcements read" on public.announcements for select to authenticated
  using (announcements.is_published or public.is_staff());

drop policy if exists "announcements admin write" on public.announcements;
create policy "announcements admin write" on public.announcements for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- admin_logs: faqat staff o'qiydi ----------
drop policy if exists "admin logs staff read" on public.admin_logs;
create policy "admin logs staff read" on public.admin_logs for select to authenticated
  using (public.is_staff());


-- ============================================================================
-- SECTION: 006_storage.sql
-- ============================================================================

-- =====================================================================
-- 006 — Storage: bucketlar va ruxsatlar
-- "posters" — ilova kodi shu nomdan foydalanadi (spetsifikatsiyadagi anime-posters).
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('posters',            'posters',            true, 3145728, array['image/jpeg','image/png','image/webp','image/gif']),
  ('anime-banners',      'anime-banners',      true, 5242880, array['image/jpeg','image/png','image/webp']),
  ('episode-thumbnails', 'episode-thumbnails', true, 2097152, array['image/jpeg','image/png','image/webp']),
  ('profile-avatars',    'profile-avatars',    true, 2097152, array['image/jpeg','image/png','image/webp']),
  ('site-assets',        'site-assets',        true, 5242880, array['image/jpeg','image/png','image/webp','image/svg+xml'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------- Admin boshqaradigan bucketlar: hamma o'qiydi, admin/owner yozadi ----------
-- posters
drop policy if exists "posters public read" on storage.objects;
create policy "posters public read" on storage.objects for select to public
  using (bucket_id = 'posters');
drop policy if exists "posters admin insert" on storage.objects;
create policy "posters admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'posters' and public.is_admin());
drop policy if exists "posters admin update" on storage.objects;
create policy "posters admin update" on storage.objects for update to authenticated
  using (bucket_id = 'posters' and public.is_admin())
  with check (bucket_id = 'posters' and public.is_admin());
drop policy if exists "posters admin delete" on storage.objects;
create policy "posters admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'posters' and public.is_admin());

-- anime-banners
drop policy if exists "anime-banners public read" on storage.objects;
create policy "anime-banners public read" on storage.objects for select to public
  using (bucket_id = 'anime-banners');
drop policy if exists "anime-banners admin insert" on storage.objects;
create policy "anime-banners admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'anime-banners' and public.is_admin());
drop policy if exists "anime-banners admin update" on storage.objects;
create policy "anime-banners admin update" on storage.objects for update to authenticated
  using (bucket_id = 'anime-banners' and public.is_admin())
  with check (bucket_id = 'anime-banners' and public.is_admin());
drop policy if exists "anime-banners admin delete" on storage.objects;
create policy "anime-banners admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'anime-banners' and public.is_admin());

-- episode-thumbnails
drop policy if exists "episode-thumbnails public read" on storage.objects;
create policy "episode-thumbnails public read" on storage.objects for select to public
  using (bucket_id = 'episode-thumbnails');
drop policy if exists "episode-thumbnails admin insert" on storage.objects;
create policy "episode-thumbnails admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'episode-thumbnails' and public.is_admin());
drop policy if exists "episode-thumbnails admin update" on storage.objects;
create policy "episode-thumbnails admin update" on storage.objects for update to authenticated
  using (bucket_id = 'episode-thumbnails' and public.is_admin())
  with check (bucket_id = 'episode-thumbnails' and public.is_admin());
drop policy if exists "episode-thumbnails admin delete" on storage.objects;
create policy "episode-thumbnails admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'episode-thumbnails' and public.is_admin());

-- site-assets
drop policy if exists "site-assets public read" on storage.objects;
create policy "site-assets public read" on storage.objects for select to public
  using (bucket_id = 'site-assets');
drop policy if exists "site-assets admin insert" on storage.objects;
create policy "site-assets admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'site-assets' and public.is_admin());
drop policy if exists "site-assets admin update" on storage.objects;
create policy "site-assets admin update" on storage.objects for update to authenticated
  using (bucket_id = 'site-assets' and public.is_admin())
  with check (bucket_id = 'site-assets' and public.is_admin());
drop policy if exists "site-assets admin delete" on storage.objects;
create policy "site-assets admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'site-assets' and public.is_admin());

-- ---------- profile-avatars: yo'l = <auth.uid()>/<fayl>; o'z papkasi yoki admin ----------
drop policy if exists "avatars public read" on storage.objects;
create policy "avatars public read" on storage.objects for select to public
  using (bucket_id = 'profile-avatars');
drop policy if exists "avatars own insert" on storage.objects;
create policy "avatars own insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "avatars own update" on storage.objects;
create policy "avatars own update" on storage.objects for update to authenticated
  using (bucket_id = 'profile-avatars'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin()))
  with check (bucket_id = 'profile-avatars'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin()));
drop policy if exists "avatars own delete" on storage.objects;
create policy "avatars own delete" on storage.objects for delete to authenticated
  using (bucket_id = 'profile-avatars'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin()));


-- ============================================================================
-- SECTION: 007_trailers.sql
-- ============================================================================

-- ============================================================================
-- 007_trailers.sql — Anicity Anime Trailers and Clips Schema & Policies
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.trailers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anime_id UUID REFERENCES public.animes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  duration_text TEXT,
  clip_type TEXT DEFAULT 'trailer' CHECK (clip_type IN ('trailer', 'clip', 'pv', 'teaser')),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trailers_anime_id ON public.trailers (anime_id);
CREATE INDEX IF NOT EXISTS idx_trailers_active_sort ON public.trailers (is_active, sort_order);

ALTER TABLE public.trailers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trailers read" ON public.trailers;
CREATE POLICY "trailers read" ON public.trailers FOR SELECT TO anon, authenticated
  USING (is_active = true OR is_staff());

DROP POLICY IF EXISTS "trailers admin write" ON public.trailers;
CREATE POLICY "trailers admin write" ON public.trailers FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

GRANT SELECT ON public.trailers TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.trailers TO authenticated;


-- ============================================================================
-- SECTION: 008_admin_decoupled_episodes.sql
-- ============================================================================

-- Migration 008: Admin Decoupled Anime & Episode Management Upgrade
-- 1. Add age_rating and is_featured columns to public.animes
ALTER TABLE public.animes 
  ADD COLUMN IF NOT EXISTS age_rating text DEFAULT '12+',
  ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false;

-- 2. Add description and season_number columns to public.episodes
ALTER TABLE public.episodes 
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS season_number integer DEFAULT 1;

-- 3. Update uniqueness constraint to allow season-based numbering
ALTER TABLE public.episodes DROP CONSTRAINT IF EXISTS episodes_anime_id_number_key;
ALTER TABLE public.episodes DROP CONSTRAINT IF EXISTS episodes_anime_season_number_key;
ALTER TABLE public.episodes ADD CONSTRAINT episodes_anime_season_number_key UNIQUE (anime_id, season_number, number);

-- 4. Create index for fast season queries
CREATE INDEX IF NOT EXISTS idx_episodes_anime_season ON public.episodes (anime_id, season_number, number);


-- ============================================================================
-- SECTION: 009_subscriptions_system.sql
-- ============================================================================

-- Migration 009: Complete Subscription System & Management
-- 1. Subscription Plans Table
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  price_uzs BIGINT NOT NULL DEFAULT 0,
  duration_days INTEGER NOT NULL DEFAULT 30,
  benefits TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  is_popular BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. User Subscriptions Table
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  plan_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'pending')),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  grant_type TEXT NOT NULL DEFAULT 'manual_admin' CHECK (grant_type IN ('manual_admin', 'online_payment', 'promo_code', 'system')),
  granted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Subscription Transactions Table (Payment-ready architecture)
CREATE TABLE IF NOT EXISTS public.subscription_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  amount_uzs BIGINT NOT NULL,
  currency TEXT DEFAULT 'UZS',
  provider TEXT NOT NULL DEFAULT 'manual' CHECK (provider IN ('payme', 'click', 'uzum', 'manual', 'other')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  provider_tx_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Subscription Audit Logs Table
CREATE TABLE IF NOT EXISTS public.subscription_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('grant', 'extend', 'revoke', 'modify', 'expire')),
  previous_plan TEXT,
  previous_expires_at TIMESTAMPTZ,
  new_plan TEXT,
  new_expires_at TIMESTAMPTZ,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_subs_user_id ON public.user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subs_status ON public.user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subs_expires_at ON public.user_subscriptions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sub_tx_user_id ON public.subscription_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_sub_tx_status ON public.subscription_transactions(status);
CREATE INDEX IF NOT EXISTS idx_sub_audit_user_id ON public.subscription_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_sub_audit_created_at ON public.subscription_audit_logs(created_at);

-- Enable RLS
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_audit_logs ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Plans are viewable by everyone" ON public.subscription_plans;
CREATE POLICY "Plans are viewable by everyone" ON public.subscription_plans FOR SELECT USING (is_active = true OR is_admin());

DROP POLICY IF EXISTS "Admins can manage plans" ON public.subscription_plans;
CREATE POLICY "Admins can manage plans" ON public.subscription_plans FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.user_subscriptions;
CREATE POLICY "Users can view own subscriptions" ON public.user_subscriptions FOR SELECT USING (auth.uid() = user_id OR is_admin());

DROP POLICY IF EXISTS "Admins can manage user subscriptions" ON public.user_subscriptions;
CREATE POLICY "Admins can manage user subscriptions" ON public.user_subscriptions FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Users can view own transactions" ON public.subscription_transactions;
CREATE POLICY "Users can view own transactions" ON public.subscription_transactions FOR SELECT USING (auth.uid() = user_id OR is_admin());

DROP POLICY IF EXISTS "Admins can manage transactions" ON public.subscription_transactions;
CREATE POLICY "Admins can manage transactions" ON public.subscription_transactions FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins can view audit logs" ON public.subscription_audit_logs;
CREATE POLICY "Admins can view audit logs" ON public.subscription_audit_logs FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Admins can insert audit logs" ON public.subscription_audit_logs;
CREATE POLICY "Admins can insert audit logs" ON public.subscription_audit_logs FOR INSERT WITH CHECK (is_admin());


-- ============================================================================
-- SECTION: 010_video_banners.sql
-- ============================================================================

-- =====================================================================
-- Migration 010: Video Banners Support & Storage Upgrade
-- =====================================================================

-- 1. Add video_url to public.banners and make image_url nullable
ALTER TABLE public.banners ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE public.banners ALTER COLUMN image_url DROP NOT NULL;

-- 2. Update storage.buckets to allow video formats (MP4, WebM, QuickTime) in anime-banners with 50MB limit
UPDATE storage.buckets
SET file_size_limit = 52428800,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']
WHERE id = 'anime-banners';


-- ============================================================================
-- SECTION: 011_schema_security_repairs.sql
-- ============================================================================

-- Forward-only repairs for fields already used by the application.
ALTER TABLE public.animes
  ADD COLUMN IF NOT EXISTS release_day text,
  ADD COLUMN IF NOT EXISTS fandub_team text NOT NULL DEFAULT 'Anicity Dub';

ALTER TABLE public.episodes
  ADD COLUMN IF NOT EXISTS quality text NOT NULL DEFAULT '1080p';

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles read" ON public.profiles;
DROP POLICY IF EXISTS "profiles read own or admin" ON public.profiles;
CREATE POLICY "profiles read own or admin" ON public.profiles
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = id OR public.is_admin());

CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  id uuid,
  username text,
  display_name text,
  role text,
  suspended_at timestamptz,
  created_at timestamptz,
  subscription_plan text,
  subscription_expires_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT p.id, p.username, p.display_name, p.role, p.suspended_at, p.created_at,
         CASE WHEN s.id IS NOT NULL THEN 'vip' ELSE 'free' END,
         s.expires_at
  FROM public.profiles p
  LEFT JOIN LATERAL (
    SELECT us.id, us.expires_at
    FROM public.user_subscriptions us
  WHERE us.user_id = p.id AND us.status = 'active' AND us.starts_at <= now()
    ORDER BY us.expires_at DESC
    LIMIT 1
  ) s ON true
  ORDER BY p.created_at DESC
  LIMIT 100;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_create_anime_with_episodes(
  p_anime jsonb,
  p_episodes jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_anime public.animes%ROWTYPE;
  v_episode_count integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_anime) <> 'object' OR jsonb_typeof(coalesce(p_episodes, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'invalid anime or episode payload';
  END IF;
  IF jsonb_array_length(coalesce(p_episodes, '[]'::jsonb)) > 500 THEN
    RAISE EXCEPTION 'at most 500 episodes are allowed';
  END IF;

  INSERT INTO public.animes (
    title, alt_title, description, year, status, age_rating, genres, studio, director,
    poster_url, banner_url, is_featured, is_published, release_day, fandub_team
  )
  VALUES (
    p_anime->>'title', p_anime->>'alt_title', coalesce(p_anime->>'description', ''),
    nullif(p_anime->>'year', '')::integer, coalesce(p_anime->>'status', 'Tugallangan'),
    coalesce(p_anime->>'age_rating', '12+'),
    ARRAY(SELECT jsonb_array_elements_text(coalesce(p_anime->'genres', '[]'::jsonb))),
    p_anime->>'studio', p_anime->>'director', p_anime->>'poster_url', p_anime->>'banner_url',
    coalesce((p_anime->>'is_featured')::boolean, false),
    coalesce((p_anime->>'is_published')::boolean, true),
    p_anime->>'release_day', coalesce(p_anime->>'fandub_team', 'Anicity Dub')
  )
  RETURNING * INTO v_anime;

  v_episode_count := jsonb_array_length(coalesce(p_episodes, '[]'::jsonb));
  IF v_episode_count > 0 THEN
    IF EXISTS (
      SELECT 1 FROM jsonb_to_recordset(p_episodes) AS e(
        season_number integer, number integer, title text, video_url text
      )
      WHERE e.season_number IS NULL OR e.season_number < 1
         OR e.number IS NULL OR e.number < 1
         OR e.video_url IS NULL OR e.video_url !~* '^https?://'
         OR char_length(coalesce(e.title, '')) > 200
    ) THEN
      RAISE EXCEPTION 'invalid episode fields';
    END IF;
    INSERT INTO public.episodes (
      anime_id, season_number, number, title, description, video_url,
      thumbnail_url, is_published, quality
    )
    SELECT v_anime.id, e.season_number, e.number, e.title, e.description, e.video_url,
           e.thumbnail_url, coalesce(e.is_published, true), coalesce(e.quality, '1080p')
    FROM jsonb_to_recordset(p_episodes) AS e(
      season_number integer, number integer, title text, description text, video_url text,
      thumbnail_url text, is_published boolean, quality text
    );
  END IF;

  RETURN jsonb_build_object('id', v_anime.id, 'title', v_anime.title, 'poster_url', v_anime.poster_url);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_replace_anime_episodes(p_anime_id uuid, p_episodes jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_episodes) <> 'array' OR jsonb_array_length(p_episodes) < 1
     OR jsonb_array_length(p_episodes) > 500 THEN
    RAISE EXCEPTION 'episode list must contain between 1 and 500 entries';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.animes WHERE id = p_anime_id) THEN
    RAISE EXCEPTION 'anime not found' USING ERRCODE = 'P0002';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_episodes) AS e(
      season_number integer, number integer, title text, video_url text
    )
    WHERE e.season_number IS NULL OR e.season_number < 1
       OR e.number IS NULL OR e.number < 1
       OR e.video_url IS NULL OR e.video_url !~* '^https?://'
       OR char_length(coalesce(e.title, '')) > 200
  ) THEN
    RAISE EXCEPTION 'invalid episode fields';
  END IF;

  DELETE FROM public.episodes WHERE anime_id = p_anime_id;
  INSERT INTO public.episodes (
    anime_id, season_number, number, title, description, video_url,
    thumbnail_url, is_published, quality
  )
  SELECT p_anime_id, e.season_number, e.number, e.title, e.description, e.video_url,
         e.thumbnail_url, coalesce(e.is_published, true), coalesce(e.quality, '1080p')
  FROM jsonb_to_recordset(p_episodes) AS e(
    season_number integer, number integer, title text, description text, video_url text,
    thumbnail_url text, is_published boolean, quality text
  );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_grant_user_subscription(
  p_user_id uuid, p_plan_id uuid, p_duration_days integer, p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_username text;
  v_plan_name text;
  v_duration integer;
  v_previous_expiry timestamptz;
  v_starts timestamptz;
  v_expires timestamptz;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT username INTO v_username FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'user not found' USING ERRCODE = 'P0002'; END IF;

  IF p_plan_id IS NOT NULL THEN
    SELECT name, duration_days INTO v_plan_name, v_duration
    FROM public.subscription_plans WHERE id = p_plan_id AND is_active = true;
    IF NOT FOUND THEN RAISE EXCEPTION 'active subscription plan not found' USING ERRCODE = 'P0002'; END IF;
  ELSE
    v_duration := p_duration_days;
    v_plan_name := format('%s kunlik VIP', v_duration);
  END IF;
  IF v_duration IS NULL OR v_duration < 1 OR v_duration > 3660 THEN
    RAISE EXCEPTION 'subscription duration must be between 1 and 3660 days';
  END IF;

  SELECT max(expires_at) INTO v_previous_expiry
  FROM public.user_subscriptions
  WHERE user_id = p_user_id AND status = 'active' AND starts_at <= now() AND expires_at > now();
  v_starts := greatest(now(), coalesce(v_previous_expiry, now()));
  v_expires := v_starts + make_interval(days => v_duration);

  INSERT INTO public.user_subscriptions (
    user_id, plan_id, plan_name, status, starts_at, expires_at, grant_type, granted_by, notes
  ) VALUES (
    p_user_id, p_plan_id, v_plan_name, 'active', v_starts, v_expires, 'manual_admin', v_actor,
    left(nullif(trim(p_notes), ''), 1000)
  );
  INSERT INTO public.subscription_audit_logs (
    admin_id, user_id, action, previous_plan, previous_expires_at, new_plan, new_expires_at, reason
  ) VALUES (v_actor, p_user_id, 'grant', NULL, v_previous_expiry, v_plan_name, v_expires,
            left(nullif(trim(p_notes), ''), 1000));
  RETURN jsonb_build_object('username', v_username, 'plan_name', v_plan_name, 'expires_at', v_expires);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_extend_user_subscription(
  p_user_id uuid, p_duration_days integer, p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_sub public.user_subscriptions%ROWTYPE;
  v_username text;
  v_expires timestamptz;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_duration_days IS NULL OR p_duration_days < 1 OR p_duration_days > 3660 THEN
    RAISE EXCEPTION 'extension must be between 1 and 3660 days';
  END IF;
  SELECT username INTO v_username FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'user not found' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO v_sub FROM public.user_subscriptions
  WHERE user_id = p_user_id AND status = 'active' AND starts_at <= now() AND expires_at > now()
  ORDER BY expires_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'active subscription not found' USING ERRCODE = 'P0002'; END IF;

  v_expires := v_sub.expires_at + make_interval(days => p_duration_days);
  UPDATE public.user_subscriptions
  SET expires_at = v_expires, updated_at = now()
  WHERE id = v_sub.id;
  INSERT INTO public.subscription_audit_logs (
    admin_id, user_id, action, previous_plan, previous_expires_at, new_plan, new_expires_at, reason
  ) VALUES (v_actor, p_user_id, 'extend', v_sub.plan_name, v_sub.expires_at,
            v_sub.plan_name, v_expires, left(nullif(trim(p_reason), ''), 1000));
  RETURN jsonb_build_object('username', v_username, 'plan_name', v_sub.plan_name, 'expires_at', v_expires);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_revoke_user_subscription(p_user_id uuid, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_username text;
  v_previous public.user_subscriptions%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT username INTO v_username FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'user not found' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO v_previous FROM public.user_subscriptions
  WHERE user_id = p_user_id AND status = 'active'
  ORDER BY expires_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'active subscription not found' USING ERRCODE = 'P0002'; END IF;
  UPDATE public.user_subscriptions
  SET status = 'cancelled', updated_at = now()
  WHERE user_id = p_user_id AND status = 'active';
  INSERT INTO public.subscription_audit_logs (
    admin_id, user_id, action, previous_plan, previous_expires_at, new_plan, new_expires_at, reason
  ) VALUES (v_actor, p_user_id, 'revoke', v_previous.plan_name, v_previous.expires_at,
            'free', NULL, left(nullif(trim(p_reason), ''), 1000));
  RETURN jsonb_build_object('username', v_username);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_toggle_user_vip(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_active boolean;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.user_subscriptions
    WHERE user_id = p_user_id AND status = 'active' AND starts_at <= now() AND expires_at > now()
  ) INTO v_active;
  IF v_active THEN
    RETURN public.admin_revoke_user_subscription(p_user_id, 'Admin tomonidan bekor qilindi');
  END IF;
  RETURN public.admin_grant_user_subscription(p_user_id, NULL, 30, 'Admin tomonidan taqdim etildi');
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_create_anime_with_episodes(jsonb, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_replace_anime_episodes(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_grant_user_subscription(uuid, uuid, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_extend_user_subscription(uuid, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_revoke_user_subscription(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_toggle_user_vip(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_anime_with_episodes(jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_replace_anime_episodes(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant_user_subscription(uuid, uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_extend_user_subscription(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_user_subscription(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_toggle_user_vip(uuid) TO authenticated;


-- ============================================================================
-- SECTION: 011b_admin_anime_rpcs.sql
-- ============================================================================

-- Forward-only bridge migration: safely introduces missing admin anime RPCs
-- without re-running obsolete 011 subscription logic or changing profiles RLS policies.
-- Safe to run on both Production and Staging.

CREATE OR REPLACE FUNCTION public.admin_create_anime_with_episodes(
  p_anime jsonb,
  p_episodes jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_anime public.animes%ROWTYPE;
  v_episode_count integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_anime IS NULL OR jsonb_typeof(p_anime) <> 'object' THEN
    RAISE EXCEPTION 'anime payload must be a JSON object';
  END IF;
  IF p_episodes IS NULL OR jsonb_typeof(p_episodes) <> 'array' THEN
    RAISE EXCEPTION 'episodes payload must be a JSON array';
  END IF;
  IF jsonb_array_length(p_episodes) > 500 THEN
    RAISE EXCEPTION 'at most 500 episodes are allowed';
  END IF;
  IF p_anime ? 'genres' AND jsonb_typeof(p_anime->'genres') <> 'array' THEN
    RAISE EXCEPTION 'genres must be an array';
  END IF;

  INSERT INTO public.animes (
    title, alt_title, description, year, status, age_rating, genres, studio, director,
    poster_url, banner_url, is_featured, is_published, release_day, fandub_team
  )
  VALUES (
    p_anime->>'title',
    p_anime->>'alt_title',
    coalesce(p_anime->>'description', ''),
    nullif(p_anime->>'year', '')::integer,
    coalesce(p_anime->>'status', 'Tugallangan'),
    coalesce(p_anime->>'age_rating', '12+'),
    CASE 
      WHEN p_anime ? 'genres' THEN ARRAY(SELECT jsonb_array_elements_text(p_anime->'genres'))
      ELSE '{}'::text[]
    END,
    p_anime->>'studio',
    p_anime->>'director',
    p_anime->>'poster_url',
    p_anime->>'banner_url',
    coalesce((p_anime->>'is_featured')::boolean, false),
    coalesce((p_anime->>'is_published')::boolean, true),
    p_anime->>'release_day',
    coalesce(p_anime->>'fandub_team', 'Anicity Dub')
  )
  RETURNING * INTO v_anime;

  v_episode_count := jsonb_array_length(p_episodes);
  IF v_episode_count > 0 THEN
    IF EXISTS (
      SELECT 1 FROM jsonb_to_recordset(p_episodes) AS e(
        season_number integer, number integer, title text, video_url text
      )
      WHERE e.season_number IS NULL OR e.season_number < 1
         OR e.number IS NULL OR e.number < 1
         OR e.video_url IS NULL OR e.video_url !~* '^https?://'
         OR char_length(coalesce(e.title, '')) > 200
    ) THEN
      RAISE EXCEPTION 'invalid episode fields in episode list';
    END IF;

    -- Duplicate check: ensure payload does not contain duplicate (season_number, number) entries
    IF (
      SELECT count(*) FROM (
        SELECT DISTINCT e.season_number, e.number
        FROM jsonb_to_recordset(p_episodes) AS e(season_number integer, number integer)
      ) d
    ) <> v_episode_count THEN
      RAISE EXCEPTION 'duplicate episode season_number and number in payload' USING ERRCODE = '23505';
    END IF;

    INSERT INTO public.episodes (
      anime_id, season_number, number, title, description, video_url,
      thumbnail_url, is_published, quality
    )
    SELECT v_anime.id, e.season_number, e.number, e.title, e.description, e.video_url,
           e.thumbnail_url, coalesce(e.is_published, true), coalesce(e.quality, '1080p')
    FROM jsonb_to_recordset(p_episodes) AS e(
      season_number integer, number integer, title text, description text, video_url text,
      thumbnail_url text, is_published boolean, quality text
    );
  END IF;

  RETURN jsonb_build_object('id', v_anime.id, 'title', v_anime.title, 'poster_url', v_anime.poster_url);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_anime_with_episodes(jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_anime_with_episodes(jsonb, jsonb) TO authenticated;

-- Non-destructive compatibility wrapper delegating to atomic admin_update_anime_and_episodes
CREATE OR REPLACE FUNCTION public.admin_replace_anime_episodes(
  p_anime_id uuid,
  p_episodes jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  -- Safe delegation: routes through audited atomic updater
  RETURN public.admin_update_anime_and_episodes(p_anime_id, '{}'::jsonb, p_episodes);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_replace_anime_episodes(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_replace_anime_episodes(uuid, jsonb) TO authenticated;


-- ============================================================================
-- SECTION: 012_admin_pagination_atomic_updates.sql
-- ============================================================================

-- Forward-only admin pagination, serialized subscription grants and atomic anime PATCH.

-- Drop the old no-argument signature so PostgREST has exactly one matching RPC.
DROP FUNCTION IF EXISTS public.admin_list_users();
CREATE FUNCTION public.admin_list_users(
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50,
  p_search text DEFAULT NULL,
  p_status text DEFAULT 'all'
)
RETURNS TABLE (
  id uuid,
  username text,
  display_name text,
  role text,
  suspended_at timestamptz,
  created_at timestamptz,
  subscription_plan text,
  subscription_expires_at timestamptz,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_total_count bigint;
  v_page integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_page IS NULL OR p_page < 1 THEN RAISE EXCEPTION 'page must be at least 1'; END IF;
  IF p_page_size IS NULL OR p_page_size < 1 OR p_page_size > 100 THEN
    RAISE EXCEPTION 'page size must be between 1 and 100';
  END IF;
  IF coalesce(p_status, 'all') NOT IN ('all', 'vip', 'free', 'expired') THEN
    RAISE EXCEPTION 'invalid user status filter';
  END IF;
  IF length(coalesce(p_search, '')) > 100 THEN RAISE EXCEPTION 'search text is too long'; END IF;

  SELECT count(*) INTO v_total_count
  FROM public.profiles p
  LEFT JOIN LATERAL (
    SELECT us.id, us.expires_at
    FROM public.user_subscriptions us
    WHERE us.user_id = p.id AND us.status = 'active' AND us.starts_at <= now()
    ORDER BY us.expires_at DESC
    LIMIT 1
  ) s ON true
  WHERE (nullif(trim(p_search), '') IS NULL
         OR p.username ILIKE '%' || trim(p_search) || '%'
         OR p.display_name ILIKE '%' || trim(p_search) || '%'
         OR p.id::text ILIKE '%' || trim(p_search) || '%')
    AND (coalesce(p_status, 'all') = 'all'
         OR (p_status = 'vip' AND s.id IS NOT NULL AND s.expires_at > now())
         OR (p_status = 'expired' AND s.id IS NOT NULL AND s.expires_at <= now())
         OR (p_status = 'free' AND (s.id IS NULL OR s.expires_at <= now())));
  v_page := least(p_page, greatest(ceil(v_total_count::numeric / p_page_size)::integer, 1));

  RETURN QUERY
  SELECT p.id, p.username, p.display_name, p.role, p.suspended_at, p.created_at,
         CASE WHEN s.id IS NOT NULL THEN 'vip' ELSE 'free' END,
         s.expires_at, v_total_count
  FROM public.profiles p
  LEFT JOIN LATERAL (
    SELECT us.id, us.expires_at
    FROM public.user_subscriptions us
    WHERE us.user_id = p.id AND us.status = 'active' AND us.starts_at <= now()
    ORDER BY us.expires_at DESC
    LIMIT 1
  ) s ON true
  WHERE (nullif(trim(p_search), '') IS NULL
         OR p.username ILIKE '%' || trim(p_search) || '%'
         OR p.display_name ILIKE '%' || trim(p_search) || '%'
         OR p.id::text ILIKE '%' || trim(p_search) || '%')
    AND (coalesce(p_status, 'all') = 'all'
         OR (p_status = 'vip' AND s.id IS NOT NULL AND s.expires_at > now())
         OR (p_status = 'expired' AND s.id IS NOT NULL AND s.expires_at <= now())
         OR (p_status = 'free' AND (s.id IS NULL OR s.expires_at <= now())))
  ORDER BY p.created_at DESC, p.id
  LIMIT p_page_size OFFSET (v_page - 1) * p_page_size;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_users(integer, integer, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users(integer, integer, text, text) TO authenticated;

-- Replace the grant implementation without changing existing subscription rows.
CREATE OR REPLACE FUNCTION public.admin_grant_user_subscription(
  p_user_id uuid, p_plan_id uuid, p_duration_days integer, p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_username text;
  v_plan_name text;
  v_duration integer;
  v_previous_expiry timestamptz;
  v_starts timestamptz;
  v_expires timestamptz;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'user id is required'; END IF;
  SELECT username INTO v_username FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'user not found' USING ERRCODE = 'P0002'; END IF;

  -- A per-user transaction lock prevents concurrent grants from selecting the same expiry.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  IF p_plan_id IS NOT NULL THEN
    SELECT name, duration_days INTO v_plan_name, v_duration
    FROM public.subscription_plans WHERE id = p_plan_id AND is_active = true;
    IF NOT FOUND THEN RAISE EXCEPTION 'active subscription plan not found' USING ERRCODE = 'P0002'; END IF;
  ELSE
    v_duration := p_duration_days;
    v_plan_name := format('%s kunlik VIP', v_duration);
  END IF;
  IF v_duration IS NULL OR v_duration < 1 OR v_duration > 3660 THEN
    RAISE EXCEPTION 'subscription duration must be between 1 and 3660 days';
  END IF;

  SELECT max(expires_at) INTO v_previous_expiry
  FROM public.user_subscriptions
  WHERE user_id = p_user_id AND status = 'active' AND expires_at > now();
  v_starts := greatest(now(), coalesce(v_previous_expiry, now()));
  v_expires := v_starts + make_interval(days => v_duration);

  INSERT INTO public.user_subscriptions (
    user_id, plan_id, plan_name, status, starts_at, expires_at, grant_type, granted_by, notes
  ) VALUES (
    p_user_id, p_plan_id, v_plan_name, 'active', v_starts, v_expires, 'manual_admin', v_actor,
    left(nullif(trim(p_notes), ''), 1000)
  );
  INSERT INTO public.subscription_audit_logs (
    admin_id, user_id, action, previous_plan, previous_expires_at, new_plan, new_expires_at, reason
  ) VALUES (v_actor, p_user_id, 'grant', NULL, v_previous_expiry, v_plan_name, v_expires,
            left(nullif(trim(p_notes), ''), 1000));
  RETURN jsonb_build_object('username', v_username, 'plan_name', v_plan_name, 'expires_at', v_expires);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_grant_user_subscription(uuid, uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_grant_user_subscription(uuid, uuid, integer, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_extend_user_subscription(
  p_user_id uuid, p_duration_days integer, p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_sub public.user_subscriptions%ROWTYPE;
  v_username text;
  v_expires timestamptz;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF p_duration_days IS NULL OR p_duration_days < 1 OR p_duration_days > 3660 THEN
    RAISE EXCEPTION 'extension must be between 1 and 3660 days';
  END IF;
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'user id is required'; END IF;
  SELECT username INTO v_username FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'user not found' USING ERRCODE = 'P0002'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  SELECT * INTO v_sub FROM public.user_subscriptions
  WHERE user_id = p_user_id AND status = 'active' AND expires_at > now()
  ORDER BY expires_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'active subscription not found' USING ERRCODE = 'P0002'; END IF;

  v_expires := v_sub.expires_at + make_interval(days => p_duration_days);
  UPDATE public.user_subscriptions SET expires_at = v_expires, updated_at = now() WHERE id = v_sub.id;
  INSERT INTO public.subscription_audit_logs (
    admin_id, user_id, action, previous_plan, previous_expires_at, new_plan, new_expires_at, reason
  ) VALUES (v_actor, p_user_id, 'extend', v_sub.plan_name, v_sub.expires_at,
            v_sub.plan_name, v_expires, left(nullif(trim(p_reason), ''), 1000));
  RETURN jsonb_build_object('username', v_username, 'plan_name', v_sub.plan_name, 'expires_at', v_expires);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_revoke_user_subscription(p_user_id uuid, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_username text;
  v_previous public.user_subscriptions%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'user id is required'; END IF;
  SELECT username INTO v_username FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'user not found' USING ERRCODE = 'P0002'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  SELECT * INTO v_previous FROM public.user_subscriptions
  WHERE user_id = p_user_id AND status = 'active'
  ORDER BY expires_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'active subscription not found' USING ERRCODE = 'P0002'; END IF;
  UPDATE public.user_subscriptions SET status = 'cancelled', updated_at = now()
  WHERE user_id = p_user_id AND status = 'active';
  INSERT INTO public.subscription_audit_logs (
    admin_id, user_id, action, previous_plan, previous_expires_at, new_plan, new_expires_at, reason
  ) VALUES (v_actor, p_user_id, 'revoke', v_previous.plan_name, v_previous.expires_at,
            'free', NULL, left(nullif(trim(p_reason), ''), 1000));
  RETURN jsonb_build_object('username', v_username);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_toggle_user_vip(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_active boolean;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'user id is required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  SELECT EXISTS (
    SELECT 1 FROM public.user_subscriptions
    WHERE user_id = p_user_id AND status = 'active' AND starts_at <= now() AND expires_at > now()
  ) INTO v_active;
  IF v_active THEN RETURN public.admin_revoke_user_subscription(p_user_id, 'Admin tomonidan bekor qilindi'); END IF;
  RETURN public.admin_grant_user_subscription(p_user_id, NULL, 30, 'Admin tomonidan taqdim etildi');
END;
$$;

REVOKE ALL ON FUNCTION public.admin_extend_user_subscription(uuid, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_revoke_user_subscription(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_toggle_user_vip(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_extend_user_subscription(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_user_subscription(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_toggle_user_vip(uuid) TO authenticated;

-- Metadata edits and optional episode replacement commit or roll back together.
CREATE OR REPLACE FUNCTION public.admin_update_anime_and_episodes(
  p_anime_id uuid, p_anime jsonb, p_episodes jsonb DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_episode_count integer := 0;
  v_rows integer;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF p_anime IS NULL OR jsonb_typeof(p_anime) <> 'object' THEN
    RAISE EXCEPTION 'anime patch must be a JSON object';
  END IF;
  IF p_anime ? 'genres' AND jsonb_typeof(p_anime->'genres') <> 'array' THEN
    RAISE EXCEPTION 'genres must be an array';
  END IF;

  IF p_anime <> '{}'::jsonb THEN
    UPDATE public.animes SET
      title = CASE WHEN p_anime ? 'title' THEN p_anime->>'title' ELSE title END,
      alt_title = CASE WHEN p_anime ? 'alt_title' THEN p_anime->>'alt_title' ELSE alt_title END,
      year = CASE WHEN p_anime ? 'year' THEN nullif(p_anime->>'year', '')::integer ELSE year END,
      status = CASE WHEN p_anime ? 'status' THEN p_anime->>'status' ELSE status END,
      age_rating = CASE WHEN p_anime ? 'age_rating' THEN p_anime->>'age_rating' ELSE age_rating END,
      studio = CASE WHEN p_anime ? 'studio' THEN p_anime->>'studio' ELSE studio END,
      director = CASE WHEN p_anime ? 'director' THEN p_anime->>'director' ELSE director END,
      genres = CASE WHEN p_anime ? 'genres'
        THEN ARRAY(SELECT jsonb_array_elements_text(p_anime->'genres')) ELSE genres END,
      description = CASE WHEN p_anime ? 'description' THEN p_anime->>'description' ELSE description END,
      poster_url = CASE WHEN p_anime ? 'poster_url' THEN p_anime->>'poster_url' ELSE poster_url END,
      banner_url = CASE WHEN p_anime ? 'banner_url' THEN p_anime->>'banner_url' ELSE banner_url END,
      is_featured = CASE WHEN p_anime ? 'is_featured' THEN (p_anime->>'is_featured')::boolean ELSE is_featured END,
      is_published = CASE WHEN p_anime ? 'is_published' THEN (p_anime->>'is_published')::boolean ELSE is_published END,
      release_day = CASE WHEN p_anime ? 'release_day' THEN p_anime->>'release_day' ELSE release_day END,
      fandub_team = CASE WHEN p_anime ? 'fandub_team' THEN p_anime->>'fandub_team' ELSE fandub_team END
    WHERE id = p_anime_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 0 THEN RAISE EXCEPTION 'anime not found' USING ERRCODE = 'P0002'; END IF;
  ELSIF NOT EXISTS (SELECT 1 FROM public.animes WHERE id = p_anime_id) THEN
    RAISE EXCEPTION 'anime not found' USING ERRCODE = 'P0002';
  END IF;

  IF p_episodes IS NOT NULL THEN
    IF jsonb_typeof(p_episodes) <> 'array' OR jsonb_array_length(p_episodes) < 1
       OR jsonb_array_length(p_episodes) > 500 THEN
      RAISE EXCEPTION 'episode list must contain between 1 and 500 entries';
    END IF;
    IF EXISTS (
      SELECT 1 FROM jsonb_to_recordset(p_episodes) AS e(
        season_number integer, number integer, title text, video_url text
      )
      WHERE e.season_number IS NULL OR e.season_number < 1
         OR e.number IS NULL OR e.number < 1
         OR e.video_url IS NULL OR e.video_url !~* '^https?://'
         OR char_length(coalesce(e.title, '')) > 200
    ) THEN RAISE EXCEPTION 'invalid episode fields'; END IF;

    DELETE FROM public.episodes WHERE anime_id = p_anime_id;
    INSERT INTO public.episodes (
      anime_id, season_number, number, title, description, video_url,
      thumbnail_url, is_published, quality
    )
    SELECT p_anime_id, e.season_number, e.number, e.title, e.description, e.video_url,
           e.thumbnail_url, coalesce(e.is_published, true), coalesce(e.quality, '1080p')
    FROM jsonb_to_recordset(p_episodes) AS e(
      season_number integer, number integer, title text, description text, video_url text,
      thumbnail_url text, is_published boolean, quality text
    );
    GET DIAGNOSTICS v_episode_count = ROW_COUNT;
  END IF;
  RETURN v_episode_count;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_anime_and_episodes(uuid, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_anime_and_episodes(uuid, jsonb, jsonb) TO authenticated;

-- Self-contained anime creation RPC ensuring seamless forward-compatibility with Next.js app and 015
-- Forward-only bridge migration: safely introduces missing admin anime RPCs
-- without re-running obsolete 011 subscription logic or changing profiles RLS policies.
-- Safe to run on both Production and Staging.

CREATE OR REPLACE FUNCTION public.admin_create_anime_with_episodes(
  p_anime jsonb,
  p_episodes jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_anime public.animes%ROWTYPE;
  v_episode_count integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_anime IS NULL OR jsonb_typeof(p_anime) <> 'object' THEN
    RAISE EXCEPTION 'anime payload must be a JSON object';
  END IF;
  IF p_episodes IS NULL OR jsonb_typeof(p_episodes) <> 'array' THEN
    RAISE EXCEPTION 'episodes payload must be a JSON array';
  END IF;
  IF jsonb_array_length(p_episodes) > 500 THEN
    RAISE EXCEPTION 'at most 500 episodes are allowed';
  END IF;
  IF p_anime ? 'genres' AND jsonb_typeof(p_anime->'genres') <> 'array' THEN
    RAISE EXCEPTION 'genres must be an array';
  END IF;

  INSERT INTO public.animes (
    title, alt_title, description, year, status, age_rating, genres, studio, director,
    poster_url, banner_url, is_featured, is_published, release_day, fandub_team
  )
  VALUES (
    p_anime->>'title',
    p_anime->>'alt_title',
    coalesce(p_anime->>'description', ''),
    nullif(p_anime->>'year', '')::integer,
    coalesce(p_anime->>'status', 'Tugallangan'),
    coalesce(p_anime->>'age_rating', '12+'),
    CASE 
      WHEN p_anime ? 'genres' THEN ARRAY(SELECT jsonb_array_elements_text(p_anime->'genres'))
      ELSE '{}'::text[]
    END,
    p_anime->>'studio',
    p_anime->>'director',
    p_anime->>'poster_url',
    p_anime->>'banner_url',
    coalesce((p_anime->>'is_featured')::boolean, false),
    coalesce((p_anime->>'is_published')::boolean, true),
    p_anime->>'release_day',
    coalesce(p_anime->>'fandub_team', 'Anicity Dub')
  )
  RETURNING * INTO v_anime;

  v_episode_count := jsonb_array_length(p_episodes);
  IF v_episode_count > 0 THEN
    IF EXISTS (
      SELECT 1 FROM jsonb_to_recordset(p_episodes) AS e(
        season_number integer, number integer, title text, video_url text
      )
      WHERE e.season_number IS NULL OR e.season_number < 1
         OR e.number IS NULL OR e.number < 1
         OR e.video_url IS NULL OR e.video_url !~* '^https?://'
         OR char_length(coalesce(e.title, '')) > 200
    ) THEN
      RAISE EXCEPTION 'invalid episode fields in episode list';
    END IF;

    -- Duplicate check: ensure payload does not contain duplicate (season_number, number) entries
    IF (
      SELECT count(*) FROM (
        SELECT DISTINCT e.season_number, e.number
        FROM jsonb_to_recordset(p_episodes) AS e(season_number integer, number integer)
      ) d
    ) <> v_episode_count THEN
      RAISE EXCEPTION 'duplicate episode season_number and number in payload' USING ERRCODE = '23505';
    END IF;

    INSERT INTO public.episodes (
      anime_id, season_number, number, title, description, video_url,
      thumbnail_url, is_published, quality
    )
    SELECT v_anime.id, e.season_number, e.number, e.title, e.description, e.video_url,
           e.thumbnail_url, coalesce(e.is_published, true), coalesce(e.quality, '1080p')
    FROM jsonb_to_recordset(p_episodes) AS e(
      season_number integer, number integer, title text, description text, video_url text,
      thumbnail_url text, is_published boolean, quality text
    );
  END IF;

  RETURN jsonb_build_object('id', v_anime.id, 'title', v_anime.title, 'poster_url', v_anime.poster_url);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_anime_with_episodes(jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_anime_with_episodes(jsonb, jsonb) TO authenticated;

-- Non-destructive compatibility wrapper delegating to atomic admin_update_anime_and_episodes
CREATE OR REPLACE FUNCTION public.admin_replace_anime_episodes(
  p_anime_id uuid,
  p_episodes jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  -- Safe delegation: routes through audited atomic updater
  RETURN public.admin_update_anime_and_episodes(p_anime_id, '{}'::jsonb, p_episodes);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_replace_anime_episodes(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_replace_anime_episodes(uuid, jsonb) TO authenticated;


-- ============================================================================
-- SECTION: 013_profiles_assistant_admins.sql
-- ============================================================================

-- User-owned avatar support already exists in migration 006; this migration adds
-- profile-safe administration and permission-scoped assistant accounts.

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('user', 'moderator', 'admin', 'owner', 'assistant_admin'));

CREATE TABLE IF NOT EXISTS public.assistant_admins (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  appointed_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.assistant_admin_permissions (
  user_id uuid NOT NULL REFERENCES public.assistant_admins(user_id) ON DELETE CASCADE,
  permission_key text NOT NULL CHECK (permission_key IN (
    'anime_view', 'anime_create', 'anime_edit', 'anime_delete',
    'video_upload', 'episode_create', 'episode_edit', 'episode_delete',
    'video_analyze', 'video_review', 'comment_moderate', 'report_view'
  )),
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, permission_key)
);

CREATE TABLE IF NOT EXISTS public.assistant_admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action_name text NOT NULL,
  target_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_record_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.assistant_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_admin_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_admin_audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.assistant_admins, public.assistant_admin_permissions, public.assistant_admin_audit_logs
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.assistant_has_permission(p_permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.assistant_admins aa ON aa.user_id = p.id
    JOIN public.assistant_admin_permissions ap ON ap.user_id = aa.user_id
    WHERE p.id = auth.uid()
      AND p.role = 'assistant_admin'
      AND p.suspended_at IS NULL
      AND ap.permission_key = p_permission
      AND ap.enabled
  );
$$;

CREATE OR REPLACE FUNCTION public.assistant_can_manage_content()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.assistant_admins aa ON aa.user_id = p.id
    JOIN public.assistant_admin_permissions ap ON ap.user_id = aa.user_id
    WHERE p.id = auth.uid() AND p.role = 'assistant_admin' AND p.suspended_at IS NULL
      AND ap.enabled AND ap.permission_key IN (
        'anime_view', 'anime_create', 'anime_edit', 'anime_delete', 'video_upload',
        'episode_create', 'episode_edit', 'episode_delete', 'video_analyze', 'video_review'
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.main_admin_search_assistant_candidates(p_search text DEFAULT '')
RETURNS TABLE (id uuid, username text, display_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'owner' AND suspended_at IS NULL) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF length(coalesce(p_search, '')) > 100 THEN RAISE EXCEPTION 'search text is too long'; END IF;
  RETURN QUERY
  SELECT p.id, p.username, p.display_name
  FROM public.profiles p
  WHERE p.role = 'user' AND p.suspended_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.assistant_admins aa WHERE aa.user_id = p.id)
    AND (nullif(trim(p_search), '') IS NULL
      OR p.username ILIKE '%' || trim(p_search) || '%'
      OR coalesce(p.display_name, '') ILIKE '%' || trim(p_search) || '%')
  ORDER BY p.created_at DESC
  LIMIT 50;
END;
$$;

CREATE OR REPLACE FUNCTION public.main_admin_list_assistant_admins()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_assistants jsonb;
  v_logs jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'owner' AND suspended_at IS NULL) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'username', p.username, 'display_name', p.display_name,
    'avatar_url', p.avatar_url, 'created_at', aa.created_at, 'permissions', perm.permissions
  ) ORDER BY aa.created_at DESC), '[]'::jsonb)
  INTO v_assistants
  FROM public.assistant_admins aa
  JOIN public.profiles p ON p.id = aa.user_id
  LEFT JOIN LATERAL (
    SELECT jsonb_object_agg(ap.permission_key, ap.enabled) AS permissions
    FROM public.assistant_admin_permissions ap WHERE ap.user_id = aa.user_id
  ) perm ON true;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', l.id, 'actor_id', l.actor_id, 'actor_username', actor.username,
    'action_name', l.action_name, 'target_user_id', l.target_user_id,
    'target_username', target.username, 'target_record_id', l.target_record_id,
    'details', l.details, 'created_at', l.created_at
  ) ORDER BY l.created_at DESC), '[]'::jsonb)
  INTO v_logs
  FROM (SELECT * FROM public.assistant_admin_audit_logs ORDER BY created_at DESC LIMIT 100) l
  LEFT JOIN public.profiles actor ON actor.id = l.actor_id
  LEFT JOIN public.profiles target ON target.id = l.target_user_id;
  RETURN jsonb_build_object('assistants', v_assistants, 'audit_logs', v_logs);
END;
$$;

CREATE OR REPLACE FUNCTION public.main_admin_appoint_assistant(p_target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_username text;
  v_key text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_actor AND role = 'owner' AND suspended_at IS NULL) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT username INTO v_username FROM public.profiles
  WHERE id = p_target_user_id AND role = 'user' AND suspended_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'eligible user not found' USING ERRCODE = 'P0002'; END IF;
  INSERT INTO public.assistant_admins(user_id, appointed_by) VALUES (p_target_user_id, v_actor);
  UPDATE public.profiles SET role = 'assistant_admin' WHERE id = p_target_user_id;
  FOREACH v_key IN ARRAY ARRAY[
    'anime_view', 'anime_create', 'anime_edit', 'anime_delete', 'video_upload',
    'episode_create', 'episode_edit', 'episode_delete', 'video_analyze', 'video_review',
    'comment_moderate', 'report_view'
  ] LOOP
    INSERT INTO public.assistant_admin_permissions(user_id, permission_key, enabled)
    VALUES (p_target_user_id, v_key, false);
  END LOOP;
  INSERT INTO public.assistant_admin_audit_logs(actor_id, action_name, target_user_id, details)
  VALUES (v_actor, 'assistant_appointed', p_target_user_id, jsonb_build_object('username', v_username));
END;
$$;

CREATE OR REPLACE FUNCTION public.main_admin_set_assistant_permissions(p_target_user_id uuid, p_permissions jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_key text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_actor AND role = 'owner' AND suspended_at IS NULL) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_permissions) <> 'object' THEN RAISE EXCEPTION 'permissions must be a JSON object'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.assistant_admins WHERE user_id = p_target_user_id) THEN
    RAISE EXCEPTION 'assistant admin not found' USING ERRCODE = 'P0002';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_each(p_permissions) e
    WHERE e.key NOT IN (
      'anime_view', 'anime_create', 'anime_edit', 'anime_delete', 'video_upload',
      'episode_create', 'episode_edit', 'episode_delete', 'video_analyze', 'video_review',
      'comment_moderate', 'report_view'
    ) OR jsonb_typeof(e.value) <> 'boolean'
  ) THEN RAISE EXCEPTION 'invalid assistant permission payload'; END IF;
  FOR v_key IN SELECT permission_key FROM public.assistant_admin_permissions WHERE user_id = p_target_user_id LOOP
    UPDATE public.assistant_admin_permissions
    SET enabled = coalesce((p_permissions->>v_key)::boolean, false), updated_at = now()
    WHERE user_id = p_target_user_id AND permission_key = v_key;
  END LOOP;
  INSERT INTO public.assistant_admin_audit_logs(actor_id, action_name, target_user_id, details)
  VALUES (v_actor, 'assistant_permissions_updated', p_target_user_id,
    jsonb_build_object('permissions', p_permissions));
END;
$$;

CREATE OR REPLACE FUNCTION public.main_admin_remove_assistant(p_target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_username text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_actor AND role = 'owner' AND suspended_at IS NULL) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT username INTO v_username FROM public.profiles
  WHERE id = p_target_user_id AND role = 'assistant_admin' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'assistant admin not found' USING ERRCODE = 'P0002'; END IF;
  INSERT INTO public.assistant_admin_audit_logs(actor_id, action_name, target_user_id, details)
  VALUES (v_actor, 'assistant_removed', p_target_user_id, jsonb_build_object('username', v_username));
  DELETE FROM public.assistant_admins WHERE user_id = p_target_user_id;
  UPDATE public.profiles SET role = 'user' WHERE id = p_target_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.main_admin_revoke_all_assistant_permissions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_count integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_actor AND role = 'owner' AND suspended_at IS NULL) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  UPDATE public.assistant_admin_permissions SET enabled = false, updated_at = now() WHERE enabled;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  INSERT INTO public.assistant_admin_audit_logs(actor_id, action_name, details)
  VALUES (v_actor, 'all_assistant_permissions_revoked', jsonb_build_object('revoked_count', v_count));
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.assistant_create_anime_with_episodes(p_anime jsonb, p_episodes jsonb DEFAULT '[]'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_anime public.animes%ROWTYPE;
  v_episode_count integer;
BEGIN
  IF NOT public.assistant_has_permission('anime_create') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF jsonb_typeof(p_anime) <> 'object' OR jsonb_typeof(coalesce(p_episodes, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'invalid anime or episode payload';
  END IF;
  IF jsonb_array_length(coalesce(p_episodes, '[]'::jsonb)) > 500 THEN RAISE EXCEPTION 'at most 500 episodes are allowed'; END IF;
  IF jsonb_array_length(coalesce(p_episodes, '[]'::jsonb)) > 0 AND NOT (
    public.assistant_has_permission('episode_create') AND public.assistant_has_permission('video_upload')
  ) THEN RAISE EXCEPTION 'episode_create and video_upload permissions are required' USING ERRCODE = '42501'; END IF;
  INSERT INTO public.animes (
    title, alt_title, description, year, status, age_rating, genres, studio, director,
    poster_url, banner_url, is_featured, is_published, release_day, fandub_team
  ) VALUES (
    p_anime->>'title', p_anime->>'alt_title', coalesce(p_anime->>'description', ''),
    nullif(p_anime->>'year', '')::integer, coalesce(p_anime->>'status', 'Tugallangan'),
    coalesce(p_anime->>'age_rating', '12+'),
    ARRAY(SELECT jsonb_array_elements_text(coalesce(p_anime->'genres', '[]'::jsonb))),
    p_anime->>'studio', p_anime->>'director', p_anime->>'poster_url', p_anime->>'banner_url',
    coalesce((p_anime->>'is_featured')::boolean, false), false,
    p_anime->>'release_day', coalesce(p_anime->>'fandub_team', 'Anicity Dub')
  ) RETURNING * INTO v_anime;

  v_episode_count := jsonb_array_length(coalesce(p_episodes, '[]'::jsonb));
  IF v_episode_count > 0 THEN
    IF EXISTS (
      SELECT 1 FROM jsonb_to_recordset(p_episodes) AS e(season_number integer, number integer, title text, video_url text)
      WHERE e.season_number IS NULL OR e.season_number < 1 OR e.number IS NULL OR e.number < 1
        OR e.video_url IS NULL OR e.video_url !~* '^https?://' OR char_length(coalesce(e.title, '')) > 200
    ) THEN RAISE EXCEPTION 'invalid episode fields'; END IF;
    INSERT INTO public.episodes(anime_id, season_number, number, title, description, video_url, thumbnail_url, is_published, quality)
    SELECT v_anime.id, e.season_number, e.number, e.title, e.description, e.video_url,
      e.thumbnail_url, false, coalesce(e.quality, '1080p')
    FROM jsonb_to_recordset(p_episodes) AS e(
      season_number integer, number integer, title text, description text, video_url text,
      thumbnail_url text, is_published boolean, quality text
    );
  END IF;
  RETURN jsonb_build_object('id', v_anime.id, 'title', v_anime.title, 'poster_url', v_anime.poster_url);
END;
$$;

CREATE OR REPLACE FUNCTION public.assistant_update_anime_and_episodes(
  p_anime_id uuid, p_anime jsonb, p_episodes jsonb DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_episode_count integer := 0;
  v_rows integer;
BEGIN
  IF p_anime IS NULL OR jsonb_typeof(p_anime) <> 'object' THEN RAISE EXCEPTION 'anime patch must be a JSON object'; END IF;
  IF p_anime <> '{}'::jsonb AND NOT public.assistant_has_permission('anime_edit') THEN
    RAISE EXCEPTION 'anime_edit permission is required' USING ERRCODE = '42501';
  END IF;
  IF p_episodes IS NOT NULL AND NOT (
    public.assistant_has_permission('episode_edit') AND public.assistant_has_permission('video_upload')
  ) THEN RAISE EXCEPTION 'episode_edit and video_upload permissions are required' USING ERRCODE = '42501'; END IF;
  IF p_anime ? 'genres' AND jsonb_typeof(p_anime->'genres') <> 'array' THEN RAISE EXCEPTION 'genres must be an array'; END IF;

  IF p_anime <> '{}'::jsonb THEN
    UPDATE public.animes SET
      title = CASE WHEN p_anime ? 'title' THEN p_anime->>'title' ELSE title END,
      alt_title = CASE WHEN p_anime ? 'alt_title' THEN p_anime->>'alt_title' ELSE alt_title END,
      year = CASE WHEN p_anime ? 'year' THEN nullif(p_anime->>'year', '')::integer ELSE year END,
      status = CASE WHEN p_anime ? 'status' THEN p_anime->>'status' ELSE status END,
      age_rating = CASE WHEN p_anime ? 'age_rating' THEN p_anime->>'age_rating' ELSE age_rating END,
      studio = CASE WHEN p_anime ? 'studio' THEN p_anime->>'studio' ELSE studio END,
      director = CASE WHEN p_anime ? 'director' THEN p_anime->>'director' ELSE director END,
      genres = CASE WHEN p_anime ? 'genres' THEN ARRAY(SELECT jsonb_array_elements_text(p_anime->'genres')) ELSE genres END,
      description = CASE WHEN p_anime ? 'description' THEN p_anime->>'description' ELSE description END,
      poster_url = CASE WHEN p_anime ? 'poster_url' THEN p_anime->>'poster_url' ELSE poster_url END,
      banner_url = CASE WHEN p_anime ? 'banner_url' THEN p_anime->>'banner_url' ELSE banner_url END,
      is_featured = CASE WHEN p_anime ? 'is_featured' THEN (p_anime->>'is_featured')::boolean ELSE is_featured END,
      is_published = CASE WHEN p_anime ? 'is_published' THEN (p_anime->>'is_published')::boolean ELSE is_published END,
      release_day = CASE WHEN p_anime ? 'release_day' THEN p_anime->>'release_day' ELSE release_day END,
      fandub_team = CASE WHEN p_anime ? 'fandub_team' THEN p_anime->>'fandub_team' ELSE fandub_team END
    WHERE id = p_anime_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 0 THEN RAISE EXCEPTION 'anime not found' USING ERRCODE = 'P0002'; END IF;
  ELSIF NOT EXISTS (SELECT 1 FROM public.animes WHERE id = p_anime_id) THEN
    RAISE EXCEPTION 'anime not found' USING ERRCODE = 'P0002';
  END IF;

  IF p_episodes IS NOT NULL THEN
    IF jsonb_typeof(p_episodes) <> 'array' OR jsonb_array_length(p_episodes) < 1 OR jsonb_array_length(p_episodes) > 500 THEN
      RAISE EXCEPTION 'episode list must contain between 1 and 500 entries';
    END IF;
    IF EXISTS (
      SELECT 1 FROM jsonb_to_recordset(p_episodes) AS e(season_number integer, number integer, title text, video_url text)
      WHERE e.season_number IS NULL OR e.season_number < 1 OR e.number IS NULL OR e.number < 1
        OR e.video_url IS NULL OR e.video_url !~* '^https?://' OR char_length(coalesce(e.title, '')) > 200
    ) THEN RAISE EXCEPTION 'invalid episode fields'; END IF;
    DELETE FROM public.episodes WHERE anime_id = p_anime_id;
    INSERT INTO public.episodes(anime_id, season_number, number, title, description, video_url, thumbnail_url, is_published, quality)
    SELECT p_anime_id, e.season_number, e.number, e.title, e.description, e.video_url,
      e.thumbnail_url, false, coalesce(e.quality, '1080p')
    FROM jsonb_to_recordset(p_episodes) AS e(
      season_number integer, number integer, title text, description text, video_url text,
      thumbnail_url text, is_published boolean, quality text
    );
    GET DIAGNOSTICS v_episode_count = ROW_COUNT;
  END IF;
  RETURN v_episode_count;
END;
$$;

DROP POLICY IF EXISTS "avatars own insert" ON storage.objects;
CREATE POLICY "avatars own insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'profile-avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND array_length(string_to_array(name, '/'), 1) = 2
    AND lower(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp')
  );

DROP POLICY IF EXISTS "avatars own update" ON storage.objects;
CREATE POLICY "avatars own update" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'profile-avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'profile-avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND array_length(string_to_array(name, '/'), 1) = 2
    AND lower(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp')
  );

DROP POLICY IF EXISTS "avatars own delete" ON storage.objects;
CREATE POLICY "avatars own delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'profile-avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

-- Read/write policies are permission scoped; financial and user-management tables remain inaccessible.
DROP POLICY IF EXISTS "assistant anime read" ON public.animes;
CREATE POLICY "assistant anime read" ON public.animes FOR SELECT TO authenticated
  USING (public.assistant_can_manage_content());
DROP POLICY IF EXISTS "assistant anime create" ON public.animes;
CREATE POLICY "assistant anime create" ON public.animes FOR INSERT TO authenticated
  WITH CHECK (public.assistant_has_permission('anime_create'));
DROP POLICY IF EXISTS "assistant anime edit" ON public.animes;
CREATE POLICY "assistant anime edit" ON public.animes FOR UPDATE TO authenticated
  USING (public.assistant_has_permission('anime_edit')) WITH CHECK (public.assistant_has_permission('anime_edit'));
DROP POLICY IF EXISTS "assistant anime delete" ON public.animes;
CREATE POLICY "assistant anime delete" ON public.animes FOR DELETE TO authenticated
  USING (public.assistant_has_permission('anime_delete'));

DROP POLICY IF EXISTS "assistant episodes read" ON public.episodes;
CREATE POLICY "assistant episodes read" ON public.episodes FOR SELECT TO authenticated
  USING (public.assistant_can_manage_content());
DROP POLICY IF EXISTS "assistant episodes create" ON public.episodes;
CREATE POLICY "assistant episodes create" ON public.episodes FOR INSERT TO authenticated
  WITH CHECK (public.assistant_has_permission('episode_create') AND public.assistant_has_permission('video_upload'));
DROP POLICY IF EXISTS "assistant episodes edit" ON public.episodes;
CREATE POLICY "assistant episodes edit" ON public.episodes FOR UPDATE TO authenticated
  USING (public.assistant_has_permission('episode_edit')) WITH CHECK (public.assistant_has_permission('episode_edit'));
DROP POLICY IF EXISTS "assistant episodes video source" ON public.episodes;
CREATE POLICY "assistant episodes video source" ON public.episodes FOR UPDATE TO authenticated
  USING (public.assistant_has_permission('video_upload')) WITH CHECK (public.assistant_has_permission('video_upload'));
DROP POLICY IF EXISTS "assistant episodes delete" ON public.episodes;
CREATE POLICY "assistant episodes delete" ON public.episodes FOR DELETE TO authenticated
  USING (public.assistant_has_permission('episode_delete'));

CREATE OR REPLACE FUNCTION public.prevent_assistant_content_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'assistant_admin') THEN
    IF coalesce(NEW.is_published, false) AND (TG_OP = 'INSERT' OR NOT coalesce(OLD.is_published, false)) THEN
      RAISE EXCEPTION 'assistant admins cannot publish content' USING ERRCODE = '42501';
    END IF;
    IF TG_TABLE_NAME = 'episodes' AND TG_OP = 'UPDATE' THEN
      IF NEW.video_url IS DISTINCT FROM OLD.video_url
         AND NOT public.assistant_has_permission('video_upload') THEN
        RAISE EXCEPTION 'video_upload permission is required' USING ERRCODE = '42501';
      END IF;
      IF NOT public.assistant_has_permission('episode_edit') AND (
        NEW.anime_id IS DISTINCT FROM OLD.anime_id OR
        NEW.season_number IS DISTINCT FROM OLD.season_number OR
        NEW.number IS DISTINCT FROM OLD.number OR
        NEW.title IS DISTINCT FROM OLD.title OR
        NEW.description IS DISTINCT FROM OLD.description OR
        NEW.thumbnail_url IS DISTINCT FROM OLD.thumbnail_url OR
        NEW.quality IS DISTINCT FROM OLD.quality OR
        NEW.is_published IS DISTINCT FROM OLD.is_published
      ) THEN
        RAISE EXCEPTION 'episode_edit permission is required' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assistant_anime_content_guard ON public.animes;
CREATE TRIGGER assistant_anime_content_guard BEFORE INSERT OR UPDATE ON public.animes
  FOR EACH ROW EXECUTE FUNCTION public.prevent_assistant_content_escalation();
DROP TRIGGER IF EXISTS assistant_episode_content_guard ON public.episodes;
CREATE TRIGGER assistant_episode_content_guard BEFORE INSERT OR UPDATE ON public.episodes
  FOR EACH ROW EXECUTE FUNCTION public.prevent_assistant_content_escalation();

REVOKE ALL ON FUNCTION public.assistant_has_permission(text) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.assistant_can_manage_content() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.main_admin_search_assistant_candidates(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.main_admin_list_assistant_admins() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.main_admin_appoint_assistant(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.main_admin_set_assistant_permissions(uuid, jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.main_admin_remove_assistant(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.main_admin_revoke_all_assistant_permissions() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.assistant_create_anime_with_episodes(jsonb, jsonb) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.assistant_update_anime_and_episodes(uuid, jsonb, jsonb) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.prevent_assistant_content_escalation() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.assistant_has_permission(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assistant_can_manage_content() TO authenticated;
GRANT EXECUTE ON FUNCTION public.main_admin_search_assistant_candidates(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.main_admin_list_assistant_admins() TO authenticated;
GRANT EXECUTE ON FUNCTION public.main_admin_appoint_assistant(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.main_admin_set_assistant_permissions(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.main_admin_remove_assistant(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.main_admin_revoke_all_assistant_permissions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.assistant_create_anime_with_episodes(jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assistant_update_anime_and_episodes(uuid, jsonb, jsonb) TO authenticated;


-- ============================================================================
-- SECTION: 014_assistant_permission_boundaries.sql
-- ============================================================================

-- Tighten assistant read scope and protect the episode-replacement RPC.
-- Migration 013 remains immutable; this migration only adds forward-compatible guards.

CREATE OR REPLACE FUNCTION public.assistant_can_manage_content()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.assistant_admin_permissions ap ON ap.user_id = p.id
    WHERE p.id = auth.uid()
      AND p.role = 'assistant_admin'
      AND p.suspended_at IS NULL
      AND ap.enabled
      AND ap.permission_key IN (
        'anime_view', 'anime_edit', 'anime_delete', 'video_upload',
        'episode_create', 'episode_edit', 'episode_delete'
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.assistant_update_anime_and_episodes_authorized(
  p_anime_id uuid, p_anime jsonb, p_episodes jsonb DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_actor AND role = 'assistant_admin' AND suspended_at IS NULL
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_anime IS NULL OR jsonb_typeof(p_anime) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'anime patch must be a JSON object';
  END IF;
  IF p_anime <> '{}'::jsonb AND NOT public.assistant_has_permission('anime_edit') THEN
    RAISE EXCEPTION 'anime_edit permission is required' USING ERRCODE = '42501';
  END IF;

  -- The legacy RPC replaces the whole episode set (delete + insert). Require
  -- every corresponding permission before invoking it under this definer.
  IF p_episodes IS NOT NULL AND NOT (
    public.assistant_has_permission('episode_edit')
    AND public.assistant_has_permission('episode_create')
    AND public.assistant_has_permission('episode_delete')
    AND public.assistant_has_permission('video_upload')
  ) THEN
    RAISE EXCEPTION 'episode_edit, episode_create, episode_delete and video_upload permissions are required'
      USING ERRCODE = '42501';
  END IF;

  RETURN public.assistant_update_anime_and_episodes(p_anime_id, p_anime, p_episodes);
END;
$$;

REVOKE ALL ON FUNCTION public.assistant_update_anime_and_episodes(uuid, jsonb, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.assistant_update_anime_and_episodes_authorized(uuid, jsonb, jsonb)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.assistant_update_anime_and_episodes_authorized(uuid, jsonb, jsonb)
  TO authenticated;

REVOKE ALL ON FUNCTION public.assistant_can_manage_content() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.assistant_can_manage_content() TO authenticated;


-- ============================================================================
-- SECTION: 015_assistant_security_audit_fixes.sql
-- ============================================================================

-- Forward-only assistant security and audit fixes. Safe to re-run.

-- Harden every SECURITY DEFINER function introduced/changed in migrations 011-013.
ALTER FUNCTION public.admin_list_users(integer, integer, text, text) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.admin_create_anime_with_episodes(jsonb, jsonb) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.admin_replace_anime_episodes(uuid, jsonb) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.admin_grant_user_subscription(uuid, uuid, integer, text) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.admin_extend_user_subscription(uuid, integer, text) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.admin_revoke_user_subscription(uuid, text) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.admin_toggle_user_vip(uuid) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.admin_update_anime_and_episodes(uuid, jsonb, jsonb) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.assistant_has_permission(text) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.assistant_can_manage_content() SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.main_admin_search_assistant_candidates(text) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.main_admin_list_assistant_admins() SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.main_admin_appoint_assistant(uuid) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.main_admin_set_assistant_permissions(uuid, jsonb) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.main_admin_remove_assistant(uuid) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.main_admin_revoke_all_assistant_permissions() SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.assistant_create_anime_with_episodes(jsonb, jsonb) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.assistant_update_anime_and_episodes(uuid, jsonb, jsonb) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.assistant_update_anime_and_episodes_authorized(uuid, jsonb, jsonb) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.prevent_assistant_content_escalation() SET search_path = pg_catalog, public, pg_temp;

-- Do not allow application roles to create objects in the function search schema.
REVOKE CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.assistant_can_manage_content()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.assistant_admin_permissions ap ON ap.user_id = p.id
    WHERE p.id = auth.uid() AND p.role = 'assistant_admin' AND p.suspended_at IS NULL
      AND ap.enabled AND (
        ap.permission_key IN ('anime_view', 'anime_edit', 'anime_delete', 'episode_edit', 'episode_delete')
        OR (ap.permission_key = 'episode_create' AND public.assistant_has_permission('video_upload'))
      )
  );
$$;
DROP POLICY IF EXISTS "assistant anime read" ON public.animes;
CREATE POLICY "assistant anime read" ON public.animes FOR SELECT TO authenticated
  USING (public.assistant_can_manage_content());
DROP POLICY IF EXISTS "assistant episodes read" ON public.episodes;
CREATE POLICY "assistant episodes read" ON public.episodes FOR SELECT TO authenticated
  USING (public.assistant_can_manage_content());
REVOKE ALL ON FUNCTION public.assistant_can_manage_content() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.assistant_can_manage_content() TO authenticated;

-- Inert feature keys remain in the schema for compatibility but cannot be enabled.
UPDATE public.assistant_admin_permissions
SET enabled = false, updated_at = now()
WHERE permission_key IN ('video_review', 'comment_moderate', 'report_view') AND enabled;

CREATE OR REPLACE FUNCTION public.main_admin_set_assistant_permissions(p_target_user_id uuid, p_permissions jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_key text;
  v_expected_count integer := 12;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_actor AND role = 'owner' AND suspended_at IS NULL) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_permissions IS NULL OR jsonb_typeof(p_permissions) IS DISTINCT FROM 'object'
     OR (SELECT count(*) FROM jsonb_object_keys(p_permissions)) <> v_expected_count THEN
    RAISE EXCEPTION 'permissions must be a complete JSON object';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_each(p_permissions) e
    WHERE e.key NOT IN ('anime_view','anime_create','anime_edit','anime_delete','video_upload',
      'episode_create','episode_edit','episode_delete','video_analyze','video_review','comment_moderate','report_view')
      OR jsonb_typeof(e.value) IS DISTINCT FROM 'boolean'
      OR (e.key IN ('video_review','comment_moderate','report_view') AND e.value = 'true'::jsonb)
  ) THEN RAISE EXCEPTION 'invalid or unavailable assistant permission'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.assistant_admins WHERE user_id = p_target_user_id) THEN
    RAISE EXCEPTION 'assistant admin not found' USING ERRCODE = 'P0002';
  END IF;
  FOR v_key IN SELECT permission_key FROM public.assistant_admin_permissions WHERE user_id = p_target_user_id LOOP
    UPDATE public.assistant_admin_permissions
    SET enabled = (p_permissions->>v_key)::boolean, updated_at = now()
    WHERE user_id = p_target_user_id AND permission_key = v_key;
  END LOOP;
  INSERT INTO public.assistant_admin_audit_logs(actor_id, action_name, target_user_id, details)
  VALUES (v_actor, 'assistant_permissions_updated', p_target_user_id, p_permissions);
END;
$$;
REVOKE ALL ON FUNCTION public.main_admin_set_assistant_permissions(uuid, jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.main_admin_set_assistant_permissions(uuid, jsonb) TO authenticated;

-- Replacement is one transaction. Match by the existing unique (anime_id, number)
-- identity, retain row IDs and published state, and refuse to discard published rows.
CREATE OR REPLACE FUNCTION public.assistant_update_anime_and_episodes(
  p_anime_id uuid, p_anime jsonb, p_episodes jsonb DEFAULT NULL
)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_episode_count integer := 0;
  v_rows integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_actor AND role = 'assistant_admin' AND suspended_at IS NULL) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_anime IS NULL OR jsonb_typeof(p_anime) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'anime patch must be an object'; END IF;
  IF p_anime <> '{}'::jsonb AND NOT public.assistant_has_permission('anime_edit') THEN RAISE EXCEPTION 'anime_edit required' USING ERRCODE = '42501'; END IF;
  IF p_episodes IS NOT NULL AND NOT (
    public.assistant_has_permission('episode_edit') AND public.assistant_has_permission('episode_create')
    AND public.assistant_has_permission('episode_delete') AND public.assistant_has_permission('video_upload')
  ) THEN RAISE EXCEPTION 'all episode replacement permissions are required' USING ERRCODE = '42501'; END IF;
  IF p_anime ? 'genres' AND jsonb_typeof(p_anime->'genres') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'genres must be an array'; END IF;

  PERFORM 1 FROM public.animes WHERE id = p_anime_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'anime not found' USING ERRCODE = 'P0002'; END IF;
  IF p_anime <> '{}'::jsonb THEN
    UPDATE public.animes SET
      title = CASE WHEN p_anime ? 'title' THEN p_anime->>'title' ELSE title END,
      alt_title = CASE WHEN p_anime ? 'alt_title' THEN p_anime->>'alt_title' ELSE alt_title END,
      year = CASE WHEN p_anime ? 'year' THEN nullif(p_anime->>'year', '')::integer ELSE year END,
      status = CASE WHEN p_anime ? 'status' THEN p_anime->>'status' ELSE status END,
      age_rating = CASE WHEN p_anime ? 'age_rating' THEN p_anime->>'age_rating' ELSE age_rating END,
      studio = CASE WHEN p_anime ? 'studio' THEN p_anime->>'studio' ELSE studio END,
      director = CASE WHEN p_anime ? 'director' THEN p_anime->>'director' ELSE director END,
      genres = CASE WHEN p_anime ? 'genres' THEN ARRAY(SELECT jsonb_array_elements_text(p_anime->'genres')) ELSE genres END,
      description = CASE WHEN p_anime ? 'description' THEN p_anime->>'description' ELSE description END,
      poster_url = CASE WHEN p_anime ? 'poster_url' THEN p_anime->>'poster_url' ELSE poster_url END,
      banner_url = CASE WHEN p_anime ? 'banner_url' THEN p_anime->>'banner_url' ELSE banner_url END,
      is_featured = CASE WHEN p_anime ? 'is_featured' THEN (p_anime->>'is_featured')::boolean ELSE is_featured END,
      is_published = CASE WHEN p_anime ? 'is_published' THEN (p_anime->>'is_published')::boolean ELSE is_published END,
      release_day = CASE WHEN p_anime ? 'release_day' THEN p_anime->>'release_day' ELSE release_day END,
      fandub_team = CASE WHEN p_anime ? 'fandub_team' THEN p_anime->>'fandub_team' ELSE fandub_team END
    WHERE id = p_anime_id;
  END IF;

  IF p_episodes IS NOT NULL THEN
    IF jsonb_typeof(p_episodes) IS DISTINCT FROM 'array' OR jsonb_array_length(p_episodes) < 1 OR jsonb_array_length(p_episodes) > 500 THEN
      RAISE EXCEPTION 'episode list must contain 1..500 entries';
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_to_recordset(p_episodes) AS e(season_number integer, number integer, title text, video_url text, is_published boolean)
      WHERE e.season_number IS NULL OR e.season_number < 1 OR e.number IS NULL OR e.number < 1
        OR e.video_url IS NULL OR e.video_url !~* '^https?://' OR coalesce(e.is_published, false)) THEN
      RAISE EXCEPTION 'invalid episode fields or assistant publish attempt';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.episodes old
      WHERE old.anime_id = p_anime_id AND old.is_published
        AND NOT EXISTS (SELECT 1 FROM jsonb_to_recordset(p_episodes) AS e(number integer) WHERE e.number = old.number)
    ) THEN RAISE EXCEPTION 'published episodes cannot be removed by an assistant'; END IF;

    UPDATE public.episodes old SET
      season_number = e.season_number, number = e.number, title = e.title, description = e.description,
      video_url = e.video_url, thumbnail_url = e.thumbnail_url, quality = coalesce(e.quality, '1080p')
    FROM jsonb_to_recordset(p_episodes) AS e(
      season_number integer, number integer, title text, description text, video_url text,
      thumbnail_url text, is_published boolean, quality text
    )
    WHERE old.anime_id = p_anime_id AND old.number = e.number;
    DELETE FROM public.episodes old WHERE old.anime_id = p_anime_id
      AND NOT EXISTS (SELECT 1 FROM jsonb_to_recordset(p_episodes) AS e(number integer) WHERE e.number = old.number);
    INSERT INTO public.episodes(anime_id, season_number, number, title, description, video_url, thumbnail_url, is_published, quality)
    SELECT p_anime_id, e.season_number, e.number, e.title, e.description, e.video_url, e.thumbnail_url, false, coalesce(e.quality, '1080p')
    FROM jsonb_to_recordset(p_episodes) AS e(
      season_number integer, number integer, title text, description text, video_url text,
      thumbnail_url text, is_published boolean, quality text
    ) WHERE NOT EXISTS (SELECT 1 FROM public.episodes old WHERE old.anime_id = p_anime_id AND old.number = e.number);
    v_episode_count := jsonb_array_length(p_episodes);
  END IF;
  RETURN v_episode_count;
END;
$$;

-- Successful assistant content changes are captured by row triggers. Snapshots omit
-- video URLs and user-supplied text; only bounded metadata and IDs are stored.
CREATE OR REPLACE FUNCTION public.audit_assistant_content_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_action text;
  v_record_id text;
  v_details jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_actor AND role = 'assistant_admin') THEN
    RETURN NULL;
  END IF;
  v_record_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id::text ELSE NEW.id::text END;
  IF TG_TABLE_NAME = 'animes' THEN
    v_action := CASE TG_OP WHEN 'INSERT' THEN 'anime_created' WHEN 'UPDATE' THEN 'anime_updated' ELSE 'anime_deleted' END;
    v_details := jsonb_build_object('entity','anime','operation',TG_OP,
      'published',CASE WHEN TG_OP = 'DELETE' THEN OLD.is_published ELSE NEW.is_published END,
      'year',CASE WHEN TG_OP = 'DELETE' THEN OLD.year ELSE NEW.year END);
  ELSE
    v_action := CASE TG_OP WHEN 'INSERT' THEN 'episode_created' WHEN 'UPDATE' THEN
      CASE WHEN NEW.video_url IS DISTINCT FROM OLD.video_url THEN 'episode_video_source_changed' ELSE 'episode_updated' END
      ELSE 'episode_deleted' END;
    v_details := jsonb_build_object('entity','episode','operation',TG_OP,
      'anime_id',CASE WHEN TG_OP = 'DELETE' THEN OLD.anime_id ELSE NEW.anime_id END,
      'number',CASE WHEN TG_OP = 'DELETE' THEN OLD.number ELSE NEW.number END,
      'published',CASE WHEN TG_OP = 'DELETE' THEN OLD.is_published ELSE NEW.is_published END,
      'video_url_changed',TG_OP = 'UPDATE' AND NEW.video_url IS DISTINCT FROM OLD.video_url);
  END IF;
  INSERT INTO public.assistant_admin_audit_logs(actor_id, action_name, target_record_id, details)
  VALUES (v_actor, v_action, v_record_id, v_details || jsonb_build_object('result','success'));
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS assistant_anime_audit ON public.animes;
CREATE TRIGGER assistant_anime_audit AFTER INSERT OR UPDATE OR DELETE ON public.animes
  FOR EACH ROW EXECUTE FUNCTION public.audit_assistant_content_change();
DROP TRIGGER IF EXISTS assistant_episode_audit ON public.episodes;
CREATE TRIGGER assistant_episode_audit AFTER INSERT OR UPDATE OR DELETE ON public.episodes
  FOR EACH ROW EXECUTE FUNCTION public.audit_assistant_content_change();
REVOKE ALL ON FUNCTION public.audit_assistant_content_change() FROM PUBLIC, anon, authenticated, service_role;

-- Server handlers may record failures using only a verified JWT subject and a
-- small allowlist. No caller-supplied actor, raw error, URL, or payload is stored.
CREATE OR REPLACE FUNCTION public.assistant_log_content_failure(
  p_action text, p_target_record_id text DEFAULT NULL, p_target_anime_id uuid DEFAULT NULL,
  p_failure_code text DEFAULT 'operation_failed'
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = v_actor AND role = 'assistant_admin' AND suspended_at IS NULL
  ) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF p_action IS NULL OR p_failure_code IS NULL
     OR p_action NOT IN ('anime_create','anime_update','anime_delete','episode_create','episode_update','episode_delete','episode_replace','video_source_change')
     OR p_failure_code NOT IN ('validation_failed','authorization_denied','operation_failed')
     OR (p_target_record_id IS NOT NULL AND p_target_record_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') THEN
    RAISE EXCEPTION 'invalid audit event';
  END IF;
  INSERT INTO public.assistant_admin_audit_logs(actor_id, action_name, target_record_id, details)
  VALUES (v_actor, p_action || '_failed', p_target_record_id,
    jsonb_build_object('result','failure','failure_code',p_failure_code,'anime_id',p_target_anime_id));
END;
$$;
REVOKE ALL ON FUNCTION public.assistant_log_content_failure(text, text, uuid, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.assistant_log_content_failure(text, text, uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.assistant_update_anime_and_episodes(uuid, jsonb, jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.assistant_update_anime_and_episodes_authorized(uuid, jsonb, jsonb) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.assistant_update_anime_and_episodes_authorized(uuid, jsonb, jsonb) TO authenticated;

-- Avatar security guard: prevent direct injection of unauthorized or external avatar URLs into profiles
CREATE OR REPLACE FUNCTION public.profiles_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.role IS DISTINCT FROM OLD.role
       OR NEW.suspended_at IS DISTINCT FROM OLD.suspended_at
       OR NEW.subscription_plan IS DISTINCT FROM OLD.subscription_plan
       OR NEW.subscription_expires_at IS DISTINCT FROM OLD.subscription_expires_at THEN
      RAISE EXCEPTION 'privileged fields can only be changed by an administrator'
        USING ERRCODE = '42501';
    END IF;

    -- Strict avatar URL validation: must be NULL or match own profile-avatars folder with allowed image extension
    IF NEW.avatar_url IS DISTINCT FROM OLD.avatar_url AND NEW.avatar_url IS NOT NULL THEN
      IF NEW.avatar_url !~* ('^https?://[^/]+/storage/v1/object/public/profile-avatars/' || auth.uid()::text || '/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$') THEN
        RAISE EXCEPTION 'invalid or unauthorized avatar url'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


-- ============================================================================
-- SECTION: 016_episode_replacement_identity.sql
-- ============================================================================

-- Correct the assistant replacement match key: migration 008 allows the same
-- episode number in different seasons, so identity is (anime_id, season_number, number).
CREATE OR REPLACE FUNCTION public.assistant_update_anime_and_episodes(
  p_anime_id uuid, p_anime jsonb, p_episodes jsonb DEFAULT NULL
)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_episode_count integer := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_actor AND role = 'assistant_admin' AND suspended_at IS NULL) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_anime IS NULL OR jsonb_typeof(p_anime) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'anime patch must be an object';
  END IF;
  IF p_anime <> '{}'::jsonb AND NOT public.assistant_has_permission('anime_edit') THEN
    RAISE EXCEPTION 'anime_edit required' USING ERRCODE = '42501';
  END IF;
  IF p_episodes IS NOT NULL AND NOT (
    public.assistant_has_permission('episode_edit') AND public.assistant_has_permission('episode_create')
    AND public.assistant_has_permission('episode_delete') AND public.assistant_has_permission('video_upload')
  ) THEN RAISE EXCEPTION 'all episode replacement permissions are required' USING ERRCODE = '42501'; END IF;
  IF p_anime ? 'genres' AND jsonb_typeof(p_anime->'genres') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'genres must be an array';
  END IF;

  PERFORM 1 FROM public.animes WHERE id = p_anime_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'anime not found' USING ERRCODE = 'P0002'; END IF;
  IF p_anime <> '{}'::jsonb THEN
    UPDATE public.animes SET
      title = CASE WHEN p_anime ? 'title' THEN p_anime->>'title' ELSE title END,
      alt_title = CASE WHEN p_anime ? 'alt_title' THEN p_anime->>'alt_title' ELSE alt_title END,
      year = CASE WHEN p_anime ? 'year' THEN nullif(p_anime->>'year', '')::integer ELSE year END,
      status = CASE WHEN p_anime ? 'status' THEN p_anime->>'status' ELSE status END,
      age_rating = CASE WHEN p_anime ? 'age_rating' THEN p_anime->>'age_rating' ELSE age_rating END,
      studio = CASE WHEN p_anime ? 'studio' THEN p_anime->>'studio' ELSE studio END,
      director = CASE WHEN p_anime ? 'director' THEN p_anime->>'director' ELSE director END,
      genres = CASE WHEN p_anime ? 'genres' THEN ARRAY(SELECT jsonb_array_elements_text(p_anime->'genres')) ELSE genres END,
      description = CASE WHEN p_anime ? 'description' THEN p_anime->>'description' ELSE description END,
      poster_url = CASE WHEN p_anime ? 'poster_url' THEN p_anime->>'poster_url' ELSE poster_url END,
      banner_url = CASE WHEN p_anime ? 'banner_url' THEN p_anime->>'banner_url' ELSE banner_url END,
      is_featured = CASE WHEN p_anime ? 'is_featured' THEN (p_anime->>'is_featured')::boolean ELSE is_featured END,
      is_published = CASE WHEN p_anime ? 'is_published' THEN (p_anime->>'is_published')::boolean ELSE is_published END,
      release_day = CASE WHEN p_anime ? 'release_day' THEN p_anime->>'release_day' ELSE release_day END,
      fandub_team = CASE WHEN p_anime ? 'fandub_team' THEN p_anime->>'fandub_team' ELSE fandub_team END
    WHERE id = p_anime_id;
  END IF;

  IF p_episodes IS NOT NULL THEN
    IF jsonb_typeof(p_episodes) IS DISTINCT FROM 'array' OR jsonb_array_length(p_episodes) < 1 OR jsonb_array_length(p_episodes) > 500 THEN
      RAISE EXCEPTION 'episode list must contain 1..500 entries';
    END IF;
    IF EXISTS (
      SELECT 1 FROM jsonb_to_recordset(p_episodes) AS e(season_number integer, number integer, title text, video_url text, is_published boolean)
      WHERE e.season_number IS NULL OR e.season_number < 1 OR e.number IS NULL OR e.number < 1
        OR e.video_url IS NULL OR e.video_url !~* '^https?://' OR coalesce(e.is_published, false)
    ) THEN RAISE EXCEPTION 'invalid episode fields or assistant publish attempt'; END IF;
    IF EXISTS (
      SELECT 1 FROM public.episodes old
      WHERE old.anime_id = p_anime_id AND old.is_published
        AND NOT EXISTS (
          SELECT 1 FROM jsonb_to_recordset(p_episodes) AS e(season_number integer, number integer)
          WHERE e.season_number = old.season_number AND e.number = old.number
        )
    ) THEN RAISE EXCEPTION 'published episodes cannot be removed by an assistant'; END IF;

    UPDATE public.episodes old SET
      season_number = e.season_number, number = e.number, title = e.title, description = e.description,
      video_url = e.video_url, thumbnail_url = e.thumbnail_url, quality = coalesce(e.quality, '1080p')
    FROM jsonb_to_recordset(p_episodes) AS e(
      season_number integer, number integer, title text, description text, video_url text,
      thumbnail_url text, is_published boolean, quality text
    )
    WHERE old.anime_id = p_anime_id AND old.season_number = e.season_number AND old.number = e.number;

    DELETE FROM public.episodes old WHERE old.anime_id = p_anime_id
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_to_recordset(p_episodes) AS e(season_number integer, number integer)
        WHERE e.season_number = old.season_number AND e.number = old.number
      );

    INSERT INTO public.episodes(anime_id, season_number, number, title, description, video_url, thumbnail_url, is_published, quality)
    SELECT p_anime_id, e.season_number, e.number, e.title, e.description, e.video_url,
      e.thumbnail_url, false, coalesce(e.quality, '1080p')
    FROM jsonb_to_recordset(p_episodes) AS e(
      season_number integer, number integer, title text, description text, video_url text,
      thumbnail_url text, is_published boolean, quality text
    )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.episodes old WHERE old.anime_id = p_anime_id
        AND old.season_number = e.season_number AND old.number = e.number
    );
    v_episode_count := jsonb_array_length(p_episodes);
  END IF;
  RETURN v_episode_count;
END;
$$;

-- Preserve the permission boundary from 014/015: callers use the authorized wrapper;
-- direct execution of this definer remains revoked.
REVOKE ALL ON FUNCTION public.assistant_update_anime_and_episodes(uuid, jsonb, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;


-- ============================================================================
-- SECTION: 017_distributed_rate_limiting.sql
-- ============================================================================

-- Migration 017: Distributed Atomic Rate Limiting for Vercel Serverless (Hardened)
-- Creates shared persistent rate limiting table and atomic RPC function restricted to service_role

CREATE TABLE IF NOT EXISTS public.rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 1,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT rate_limits_key_len CHECK (length(key) <= 128)
);

-- Index for automatic expiration lookups
CREATE INDEX IF NOT EXISTS idx_rate_limits_expires_at ON public.rate_limits(expires_at);

-- Enable RLS
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- RLS: Only authenticated administrators can view rate limit metrics; no direct client mutations
DROP POLICY IF EXISTS "Admins can view rate limits" ON public.rate_limits;
CREATE POLICY "Admins can view rate limits" ON public.rate_limits FOR SELECT TO authenticated USING (is_admin());

-- Atomic sliding-window rate limit checker
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key TEXT,
  p_max_attempts INTEGER,
  p_window_seconds INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_count INTEGER;
  v_expires_at TIMESTAMPTZ;
  v_now TIMESTAMPTZ := now();
  v_window INTERVAL;
  v_allowed BOOLEAN;
  v_remaining INTEGER;
  v_reset_seconds INTEGER;
BEGIN
  -- Strict Parameter Validation to prevent abuse & arbitrary record generation
  IF p_key IS NULL OR length(trim(p_key)) = 0 OR length(p_key) > 128 THEN
    RAISE EXCEPTION 'Invalid rate limit key: must be between 1 and 128 characters' USING errcode = '22023';
  END IF;

  IF p_max_attempts IS NULL OR p_max_attempts < 1 OR p_max_attempts > 10000 THEN
    RAISE EXCEPTION 'Invalid max attempts: must be between 1 and 10000' USING errcode = '22023';
  END IF;

  IF p_window_seconds IS NULL OR p_window_seconds < 1 OR p_window_seconds > 86400 THEN
    RAISE EXCEPTION 'Invalid window seconds: must be between 1 and 86400' USING errcode = '22023';
  END IF;

  v_window := (p_window_seconds || ' seconds')::interval;

  -- Opportunistic garbage collection: 5% chance per invocation to purge stale records older than 1 hour
  IF (random() < 0.05) THEN
    DELETE FROM public.rate_limits WHERE expires_at < (v_now - INTERVAL '1 hour');
  END IF;

  -- Atomic upsert: insert fresh record or increment active counter
  INSERT INTO public.rate_limits (key, count, expires_at, created_at, updated_at)
  VALUES (p_key, 1, v_now + v_window, v_now, v_now)
  ON CONFLICT (key) DO UPDATE
  SET
    count = CASE
      WHEN public.rate_limits.expires_at < v_now THEN 1
      ELSE public.rate_limits.count + 1
    END,
    expires_at = CASE
      WHEN public.rate_limits.expires_at < v_now THEN v_now + v_window
      ELSE public.rate_limits.expires_at
    END,
    updated_at = v_now
  RETURNING public.rate_limits.count, public.rate_limits.expires_at
  INTO v_count, v_expires_at;

  v_allowed := (v_count <= p_max_attempts);
  v_remaining := GREATEST(0, p_max_attempts - v_count);
  v_reset_seconds := GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_expires_at - v_now)))::integer);

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'remaining', v_remaining,
    'reset_seconds', v_reset_seconds,
    'current_count', v_count
  );
END;
$$;

-- Revoke execute from public/anon/authenticated; GRANT SOLELY to service_role
REVOKE ALL ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;


-- ============================================================================
-- SECTION: 018_vip_access_columns.sql
-- ============================================================================

-- ============================================================================
-- 018_vip_access_columns.sql — VIP Gating Schema Columns & Query Optimization
-- ============================================================================

-- 1. Add requires_vip to episodes
ALTER TABLE public.episodes 
ADD COLUMN IF NOT EXISTS requires_vip BOOLEAN NOT NULL DEFAULT false;

-- 2. Add is_vip_only to animes
ALTER TABLE public.animes 
ADD COLUMN IF NOT EXISTS is_vip_only BOOLEAN NOT NULL DEFAULT false;

-- 3. Indexes for fast filtering on catalog and watch pages
CREATE INDEX IF NOT EXISTS idx_episodes_requires_vip ON public.episodes (requires_vip);
CREATE INDEX IF NOT EXISTS idx_animes_is_vip_only ON public.animes (is_vip_only);


-- ============================================================================
-- SECTION: 019_guest_access_and_security.sql
-- ============================================================================

-- ============================================================================
-- 019_guest_access_and_security.sql — Guest (Anon) Catalog Access & Public RLS
-- ============================================================================
-- Allows non-authenticated visitors (guests) and SEO crawlers to view
-- published animes, episodes list, trailers, active banners, and plans.
-- Write operations remain strictly restricted to staff/admins.
-- ============================================================================

-- 1. SCHEMA PERMISSIONS FOR ANON ROLE
GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT ON public.animes TO anon, authenticated;
GRANT SELECT ON public.banners TO anon, authenticated;
GRANT SELECT ON public.trailers TO anon, authenticated;
GRANT SELECT ON public.seasons TO anon, authenticated;
GRANT SELECT ON public.episode_subtitles TO anon, authenticated;
GRANT SELECT ON public.subscription_plans TO anon, authenticated;
GRANT SELECT ON public.site_settings TO anon, authenticated;

-- Episodes: Authenticated users select episodes governed by RLS.
-- Anon visitors are granted select only on non-sensitive catalog columns (video_url strictly withheld from anon).
GRANT SELECT ON public.episodes TO authenticated;
REVOKE SELECT ON public.episodes FROM anon;
GRANT SELECT (id, anime_id, season_id, season_number, number, title, description, thumbnail_url, duration_seconds, is_published, quality, requires_vip, created_at, updated_at) ON public.episodes TO anon;

-- 2. RLS POLICIES FOR PUBLIC READ ACCESS

-- Animes: Guests and users see published animes; staff see all
DROP POLICY IF EXISTS "animes read" ON public.animes;
CREATE POLICY "animes read" ON public.animes FOR SELECT TO anon, authenticated
  USING (is_published OR public.is_staff());

-- Banners: Guests and users see active banners within date bounds
DROP POLICY IF EXISTS "banners read" ON public.banners;
CREATE POLICY "banners read" ON public.banners FOR SELECT TO anon, authenticated
  USING (is_active AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at > now()));

-- Trailers: Guests and users see active trailers
DROP POLICY IF EXISTS "trailers read" ON public.trailers;
CREATE POLICY "trailers read" ON public.trailers FOR SELECT TO anon, authenticated
  USING (is_active);

-- Seasons: Viewable if parent anime is published
DROP POLICY IF EXISTS "seasons read" ON public.seasons;
CREATE POLICY "seasons read" ON public.seasons FOR SELECT TO anon, authenticated
  USING (public.is_staff() OR EXISTS (
    SELECT 1 FROM public.animes a WHERE a.id = seasons.anime_id AND a.is_published
  ));

-- Episodes: Viewable if published, parent anime is published, and VIP access is satisfied
DROP POLICY IF EXISTS "episodes read" ON public.episodes;
CREATE POLICY "episodes read" ON public.episodes FOR SELECT TO anon, authenticated
  USING (
    public.is_staff()
    OR (
      episodes.is_published
      AND EXISTS (
        SELECT 1 FROM public.animes a WHERE a.id = episodes.anime_id AND a.is_published
      )
      AND (
        -- Free content: accessible to guests and registered users
        (COALESCE(episodes.requires_vip, false) = false AND COALESCE(episodes.quality, '') <> '4K' AND NOT EXISTS (
          SELECT 1 FROM public.animes va WHERE va.id = episodes.anime_id AND COALESCE(va.is_vip_only, false) = true
        ))
        -- VIP content: strictly accessible only to active VIP subscribers or staff
        OR (
          auth.uid() IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.user_subscriptions s
            WHERE s.user_id = auth.uid()
              AND s.status = 'active'
              AND s.expires_at > now()
          )
        )
      )
    )
  );

-- Subtitles: Viewable if episode and anime are published
DROP POLICY IF EXISTS "subtitles read" ON public.episode_subtitles;
CREATE POLICY "subtitles read" ON public.episode_subtitles FOR SELECT TO anon, authenticated
  USING (public.is_staff() OR EXISTS (
    SELECT 1 FROM public.episodes e 
    JOIN public.animes a ON a.id = e.anime_id
    WHERE e.id = episode_subtitles.episode_id AND e.is_published AND a.is_published
  ));

-- Subscription Plans: Publicly visible to everyone
DROP POLICY IF EXISTS "Plans are viewable by everyone" ON public.subscription_plans;
CREATE POLICY "Plans are viewable by everyone" ON public.subscription_plans FOR SELECT TO anon, authenticated
  USING (is_active = true OR public.is_admin());

-- Site Settings: Publicly visible for dynamic white-label branding
DROP POLICY IF EXISTS "site settings read" ON public.site_settings;
CREATE POLICY "site settings read" ON public.site_settings FOR SELECT TO anon, authenticated
  USING (true);
