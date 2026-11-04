import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('011b bridge migration defines admin_create_anime_with_episodes and admin_replace_anime_episodes', async () => {
  const sql = await read('../supabase/migrations/011b_admin_anime_rpcs.sql');

  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.admin_create_anime_with_episodes\s*\(\s*p_anime jsonb,\s*p_episodes jsonb/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.admin_replace_anime_episodes\s*\(\s*p_anime_id uuid,\s*p_episodes jsonb/);
  assert.match(sql, /SET search_path = pg_catalog, public, pg_temp/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.admin_create_anime_with_episodes\(jsonb, jsonb\) FROM PUBLIC, anon/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.admin_create_anime_with_episodes\(jsonb, jsonb\) TO authenticated/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.admin_replace_anime_episodes\(uuid, jsonb\) FROM PUBLIC, anon/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.admin_replace_anime_episodes\(uuid, jsonb\) TO authenticated/);
});

test('admin_create_anime_with_episodes validates administrator authorization and schema limits', async () => {
  const sql = await read('../supabase/migrations/011b_admin_anime_rpcs.sql');
  const createFunc = sql.slice(
    sql.indexOf('FUNCTION public.admin_create_anime_with_episodes'),
    sql.indexOf('FUNCTION public.admin_replace_anime_episodes')
  );

  assert.match(createFunc, /IF NOT public\.is_admin\(\) THEN/);
  assert.match(createFunc, /p_anime IS NULL OR jsonb_typeof\(p_anime\) <> 'object'/);
  assert.match(createFunc, /p_episodes IS NULL OR jsonb_typeof\(p_episodes\) <> 'array'/);
  assert.match(createFunc, /jsonb_array_length\(p_episodes\) > 500/);
  assert.match(createFunc, /e\.season_number IS NULL OR e\.season_number < 1/);
  assert.match(createFunc, /e\.number IS NULL OR e\.number < 1/);
  assert.ok(createFunc.includes("video_url !~* '^https?://'"));
  assert.match(createFunc, /duplicate episode season_number and number in payload/);
  assert.match(createFunc, /RETURN jsonb_build_object\('id', v_anime\.id, 'title', v_anime\.title, 'poster_url', v_anime\.poster_url\)/);
});

test('012 migration contains both functions, ensuring forward-compatibility with 015', async () => {
  const sql = await read('../supabase/migrations/012_admin_pagination_atomic_updates.sql');

  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.admin_create_anime_with_episodes/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.admin_replace_anime_episodes/);
  assert.match(sql, /admin_update_anime_and_episodes\(p_anime_id, '{}'::jsonb, p_episodes\)/);
});

test('015 search_path hardening targets match 011b and 012 signatures exactly', async () => {
  const sql015 = await read('../supabase/migrations/015_assistant_security_audit_fixes.sql');

  assert.match(sql015, /ALTER FUNCTION public\.admin_create_anime_with_episodes\(jsonb, jsonb\) SET search_path = pg_catalog, public, pg_temp;/);
  assert.match(sql015, /ALTER FUNCTION public\.admin_replace_anime_episodes\(uuid, jsonb\) SET search_path = pg_catalog, public, pg_temp;/);
});
