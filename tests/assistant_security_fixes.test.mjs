import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('assistant content read grants preserve view/edit/delete and require paired create permissions', async () => {
  const sql = await read('../supabase/migrations/015_assistant_security_audit_fixes.sql');
  const helper = sql.slice(sql.indexOf('FUNCTION public.assistant_can_manage_content'), sql.indexOf('DROP POLICY IF EXISTS "assistant anime read"'));
  const canRead = (p) => Boolean(p.anime_view || p.anime_edit || p.anime_delete || p.episode_edit || p.episode_delete || (p.episode_create && p.video_upload));
  assert.equal(canRead({ episode_create: true }), false);
  assert.equal(canRead({ video_upload: true }), false);
  assert.equal(canRead({ episode_create: true, video_upload: true }), true);
  for (const permission of ['anime_view', 'anime_edit', 'anime_delete', 'episode_edit', 'episode_delete']) {
    assert.equal(canRead({ [permission]: true }), true);
  }
  assert.match(helper, /'episode_create' AND public\.assistant_has_permission\('video_upload'\)/);
});

test('permission payload fails closed and unavailable permissions cannot be granted', async () => {
  const sql = await read('../supabase/migrations/015_assistant_security_audit_fixes.sql');
  const body = sql.slice(sql.indexOf('FUNCTION public.main_admin_set_assistant_permissions'), sql.indexOf('-- Replacement is one transaction'));
  assert.match(body, /p_permissions IS NULL/);
  assert.match(body, /jsonb_typeof\(p_permissions\) IS DISTINCT FROM 'object'/);
  assert.match(body, /jsonb_typeof\(e\.value\) IS DISTINCT FROM 'boolean'/);
  assert.match(body, /video_review','comment_moderate','report_view'.*e\.value = 'true'::jsonb/s);
  assert.match(body, /role = 'owner' AND suspended_at IS NULL/);
});

test('episode replacement uses the season-qualified key and preserves published identity', async () => {
  const sql = await read('../supabase/migrations/016_episode_replacement_identity.sql');
  const body = sql.slice(sql.indexOf('FUNCTION public.assistant_update_anime_and_episodes('), sql.indexOf('-- Preserve the permission boundary'));
  assert.match(body, /FROM public\.animes WHERE id = p_anime_id FOR UPDATE/);
  assert.match(body, /old\.is_published[\s\S]*NOT EXISTS[\s\S]*e\.number = old\.number/);
  assert.match(body, /coalesce\(e\.is_published, false\)/);
  assert.match(body, /is_published, quality\)[\s\S]*false, coalesce/);
  assert.match(body, /episode_edit'[\s\S]*episode_create'[\s\S]*episode_delete'[\s\S]*video_upload'/);
  assert.match(body, /season_number = e\.season_number/);
  assert.match(sql, /migration 008 allows the same[\s\S]*\(anime_id, season_number, number\)/);
});

test('assistant content audit records CRUD and URL changes without storing the URL', async () => {
  const sql = await read('../supabase/migrations/015_assistant_security_audit_fixes.sql');
  const body = sql.slice(sql.indexOf('FUNCTION public.audit_assistant_content_change'), sql.indexOf('DROP TRIGGER IF EXISTS assistant_anime_audit'));
  assert.match(body, /auth\.uid\(\)/);
  for (const action of ['anime_created', 'anime_updated', 'anime_deleted', 'episode_created', 'episode_updated', 'episode_deleted', 'episode_video_source_changed']) {
    assert.ok(body.includes(action), `missing audit action ${action}`);
  }
  assert.match(body, /'result','success'/);
  assert.match(body, /video_url_changed/);
  assert.doesNotMatch(body, /'video_url'\s*,/);
  assert.match(sql, /CREATE TRIGGER assistant_anime_audit AFTER INSERT OR UPDATE OR DELETE/);
  assert.match(sql, /CREATE TRIGGER assistant_episode_audit AFTER INSERT OR UPDATE OR DELETE/);
});

test('migration hardens all SECURITY DEFINER signatures from 011-013 and preserves scoped RPC grants', async () => {
  const sql = await read('../supabase/migrations/015_assistant_security_audit_fixes.sql');
  const files = [
    '../supabase/migrations/011_schema_security_repairs.sql',
    '../supabase/migrations/012_admin_pagination_atomic_updates.sql',
    '../supabase/migrations/013_profiles_assistant_admins.sql',
  ];
  for (const path of files) {
    const source = await read(path);
    const names = [...source.matchAll(/CREATE OR REPLACE FUNCTION public\.([a-z0-9_]+)\s*\(([\s\S]*?)\)[\s\S]*?SECURITY DEFINER/gi)].map((m) => m[1]);
    for (const name of new Set(names)) assert.ok(sql.includes(`ALTER FUNCTION public.${name}(`), `missing search_path hardening for ${name}`);
  }
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.assistant_can_manage_content\(\) FROM PUBLIC, anon, authenticated, service_role/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.assistant_can_manage_content\(\) TO authenticated/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.assistant_update_anime_and_episodes_authorized\(uuid, jsonb, jsonb\) TO authenticated/);
});

test('default npm test remains local and does not invoke live tests', async () => {
  const pkg = JSON.parse(await read('../package.json'));
  assert.doesNotMatch(pkg.scripts.test, /admin_live_e2e|comprehensive_qa|prod_live_verify/i);
  assert.match(pkg.scripts.test, /assistant_security_fixes\.test\.mjs/);
});
