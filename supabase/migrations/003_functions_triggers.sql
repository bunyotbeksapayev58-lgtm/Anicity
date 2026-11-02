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

