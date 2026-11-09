import assert from 'node:assert/strict';
import { requireLiveTestConfig } from './live-safety.mjs';

const projectRef = 'abcdefghijklmnopqrst';
const fakeAnonKey = `header.${Buffer.from(JSON.stringify({ ref: projectRef })).toString('base64url')}.signature`;
const base = {
  ANICITY_ENABLE_LIVE_TESTS: 'YES',
  ANICITY_TEST_ENVIRONMENT: 'staging',
  ANICITY_LIVE_TEST_ALLOWED_HOSTS: `${projectRef}.supabase.co,staging.anicity.test`,
  TEST_SUPABASE_URL: `https://${projectRef}.supabase.co`,
  TEST_SUPABASE_ANON_KEY: fakeAnonKey,
  TEST_QA_USER_EMAIL: 'qa@example.invalid',
  TEST_QA_USER_PASSWORD: 'test-only-placeholder',
  ANICITY_TEST_ACCOUNT_CONFIRMATION: 'DEDICATED_TEST_ACCOUNT',
  ANICITY_TEST_PROJECT_CONFIRMATION: 'DEDICATED_TEST_PROJECT',
  ANICITY_QA_TARGET_URL: 'https://staging.anicity.test',
};

const allowed = requireLiveTestConfig({ target: true, writes: true }, base);
assert.equal(allowed.supabaseUrl, `https://${projectRef}.supabase.co`);
assert.equal(allowed.targetUrl, 'https://staging.anicity.test');

assert.throws(() => requireLiveTestConfig({}, { ...base, ANICITY_ENABLE_LIVE_TESTS: 'NO' }), /Live tests are disabled/);
assert.throws(() => requireLiveTestConfig({}, { ...base, ANICITY_LIVE_TEST_ALLOWED_HOSTS: '' }), /must list exact/);
assert.throws(() => requireLiveTestConfig({ target: true }, { ...base, ANICITY_QA_TARGET_URL: 'https://unknown.example.test' }), /allowlisted/);
for (const productionHost of [
  'anicity-app.vercel.app',
  'yozora-app.vercel.app',
  'anicity-aniverse3.vercel.app',
  'anicity-git-main-aniverse3.vercel.app',
]) {
  assert.throws(() => requireLiveTestConfig({ target: true }, {
    ...base,
    ANICITY_QA_TARGET_URL: `https://${productionHost}`,
    ANICITY_LIVE_TEST_ALLOWED_HOSTS: `${projectRef}.supabase.co,${productionHost}`,
  }), /cannot be allowlisted|allowlisted/);
}
assert.throws(() => requireLiveTestConfig({}, {
  ...base,
  TEST_SUPABASE_URL: 'https://production-project.supabase.co',
  ANICITY_LIVE_TEST_ALLOWED_HOSTS: `${projectRef}.supabase.co,production-project.supabase.co`,
}), /cannot be allowlisted|allowlisted/);
assert.throws(() => requireLiveTestConfig({}, {
  ...base,
  TEST_SUPABASE_ANON_KEY: `header.${Buffer.from(JSON.stringify({ ref: 'zyxwvutsrqponmlkjihg' })).toString('base64url')}.signature`,
}), /does not match/);
assert.throws(() => requireLiveTestConfig({}, { ...base, ANICITY_TEST_ENVIRONMENT: 'production' }), /staging or test/);

console.log('Live URL allowlist regression checks passed. No live requests were made.');
