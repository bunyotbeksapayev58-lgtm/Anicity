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
