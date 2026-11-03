import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getCurrentSubscription, getSubscriptionSummary } from '../lib/subscriptions.js';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const expectMatch = (source, pattern, label) => {
  if (!pattern.test(source)) throw new Error(label);
};
const expectNotMatch = (source, pattern, label) => {
  if (pattern.test(source)) throw new Error(label);
};
const migration = await read('../supabase/migrations/011_schema_security_repairs.sql');
const forwardMigration = await read('../supabase/migrations/012_admin_pagination_atomic_updates.sql');
const packageJson = JSON.parse(await read('../package.json'));
assert.equal((migration.match(/\$\$/g) || []).length % 2, 0, 'Migration function dollar quotes must be balanced');

const now = new Date('2026-01-01T00:00:00.000Z');
const subscriptions = [
  { status: 'active', starts_at: '2025-12-01T00:00:00.000Z', expires_at: '2026-01-03T00:00:00.000Z', plan_name: 'VIP' },
  { status: 'cancelled', starts_at: '2025-12-01T00:00:00.000Z', expires_at: '2027-01-03T00:00:00.000Z', plan_name: 'Cancelled' },
  { status: 'active', starts_at: '2025-11-01T00:00:00.000Z', expires_at: '2025-12-31T00:00:00.000Z', plan_name: 'Expired' },
  { status: 'active', starts_at: '2026-02-01T00:00:00.000Z', expires_at: '2026-03-01T00:00:00.000Z', plan_name: 'Future' },
];
assert.equal(getCurrentSubscription(subscriptions, now).plan_name, 'VIP');
assert.equal(getSubscriptionSummary(subscriptions, now).isVip, true);
assert.equal(getSubscriptionSummary(subscriptions, new Date('2026-01-04T00:00:00Z')).isVip, false);
assert.equal(getSubscriptionSummary(subscriptions, now).expiresAt, '2026-01-03T00:00:00.000Z');

expectMatch(migration, /ADD COLUMN IF NOT EXISTS release_day/, 'Release day schema migration is missing');
expectMatch(migration, /ADD COLUMN IF NOT EXISTS fandub_team/, 'Fandub schema migration is missing');
expectMatch(migration, /ADD COLUMN IF NOT EXISTS quality/, 'Episode quality schema migration is missing');
expectMatch(migration, /CREATE POLICY "profiles read own or admin"/, 'Restricted profile policy is missing');
expectMatch(migration, /\(SELECT auth\.uid\(\)\) = id OR public\.is_admin\(\)/, 'Profile SELECT policy is not owner/admin scoped');
expectMatch(migration, /IF NOT public\.is_admin\(\) THEN/, 'Admin RPC authorization guard is missing');
expectMatch(migration, /admin_create_anime_with_episodes/, 'Atomic anime RPC is missing');
expectMatch(migration, /admin_replace_anime_episodes/, 'Atomic episode replacement RPC is missing');
expectMatch(migration, /admin_grant_user_subscription/, 'Subscription grant RPC is missing');
expectMatch(migration, /admin_extend_user_subscription/, 'Subscription extension RPC is missing');
expectMatch(migration, /admin_revoke_user_subscription/, 'Subscription revoke RPC is missing');

expectMatch(packageJson.scripts.test, /security_regression.test.mjs/, 'Safe default test script is missing regression checks');
expectNotMatch(packageJson.scripts.test, /tests\/(?:admin_live_e2e|comprehensive_qa_audit|live_audit|prod_live_verify)/i, 'Default test script must not invoke remote checks');
assert.equal(packageJson.scripts['test:e2e:live'], 'node tests/admin_live_e2e.test.mjs');

