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
