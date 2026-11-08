#!/usr/bin/env python3
"""Yozora migratsiyalarini STATIK tekshiradi (Postgres ishga tushirmaydi).

Tekshiradi:
  - $$ (dollar-quote) va qavslar balansi
  - create table/index/trigger/policy idempotentligi
  - ob'ektlar tartibi: jadval, funksiya, trigger, policy, grant o'zidan oldin yaratilganmi
  - ilova kodi ishlatadigan jadval va bucket'lar mavjudligi
Ishlatish:  python3 supabase/check_migrations.py
"""
import glob, os, re, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
FILES = sorted(glob.glob(os.path.join(ROOT, 'migrations', '*.sql')))
BUILTIN_TABLES = {'auth.users', 'storage.buckets', 'storage.objects'}
errors, warnings = [], []


def strip_comments(s):
    return re.sub(r'--[^\n]*', '', s)


def outside_dollar(s):
    parts = re.split(r'\$\$', s)
    return ''.join(parts[0::2])


defined_tables, defined_funcs, defined_triggers, defined_policies = set(), set(), set(), set()

for path in FILES:
    name = os.path.basename(path)
    raw = open(path, encoding='utf-8').read()
    s = strip_comments(raw)

    # 1) dollar-quote va qavs balansi
    if s.count('$$') % 2:
        errors.append(f'{name}: $$ juftligi buzilgan')
    code = re.sub(r"'[^']*'", "''", outside_dollar(s))
    if code.count('(') != code.count(')'):
        errors.append(f'{name}: qavslar balansi: ( {code.count("(")} ) {code.count(")")}')

    # 2) idempotentlik
    for m in re.finditer(r'create\s+table\s+(?!if\s+not\s+exists)(\S+)', s, re.I):
        warnings.append(f'{name}: create table {m.group(1)} qayta qo\'llash uchun idempotent emas')
    for m in re.finditer(r'create\s+(unique\s+)?index\s+(?!if\s+not\s+exists)(\S+)', s, re.I):
        errors.append(f'{name}: index {m.group(2)} "if not exists" yo\'q')
    for m in re.finditer(r'create\s+policy\s+"([^"]+)"\s+on\s+(\S+)', s, re.I):
        pat = re.compile(r'drop\s+policy\s+if\s+exists\s+"%s"\s+on\s+%s' % (re.escape(m.group(1)), re.escape(m.group(2))), re.I)
        if not pat.search(s):
            warnings.append(f'{name}: policy "{m.group(1)}" qayta qo\'llashdan oldin drop qilinmaydi')
    for m in re.finditer(r'create\s+trigger\s+(\S+)', s, re.I):
        if not re.search(r'drop\s+trigger\s+if\s+exists\s+%s' % re.escape(m.group(1)), s, re.I):
            errors.append(f'{name}: trigger {m.group(1)} uchun drop trigger if exists yo\'q')

    # 3) ob'ektlar tartibi (fayl ichida va fayllar bo'yicha ketma-ketlik)
    # Jadval yaratishlarni o'qish (self-reference ni hisobga olamiz)
    local_tables = {('public.' + t).lower() for t in re.findall(r'create\s+table\s+(?:if\s+not\s+exists\s+)?public\.(\w+)', s, re.I)}
    for m in re.finditer(r'references\s+(public\.\w+|auth\.\w+|storage\.\w+)', s, re.I):
        t = m.group(1).lower()
        if t in BUILTIN_TABLES or t in defined_tables or t in local_tables:
            continue
        # Jadval shu qatorda yaratilayotgan bo'lishi mumkin (self-reference)
        if re.search(r'create\s+table\s+(?:if\s+not\s+exists\s+)?' + re.escape(t) + r'\b', s, re.I):
            continue
        errors.append(f'{name}: {t} ga reference, lekin u oldin yaratilmagan')
    defined_tables |= local_tables

    # funksiyalar: create or replace function public.X(
    local_funcs = {f.lower() for f in re.findall(r'create\s+or\s+replace\s+function\s+public\.(\w+)', s, re.I)}

    # Ishlatilishi: policy, trigger, grant, revoke, alter table
    used_funcs = set()
    for block in re.findall(r'create\s+policy.*?;', s, re.I | re.S):
        used_funcs |= {f.lower() for f in re.findall(r'public\.(\w+)\s*\(', block)}
    for block in re.findall(r'create\s+trigger.*?;', s, re.I | re.S):
        used_funcs |= {f.lower() for f in re.findall(r'function\s+public\.(\w+)', block, re.I)}
    for block in re.findall(r'grant\s+execute\s+on\s+function.*?;', s, re.I | re.S):
        used_funcs |= {f.lower() for f in re.findall(r'public\.(\w+)\s*\(', block)}
    for f in sorted(used_funcs):
        if f not in defined_funcs and f not in local_funcs:
            errors.append(f'{name}: funksiya public.{f}() ishlatilgan, lekin oldin aniqlanmagan')
    defined_funcs |= local_funcs

    for m in re.finditer(r'alter\s+table\s+(?:only\s+)?(public\.\w+|auth\.\w+|storage\.\w+)', s, re.I):
        t = m.group(1).lower()
        if t not in defined_tables and t not in BUILTIN_TABLES:
            errors.append(f'{name}: alter table {t} — jadval oldin yaratilmagan')

    for m in re.finditer(r'(?:grant|revoke)\s+[^;]*?\bon\s+(public\.\w+)', s, re.I):
        t = m.group(1).lower()
        if t not in defined_tables:
            errors.append(f'{name}: grant/revoke on {t} — jadval oldin yaratilmagan')

    for m in re.finditer(r'create\s+policy\s+"[^"]+"\s+on\s+(\S+)', s, re.I):
        t = m.group(1).lower()
        if t not in defined_tables and t not in BUILTIN_TABLES:
            errors.append(f'{name}: policy {t} da — jadval oldin yaratilmagan')

