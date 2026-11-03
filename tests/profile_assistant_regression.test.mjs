import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { validateProfileImage, getOwnedAvatarPath } from '../lib/profile-image.js';
import { authorizeAdminOperation, requireMainAdmin } from '../lib/admin-access.js';
import { canManageAssistantAdmins } from '../lib/permission-policy.js';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

function mockSupabase(role, permissionState = {}) {
  let permissionCalls = 0;
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: { role, suspended_at: null }, error: null }),
        }),
      }),
    }),
    rpc: async (_name, { p_permission }) => {
      permissionCalls += 1;
      return { data: Boolean(permissionState[p_permission]), error: null };
    },
    get permissionCalls() { return permissionCalls; },
  };
  return client;
}

test('authenticated profile action writes only the current user display name and avatar', async () => {
  const source = await read('../app/actions/profile.js');
  assert.match(source, /supabase\.auth\.getUser\(\)/);
  assert.match(source, /\.update\(\{\s*display_name:\s*displayName,\s*avatar_url:\s*nextAvatarUrl,?\s*\}\)\.eq\('id', user\.id\)/s);
  for (const protectedField of ['role', 'subscription', 'suspended_at', 'permissions', 'is_vip']) {
    assert.doesNotMatch(source, new RegExp(`\\b${protectedField}\\s*:`));
  }
});

test('server image validation rejects invalid type and oversized images', async () => {
  const invalidType = await validateProfileImage({ type: 'image/svg+xml', size: 5, arrayBuffer: async () => new ArrayBuffer(5) });
  assert.match(invalidType.error, /JPEG, PNG yoki WebP/);
  const tooLarge = await validateProfileImage({ type: 'image/png', size: 2 * 1024 * 1024 + 1, arrayBuffer: async () => { throw new Error('must not read'); } });
  assert.match(tooLarge.error, /2 MB/);
});

test('avatar cleanup path is limited to the authenticated user folder', () => {
  const own = 'https://example.test/storage/v1/object/public/profile-avatars/user-1/avatar.webp';
  const other = 'https://example.test/storage/v1/object/public/profile-avatars/user-2/avatar.webp';
  assert.equal(getOwnedAvatarPath(own, 'user-1'), 'user-1/avatar.webp');
  assert.equal(getOwnedAvatarPath(other, 'user-1'), null);
  assert.equal(getOwnedAvatarPath('https://example.test/profile-avatars/user-1/a/b.png', 'user-1'), null);
});

test('assistant create and edit require their own current permission on every request', async () => {
  const allowed = mockSupabase('assistant_admin', { anime_create: true, anime_edit: true });
  assert.equal((await authorizeAdminOperation(allowed, 'anime_create')).error, null);
  assert.equal((await authorizeAdminOperation(allowed, 'anime_edit')).error, null);

  const denied = mockSupabase('assistant_admin', { anime_create: false, anime_edit: false, anime_delete: false });
  assert.ok((await authorizeAdminOperation(denied, 'anime_create')).error);
  assert.ok((await authorizeAdminOperation(denied, 'anime_edit')).error);
  assert.ok((await authorizeAdminOperation(denied, 'anime_delete')).error);
});

test('owner retains permissions; assistants cannot manage permission grants', async () => {
  const owner = mockSupabase('owner');
  for (const permission of [
    'anime_view', 'anime_create', 'anime_edit', 'anime_delete', 'video_upload',
    'episode_create', 'episode_edit', 'episode_delete', 'video_analyze', 'video_review',
    'comment_moderate', 'report_view',
  ]) assert.equal((await authorizeAdminOperation(owner, permission)).error, null);
  assert.equal(canManageAssistantAdmins('owner'), true);
  assert.equal(canManageAssistantAdmins('admin'), false);
  assert.equal(canManageAssistantAdmins('assistant_admin'), false);

  const assistant = mockSupabase('assistant_admin');
  assert.ok((await requireMainAdmin(assistant)).error);
  const managementActions = await read('../app/actions/assistant-admin.js');
  assert.match(managementActions, /requireMainAdmin/);
  assert.match(managementActions, /export async function appointAssistant[\s\S]*?requireMainAdmin/);
  const migration = await read('../supabase/migrations/013_profiles_assistant_admins.sql');
  const appointRpc = migration.slice(migration.indexOf('FUNCTION public.main_admin_appoint_assistant'), migration.indexOf('FUNCTION public.main_admin_set_assistant_permissions'));
  assert.match(appointRpc, /role = 'owner'/);
});

