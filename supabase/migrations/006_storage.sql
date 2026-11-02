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