# 4) Ilova kodi ishlatadigan jadval va bucket'lar
app_tables = set()
for root in ('app', 'components', 'lib'):
    for p in glob.glob(os.path.join(ROOT, '..', root, '**', '*.js'), recursive=True):
        for t in re.findall(r"from\('(\w+)'\)", open(p, encoding='utf-8').read()):
            app_tables.add(t)
app_tables -= {'posters'}  # bu storage.from('posters') dan keladi, jadval emas
for t in sorted(app_tables):
    if ('public.' + t) not in defined_tables:
        errors.append(f'ilova jadvali public.{t} migratsiyalarda yo\'q')

all_sql = '\n'.join(strip_comments(open(p, encoding='utf-8').read()) for p in FILES)
for bucket in ('posters',):
    if f"'{bucket}'" not in all_sql:
        errors.append(f'ilova bucket {bucket} migratsiyalarda yo\'q')


# ---------- 5) XAVFSIZLIK QOIDALARI ----------
ALL = '\n'.join(strip_comments(open(p, encoding='utf-8').read()) for p in FILES)
ALL_L = ALL.lower()

# 5a) SECURITY DEFINER funksiyalarda search_path qat'iy bo'lishi shart
for m in re.finditer(r'create\s+or\s+replace\s+function\s+public\.(\w+)\s*\((.*?)\)\s*returns\s+\w+\s*(.*?)\s+as\s+\$\$', ALL, re.I | re.S):
    fname, header = m.group(1), m.group(3)
    if 'security definer' in header.lower() and 'search_path' not in header.lower():
        errors.append(f'SECURITY DEFINER {fname}: set search_path yo\'q')

