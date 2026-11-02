-- =====================================================================
-- VERIFY — faqat o'qish. Hech narsani o'zgartirmaydi.
-- Har bir so'rov yonida KUTILGAN natija yozilgan.
-- Ishga tushirish: har bir blokni alohida nusxalab SQL Editor da Run qiling.
-- =====================================================================

-- 1) Jadvallar: 16 ta
select count(*) as public_tables from information_schema.tables
where table_schema = 'public' and table_type = 'BASE TABLE';

-- 2) RLS: hammasi TRUE
select tablename, rowsecurity from pg_tables
where schemaname = 'public' order by tablename;

-- 3) Funksiyalar: 12 ta, log_admin_action YO'Q
select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' order by p.proname;

-- 4) Triggerlar (public va auth.users): 19 ta
select tgname, tgrelid::regclass as on_table from pg_trigger
where not tgisinternal order by tgname;

-- 5) Storage bucketlar: 5 ta (posters, anime-banners, episode-thumbnails, profile-avatars, site-assets)
select id, public, file_size_limit from storage.buckets order by id;

-- 6) anon: hech qanday jadvalga ruxsat YO'Q (bo'sh natija)
select table_name, privilege_type from information_schema.role_table_grants
where grantee = 'anon' and table_schema = 'public';

-- 7) authenticated EXECUTE ruxsati: AYNAN 6 ta funksiya
--    is_active_user, is_admin, is_owner, is_staff, set_user_role, set_user_suspended
select routine_name from information_schema.routine_privileges
where routine_schema = 'public' and grantee = 'authenticated' order by routine_name;

-- 8) bootstrap_owner: hech kimga EXECUTE YO'Q (natija faqat postgres/owner roli bo'lishi kerak)
select grantee, privilege_type from information_schema.routine_privileges
where routine_schema = 'public' and routine_name = 'bootstrap_owner';

-- 9) admin_logs: authenticated faqat SELECT oladi (INSERT/UPDATE/DELETE YO'Q)
select privilege_type from information_schema.role_table_grants
where grantee = 'authenticated' and table_schema = 'public' and table_name = 'admin_logs';

-- 10) profiles: authenticated faqat username, display_name, avatar_url, bio ni yangilaydi
select column_name from information_schema.column_privileges
where grantee = 'authenticated' and table_schema = 'public' and table_name = 'profiles'
  and privilege_type = 'UPDATE' order by column_name;

-- 11) Rol cheklovi
select pg_get_constraintdef(c.oid) as role_check from pg_constraint c
where c.conname = 'profiles_role_check';

-- 12) Ro'yxatdan o'tish triggeri (auth.users) mavjud
select tgname from pg_trigger where tgrelid = 'auth.users'::regclass and not tgisinternal;

-- 13) Profillar: rollar va suspenziya holati
select username, role, suspended_at, created_at from public.profiles order by created_at;