test('permission revocation is observed by the next server authorization check', async () => {
  const state = { anime_create: true };
  const client = mockSupabase('assistant_admin', state);
  assert.equal((await authorizeAdminOperation(client, 'anime_create')).error, null);
  state.anime_create = false;
  assert.ok((await authorizeAdminOperation(client, 'anime_create')).error);
  assert.equal(client.permissionCalls, 2);
});

test('public anime reads stay public and mutations use permission guards', async () => {
  const listApi = await read('../app/api/animes/route.js');
  const detailApi = await read('../app/api/animes/[id]/route.js');
  const adminActions = await read('../app/actions/admin.js');
  assert.match(listApi, /export async function GET[\s\S]*?getPublicContext\(\)/);
  assert.match(detailApi, /export async function GET[\s\S]*?getPublicContext\(\)/);
  assert.match(listApi, /requireAdminPermission\('anime_create'\)/);
  assert.match(listApi, /\['episode_create', 'video_upload'\]/);
  assert.match(detailApi, /requireAdminPermission\('anime_delete'\)/);
  assert.match(detailApi, /'episode_edit', 'episode_create', 'episode_delete', 'video_upload'/);
  assert.match(adminActions, /createAnime[\s\S]*?assertAdmin\(supabase, 'anime_create'\)/);
  assert.match(adminActions, /updateAnime[\s\S]*?assertAdmin\(supabase, 'anime_edit'\)/);
  assert.match(adminActions, /deleteAnime[\s\S]*?assertAdmin\(supabase, 'anime_delete'\)/);
  assert.match(adminActions, /createEpisode[\s\S]*?assertAdmin\(supabase, 'episode_create'\)/);
  assert.match(adminActions, /updateEpisode[\s\S]*?assertAdmin\(supabase, 'episode_edit'\)/);
  assert.match(adminActions, /deleteEpisode[\s\S]*?assertAdmin\(supabase, 'episode_delete'\)/);
});

test('assistant role cannot enter owner dashboard or permission management', async () => {
  const adminPage = await read('../app/admin/page.js');
  const migration = await read('../supabase/migrations/013_profiles_assistant_admins.sql');
  const forwardMigration = await read('../supabase/migrations/014_assistant_permission_boundaries.sql');
  assert.match(adminPage, /if \(!isAdminRole\(profile\?\.role\)\) redirect\('\/'\)/);
  assert.match(adminPage, /profile\?\.role === 'owner'.*tab === 'assistants'/s);
  assert.match(migration, /role = 'owner'/);
  assert.match(forwardMigration, /assistant_update_anime_and_episodes_authorized/);
  assert.match(forwardMigration, /episode_create'[\s\S]*episode_delete'[\s\S]*video_upload'/);
  const contentReadHelper = forwardMigration.slice(forwardMigration.indexOf('FUNCTION public.assistant_can_manage_content'), forwardMigration.indexOf('CREATE OR REPLACE FUNCTION public.assistant_update'));
  assert.match(contentReadHelper, /p\.id = auth\.uid\(\)/);
  assert.doesNotMatch(contentReadHelper, /'anime_create'/);
  assert.match(migration, /enabled boolean NOT NULL DEFAULT false/);
  assert.match(migration, /REVOKE ALL ON public\.assistant_admins, public\.assistant_admin_permissions/);
  const assistantPage = await read('../app/assistant-admin/page.js');
  assert.match(assistantPage, /profile\?\.role !== 'assistant_admin'/);
  assert.match(assistantPage, /supabase\.rpc\('assistant_has_permission'/);
});