# 5b) Ruxsat ro'yxati: anon/public/service_role hech qanday public funksiya EXECUTE ololmaydi;
#     authenticated faqat ruxsat etilgan ro'yxatni oladi.
AUTH_ALLOWED = {
    'is_staff', 'is_admin', 'is_owner', 'is_active_user', 'set_user_role', 'set_user_suspended',
    'admin_list_users', 'admin_create_anime_with_episodes', 'admin_replace_anime_episodes',
    'admin_grant_user_subscription', 'admin_extend_user_subscription', 'admin_revoke_user_subscription',
    'admin_toggle_user_vip', 'admin_update_anime_and_episodes', 'assistant_has_permission',
    'assistant_can_manage_content', 'main_admin_search_assistant_candidates',
    'main_admin_list_assistant_admins', 'main_admin_appoint_assistant',
    'main_admin_set_assistant_permissions', 'main_admin_remove_assistant',
    'main_admin_revoke_all_assistant_permissions', 'assistant_create_anime_with_episodes',
    'assistant_update_anime_and_episodes', 'assistant_update_anime_and_episodes_authorized',
    'assistant_log_content_failure',
}
for m in re.finditer(r'grant\s+execute\s+on\s+function\s+public\.(\w+)\s*\([^)]*\)\s+to\s+([\w,\s]+);', ALL, re.I):
    fname, roles = m.group(1).lower(), [r.strip().lower() for r in m.group(2).split(',')]
    SERVICE_ROLE_ALLOWED = {'check_rate_limit'}
    for r in roles:
        if r in ('anon', 'public'):
            errors.append(f'{fname} EXECUTE {r} ga berilgan — taqiqlangan')
        elif r == 'service_role' and fname not in SERVICE_ROLE_ALLOWED:
            errors.append(f'{fname} EXECUTE {r} ga berilgan — taqiqlangan')
        if r == 'authenticated' and fname not in AUTH_ALLOWED:
            errors.append(f'{fname} EXECUTE authenticated ga berilgan — ruxsat ro\'yxatida emas')

# 5c) 004 da hamma funksiyalardan EXECUTE olib tashlanishi kerak
if not re.search(r'revoke\s+execute\s+on\s+all\s+functions\s+in\s+schema\s+public\s+from\s+[^;]*\bservice_role', ALL_L):
    errors.append('004: "revoke execute on all functions ... from ... service_role" yo\'q')

# 5d) bootstrap_owner va trigger-funksiyalar hech kimga berilmasligi kerak
for f in ('bootstrap_owner', 'handle_new_user', 'profiles_guard', 'recalc_anime_rating', 'audit_row_change', 'set_updated_at'):
    if re.search(r'grant\s+execute\s+on\s+function\s+public\.%s\b' % f, ALL, re.I):
        errors.append(f'{f} ga EXECUTE berilgan — bu funksiya API dan chaqirilmasligi kerak')
if not re.search(r'revoke\s+execute\s+on\s+function\s+public\.bootstrap_owner', ALL, re.I):
    errors.append('bootstrap_owner uchun aniq REVOKE yo\'q')

# 5e) Moderator/foydalanuvchi audit yozuvi yarata olmasligi: admin_logs ga yozish huquqi yo'q
if re.search(r'grant\s+(insert|update|delete|all)[^;]*on\s+public\.admin_logs\s+to\s+[^;]*authenticated', ALL, re.I):
    errors.append('admin_logs ga authenticated uchun yozish huquqi berilgan')
if re.search(r'create\s+(or\s+replace\s+)?function\s+public\.log_admin_action', ALL, re.I):
    errors.append('log_admin_action funksiyasi hali mavjud — olib tashlanishi kerak')
if re.search(r'create\s+policy[^;]*on\s+public\.admin_logs[^;]*for\s+(insert|update|delete|all)', ALL, re.I):
    errors.append('admin_logs da yozish policy si bor')