const adminActions = await read('../app/actions/admin.js');
const animeApi = await read('../app/api/animes/route.js');
const animeDetailApi = await read('../app/api/animes/[id]/route.js');
expectMatch(adminActions, /rpc\(rpcName/ , 'Anime creation must call the selected atomic RPC');
expectMatch(adminActions, /'admin_create_anime_with_episodes'/, 'Main-admin anime creation RPC must remain available');
expectMatch(adminActions, /'assistant_create_anime_with_episodes'/, 'Assistant anime creation must use its protected RPC');
expectMatch(adminActions, /rpc\('admin_grant_user_subscription'/, 'Admin subscription grant must use the RPC');
expectMatch(adminActions, /rpc\('admin_extend_user_subscription'/, 'Admin subscription extension must use the RPC');
expectMatch(adminActions, /rpc\('admin_revoke_user_subscription'/, 'Admin subscription revocation must use the RPC');
expectNotMatch(adminActions, /subscription_plan:\s*['"]vip['"]/, 'App must not mirror subscription state into profiles');
expectMatch(animeApi, /requireAdminPermission\('anime_create'\)/, 'Anime API creation must check anime_create permission');
expectMatch(animeApi, /assistant_create_anime_with_episodes/, 'Assistant anime creation must use its protected RPC');
expectMatch(animeDetailApi, /requireAdminPermission\('anime_delete'\)/, 'Anime deletion must check anime_delete permission');
expectMatch(animeDetailApi, /assistant_update_anime_and_episodes_authorized/, 'Assistant PATCH must use the guarded atomic RPC');
expectMatch(animeDetailApi, /getPublicContext\(\)/, 'Anime detail GET must remain public');
expectMatch(forwardMigration, /pg_advisory_xact_lock\(hashtextextended\(p_user_id::text, 0\)\)/, 'Subscription grants must serialize per user');
expectMatch(forwardMigration, /status = 'active' AND expires_at > now\(\)/, 'Grant scheduling must include future active subscriptions');
expectMatch(forwardMigration, /LIMIT p_page_size OFFSET \(v_page - 1\) \* p_page_size/, 'Admin users RPC must apply validated server pagination');
expectMatch(forwardMigration, /total_count bigint/, 'Admin users RPC must return the filtered result count');
expectMatch(forwardMigration, /admin_update_anime_and_episodes/, 'Atomic anime PATCH RPC must exist');
expectMatch(forwardMigration, /REVOKE ALL ON FUNCTION public\.admin_update_anime_and_episodes\(uuid, jsonb, jsonb\) FROM PUBLIC, anon/, 'Atomic PATCH RPC must revoke public execution');
expectNotMatch(await read('./comprehensive_qa_audit.mjs'), /profiles[^\n]*subscription_plan|select\([^\n]*subscription_plan/, 'Live QA must not query removed profile subscription columns');

for (const path of [
  './admin_live_e2e.test.mjs',
  './comprehensive_qa_audit.mjs',
  './live_audit.mjs',
  './prod_live_verify.mjs',
]) {
  const source = await read(path);
  expectNotMatch(source, /readFileSync\(['"]\.env\.local/, 'Live scripts must not read .env.local');
  expectNotMatch(source, /QA_USER_PASSWORD|TEST_USER_PASSWORD/, 'Live scripts must not use old credential variable names');
  expectNotMatch(source, /sapayev\d+/i, 'Live scripts must not contain account fallbacks');
  expectMatch(source, /requireLiveTestConfig/, 'Live script safety gate is missing');
}

const liveSafety = await read('./live-safety.mjs');
expectMatch(liveSafety, /ANICITY_ENABLE_LIVE_TESTS/, 'Live test opt-in gate is missing');
expectMatch(liveSafety, /ANICITY_LIVE_TEST_ALLOWED_HOSTS/, 'Live test host allowlist is missing');
expectMatch(liveSafety, /ANICITY_TEST_ENVIRONMENT/, 'Live test environment classification is missing');
expectMatch(liveSafety, /TEST_SUPABASE_URL/, 'Dedicated test URL requirement is missing');
expectMatch(liveSafety, /DEDICATED_TEST_PROJECT/, 'Dedicated project confirmation is missing');
expectMatch(liveSafety, /DEDICATED_TEST_ACCOUNT/, 'Dedicated account confirmation is missing');
expectMatch(liveSafety, /tokenClaims.ref !== refMatch\[1\]/, 'Credential/project matching is missing');
expectMatch(liveSafety, /anicity-app.vercel.app/, 'Primary production web host denylist is missing');
expectMatch(liveSafety, /yozora-app.vercel.app/, 'Known production alias denylist is missing');
expectMatch(liveSafety, /vercel\.app/, 'Shared Vercel production hosts must be rejected');

console.log('Security and schema regression checks passed.');
