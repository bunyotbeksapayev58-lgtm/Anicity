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