# 5f) Audit triggerlar: ma'lumot jadvallarida bo'lishi shart
for t in ('animes', 'episodes', 'seasons', 'episode_subtitles', 'banners', 'announcements', 'site_settings', 'comments', 'reports'):
    if not re.search(r'create\s+trigger\s+%s_audit_trg\s+after\s+insert\s+or\s+update\s+or\s+delete\s+on\s+public\.%s\s+for\s+each\s+row\s+execute\s+function\s+public\.audit_row_change' % (t, t), ALL, re.I):
        errors.append(f'{t}: audit trigger yo\'q')

# 5g) Har bir jadvalda RLS yoqilgan
for t in re.findall(r'create\s+table\s+(?:if\s+not\s+exists\s+)?public\.(\w+)', ALL, re.I):
    if not re.search(r'alter\s+table\s+public\.%s\s+enable\s+row\s+level\s+security' % t, ALL, re.I):
        errors.append(f'{t}: RLS yoqilmagan')

# 5h) Foydalanuvchi role va suspended_at ni yangilay olmasin (ustun ruxsati)
grants_profiles = list(re.finditer(r'grant\s+update\s*\(([^)]*)\)\s+on\s+public\.profiles', ALL, re.I))
if not grants_profiles:
    errors.append('profiles: ustun darajasidagi UPDATE grant yo\'q')
for gm in grants_profiles:
    cols = [c.strip().lower() for c in gm.group(1).split(',')]
    for bad in ('role', 'suspended_at', 'id'):
        if bad in cols:
            errors.append(f'profiles: foydalanuvchi {bad} ni yangilay oladi — TAQIQLANGAN')
# Umumiy (ustunsiz) UPDATE grant ham taqiqlangan
if re.search(r'grant\s+(update|all)\s+on\s+(all\s+tables\s+in\s+schema\s+public|public\.profiles)\s+to\s+[^;]*authenticated', ALL, re.I):
    errors.append('profiles yoki barcha jadvallarga authenticated UPDATE/ALL grant — profiles da keyin revoke bo\'lishi shart')
if not re.search(r'revoke\s+insert,\s*update,\s*delete\s+on\s+public\.profiles\s+from\s+authenticated', ALL, re.I):
    errors.append('profiles: insert/update/delete revoke yo\'q')
if not re.search(r'create\s+trigger\s+profiles_guard_trg\s+before\s+update\s+on\s+public\.profiles', ALL, re.I):
    errors.append('profiles_guard_trg (before update) yo\'q')

# 5i) Ro'yxatdan o'tish: rol metadata'dan olinmasin, profil har doim 'user' bilan yaratilsin
hnu = re.search(r'create\s+or\s+replace\s+function\s+public\.handle_new_user.*?\$\$(.*?)\$\$', ALL, re.I | re.S)
if not hnu:
    errors.append('handle_new_user topilmadi')
else:
    body = hnu.group(1).lower()
    if 'raw_user_meta_data' in body and "'role'" in body:
        errors.append('handle_new_user rolni metadata dan oladi — TAQIQLANGAN')
    if "values (new.id, v_username, 'user')" not in body:
        errors.append("handle_new_user profilni 'user' roli bilan yaratmaydi")
if not re.search(r'create\s+trigger\s+on_auth_user_created\s+after\s+insert\s+on\s+auth\.users', ALL, re.I):
    errors.append('on_auth_user_created trigger (auth.users) yo\'q')

# 5j) Ilova murojaat qiladigan jadvallar va bucketlar (qo'lda ro'yxat + kod)
for bucket in ('posters',):
    if f"'{bucket}'" not in ALL:
        errors.append(f'ilova bucket {bucket} migratsiyalarda yo\'q')

print(f'Tekshirilgan fayllar: {len(FILES)}')
print(f'Jadvallar: {len(defined_tables)}, funksiyalar: {len(defined_funcs)}')
for w in warnings:
    print('OGOHLANTIRISH:', w)
if errors:
    print(f'\n{len(errors)} ta xato:')
    for e in errors:
        print('  XATO:', e)
    sys.exit(1)
print('\nXATO YO\'Q (statik tekshiruv). Bu Postgres ishga tushirish emas.')
