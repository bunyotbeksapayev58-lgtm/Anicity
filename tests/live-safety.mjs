const BLOCKED_HOSTS = new Set([
  'anicity-app.vercel.app',
  'yozora-app.vercel.app',
  'anicity-aniverse3.vercel.app',
  'anicity-git-main-aniverse3.vercel.app',
  'production-project.supabase.co',
]);
const PRODUCTION_PROJECT_REF = 'production-project';

function parseAllowlist(env) {
  const hosts = (env.ANICITY_LIVE_TEST_ALLOWED_HOSTS || '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  if (hosts.length === 0) {
    throw new Error('ANICITY_LIVE_TEST_ALLOWED_HOSTS must list exact dedicated test hostnames.');
  }
  for (const host of hosts) {
    if (!/^[a-z0-9.-]+$/.test(host) || host.startsWith('.') || host.endsWith('.') || host.includes('..')) {
      throw new Error('ANICITY_LIVE_TEST_ALLOWED_HOSTS contains an invalid hostname.');
    }
    if (BLOCKED_HOSTS.has(host) || host === 'vercel.app' || host.endsWith('.vercel.app')) {
      throw new Error('Production and shared hosting domains cannot be allowlisted for live tests.');
    }
  }
  return new Set(hosts);
}

function parseSafeUrl(value, name, allowedHosts) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(name + ' must be a valid URL.');
  }
  const hostname = parsed.hostname.toLowerCase();
  if (
    parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port ||
    parsed.pathname !== '/' || parsed.search || parsed.hash || BLOCKED_HOSTS.has(hostname) ||
    hostname === 'vercel.app' || hostname.endsWith('.vercel.app') || !allowedHosts.has(hostname)
  ) {
    throw new Error(name + ' must exactly match an allowlisted dedicated non-production HTTPS host.');
  }
  return parsed.origin;
}

export function requireLiveTestConfig({ target = false, writes = false, auth = true } = {}, env = process.env) {
  if (env.ANICITY_ENABLE_LIVE_TESTS !== 'YES') {
    throw new Error('Live tests are disabled. Explicitly set ANICITY_ENABLE_LIVE_TESTS=YES to opt in.');
  }
  if (env.ANICITY_TEST_ENVIRONMENT !== 'staging' && env.ANICITY_TEST_ENVIRONMENT !== 'test') {
    throw new Error('ANICITY_TEST_ENVIRONMENT must be explicitly set to staging or test.');
  }
  const allowedHosts = parseAllowlist(env);
  const supabaseUrl = parseSafeUrl(env.TEST_SUPABASE_URL, 'TEST_SUPABASE_URL', allowedHosts);
  const supabaseHost = new URL(supabaseUrl).hostname.toLowerCase();
  const refMatch = supabaseHost.match(/^([a-z0-9]{20})\.supabase\.co$/);
  if (!refMatch || refMatch[1] === PRODUCTION_PROJECT_REF) {
    throw new Error('TEST_SUPABASE_URL must identify an allowlisted dedicated Supabase test project.');
  }

  const anonKey = env.TEST_SUPABASE_ANON_KEY;
  if (!anonKey) throw new Error('TEST_SUPABASE_ANON_KEY is required for live tests.');
  let tokenClaims;
  try {
    tokenClaims = JSON.parse(Buffer.from(anonKey.split('.')[1], 'base64url').toString('utf8'));
  } catch {
    throw new Error('TEST_SUPABASE_ANON_KEY must identify the dedicated test project.');
  }
  if (tokenClaims.ref !== refMatch[1] || tokenClaims.ref === PRODUCTION_PROJECT_REF) {
    throw new Error('The supplied Supabase key does not match the allowlisted test project.');
  }

  const userEmail = env.TEST_QA_USER_EMAIL;
  const userPassword = env.TEST_QA_USER_PASSWORD;
  if (auth && (!userEmail || !userPassword)) {
    throw new Error('TEST_QA_USER_EMAIL and TEST_QA_USER_PASSWORD are required for this live test.');
  }
  if (auth && env.ANICITY_TEST_ACCOUNT_CONFIRMATION !== 'DEDICATED_TEST_ACCOUNT') {
    throw new Error('Live auth tests require ANICITY_TEST_ACCOUNT_CONFIRMATION=DEDICATED_TEST_ACCOUNT.');
  }
  const targetUrl = target ? parseSafeUrl(env.ANICITY_QA_TARGET_URL, 'ANICITY_QA_TARGET_URL', allowedHosts) : null;
  if (writes && env.ANICITY_TEST_PROJECT_CONFIRMATION !== 'DEDICATED_TEST_PROJECT') {
    throw new Error('Write tests require ANICITY_TEST_PROJECT_CONFIRMATION=DEDICATED_TEST_PROJECT.');
  }
  return { supabaseUrl, anonKey, userEmail, userPassword, targetUrl };
}
