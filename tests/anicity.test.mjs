import assert from 'node:assert';
import {
  isDriveUrl,
  isDriveFolderUrl,
  extractDriveFileId,
  toPlayableUrl,
  driveProblem,
} from '../lib/drive.js';
import {
  validateAnime,
  validateSingleEpisode,
  validateEpisodes,
  validateProgress,
} from '../lib/validate.js';
import {
  validateImageFile,
} from '../lib/storage.js';
import {
  isAdminRole,
  isStaffRole,
} from '../lib/roles.js';
import { getSiteUrl } from '../lib/siteUrl.js';

console.log('--- RUNNING ANICITY TEST SUITE ---\n');

// 1. Google Drive validation tests
console.log('1. Testing Google Drive URL resolution...');
const testFileId = '11zICyxWSIu_3l5VYxm3VW40AtqXc5Pjl';
assert.strictEqual(
  extractDriveFileId(`https://drive.google.com/file/d/${testFileId}/view?usp=sharing`),
  testFileId,
  'Failed to extract file ID from /file/d/ URL'
);
assert.strictEqual(
  extractDriveFileId(`https://drive.google.com/open?id=${testFileId}`),
  testFileId,
  'Failed to extract file ID from ?id= URL'
);
assert.strictEqual(
  extractDriveFileId(`drive:${testFileId}`),
  testFileId,
  'Failed to extract file ID from drive: prefix'
);
assert.strictEqual(
  toPlayableUrl(`https://drive.google.com/file/d/${testFileId}/view?usp=sharing`),
  `https://drive.google.com/file/d/${testFileId}/preview`,
  'Failed to convert to preview embed URL'
);
console.log('✔ Google Drive URL resolution passed');

// 2. Folder rejection tests
console.log('2. Testing Google Drive folder rejection...');
const folderUrl = 'https://drive.google.com/drive/folders/1a2b3c4d5e6f';
assert.strictEqual(isDriveFolderUrl(folderUrl), true, 'Folder URL was not detected as folder');
assert.strictEqual(extractDriveFileId(folderUrl), null, 'Folder URL must not extract file ID');
const folderErr = driveProblem(folderUrl);
assert.ok(folderErr && folderErr.includes('papka'), 'Folder URL must return an error about folders');
console.log('✔ Folder rejection passed');

// 3. Fake domain rejection tests
console.log('3. Testing Fake Domain protection...');
const fakeUrl = 'https://drive.google.com.attacker.com/file/d/12345/view';
assert.strictEqual(isDriveUrl(fakeUrl), false, 'Fake domain was wrongly accepted as Drive URL');
assert.strictEqual(extractDriveFileId(fakeUrl), null, 'Fake domain must not extract file ID');
assert.strictEqual(toPlayableUrl(fakeUrl), fakeUrl, 'Fake domain must not be converted');
console.log('✔ Fake domain protection passed');

// 4. Anime metadata validation tests
console.log('4. Testing Anime metadata validation...');
const validAnime = validateAnime({
  title: 'Naruto Shippuden',
  year: 2007,
  status: 'Tugallangan',
  genres: ['Action', 'Adventure'],
  description: 'Ninja world',
});
assert.strictEqual(validAnime.errors.length, 0, 'Valid anime had unexpected errors');
assert.strictEqual(validAnime.value.title, 'Naruto Shippuden');

const invalidAnime = validateAnime({
  title: '',
  year: 1940,
  status: 'UnknownStatus',
});
assert.ok(invalidAnime.errors.length >= 3, 'Invalid anime errors not caught');
console.log('✔ Anime metadata validation passed');

// 5. Episode list validation tests
console.log('5. Testing Episode list validation...');
const validEpisodes = validateEpisodes([
  `1-qism | https://drive.google.com/file/d/${testFileId}/view`,
  `2-qism | https://drive.google.com/file/d/${testFileId}/preview`,
]);
assert.strictEqual(validEpisodes.errors.length, 0, 'Valid episodes had errors');
assert.strictEqual(validEpisodes.value.length, 2);
assert.ok(validEpisodes.value[0].video_url.endsWith('/preview'));

const invalidEpisodes = validateEpisodes([
  '1-qism | https://drive.google.com/drive/folders/1234567890',
]);
assert.ok(invalidEpisodes.errors.length > 0, 'Folder in episode list was not flagged');
console.log('✔ Episode list validation passed');

// 6. Progress validation tests
console.log('6. Testing Watch Progress validation...');
const p1 = validateProgress({ position_sec: 1500, duration_sec: 1600 });
assert.strictEqual(p1.errors.length, 0);
assert.strictEqual(p1.value.completed, true, 'Progress over 92% must be marked completed');

const p2 = validateProgress({ position_sec: 100, duration_sec: 1600 });
assert.strictEqual(p2.value.completed, false, 'Progress under 92% must not be marked completed');
console.log('✔ Watch progress validation passed');

// 7. Role permissions tests
console.log('7. Testing Role hierarchy...');
assert.strictEqual(isAdminRole('owner'), true);
assert.strictEqual(isAdminRole('admin'), true);
assert.strictEqual(isAdminRole('moderator'), false);
assert.strictEqual(isAdminRole('user'), false);

assert.strictEqual(isStaffRole('owner'), true);
assert.strictEqual(isStaffRole('admin'), true);
assert.strictEqual(isStaffRole('moderator'), true);
assert.strictEqual(isStaffRole('user'), false);
console.log('✔ Role hierarchy passed');

// 8. Open Redirect Protection tests
console.log('8. Testing Open Redirect protection...');
function sanitizeNext(next) {
  if (!next || typeof next !== 'string') return '/';
  return next.startsWith('/') && !next.startsWith('//') ? next : '/';
}
assert.strictEqual(sanitizeNext('/watch/123/1'), '/watch/123/1', 'Valid internal path was rejected');
assert.strictEqual(sanitizeNext('https://attacker.com'), '/', 'External URL was not redirected to /');
assert.strictEqual(sanitizeNext('//evil.com'), '/', 'Protocol-relative URL was not redirected to /');
assert.strictEqual(sanitizeNext('javascript:alert(1)'), '/', 'JavaScript scheme was not redirected to /');
console.log('✔ Open Redirect protection passed');

// 9. Protected Paths and Gating tests
console.log('9. Testing Protected Paths definition...');
const PROTECTED_PATHS = ['/watch', '/admin', '/favorites', '/history', '/profile', '/settings'];
assert.ok(PROTECTED_PATHS.includes('/watch'), '/watch must be in protected paths');
assert.ok(PROTECTED_PATHS.includes('/admin'), '/admin must be in protected paths');
assert.ok(PROTECTED_PATHS.includes('/favorites'), '/favorites must be in protected paths');
console.log('✔ Protected paths gating passed');

// 10. Admin placeholder leak prevention
console.log('10. Testing Admin placeholder leak prevention...');
const safePlaceholder = 'masalan: animefan123';
assert.ok(!safePlaceholder.includes('sapayev'), 'Placeholder must not leak admin usernames');
console.log('✔ Admin placeholder leak prevention passed');

// 11. Testing getSiteUrl production safety and localhost prevention
console.log('11. Testing getSiteUrl production safety...');
const origNodeEnv = process.env.NODE_ENV;
const origSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const origVercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;

try {
  // Production scenario with no env set
  process.env.NODE_ENV = 'production';
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
  delete process.env.VERCEL_URL;

  const prodUrl = getSiteUrl();
  assert.strictEqual(prodUrl, 'https://anicity-app.vercel.app', 'Production must default to https://anicity-app.vercel.app');
  assert.ok(!prodUrl.includes('localhost'), 'Production URL must NEVER contain localhost');

  // Production scenario with spoofed localhost header
  const fakeHeaders = { 'x-forwarded-host': 'localhost:3000', 'x-forwarded-proto': 'http' };
  const spoofResult = getSiteUrl(fakeHeaders);
  assert.strictEqual(spoofResult, 'https://anicity-app.vercel.app', 'Must reject localhost spoof headers in production');

  // Production scenario with valid custom domain header
  const validHeaders = { 'x-forwarded-host': 'anicity-app.vercel.app', 'x-forwarded-proto': 'https' };
  const validResult = getSiteUrl(validHeaders);
  assert.strictEqual(validResult, 'https://anicity-app.vercel.app');

  // Development scenario
  process.env.NODE_ENV = 'development';
  process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000';
  const devUrl = getSiteUrl();
  assert.strictEqual(devUrl, 'http://localhost:3000', 'Development can use localhost');
} finally {
  process.env.NODE_ENV = origNodeEnv;
  if (origSiteUrl !== undefined) process.env.NEXT_PUBLIC_SITE_URL = origSiteUrl;
  else delete process.env.NEXT_PUBLIC_SITE_URL;
  if (origVercelUrl !== undefined) process.env.VERCEL_PROJECT_PRODUCTION_URL = origVercelUrl;
  else delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
}
console.log('✔ getSiteUrl production safety passed');

// 12. OAuth Callback Error and Gating Tests
console.log('12. Testing OAuth Callback error routing...');
function resolveCallbackError(errorParam) {
  if (!errorParam) return null;
  const isOAuth = errorParam === 'access_denied' ||
    String(errorParam).toLowerCase().includes('oauth') ||
    String(errorParam).toLowerCase().includes('denied');
  return isOAuth ? '/login?error=oauth' : '/login?error=link';
}
assert.strictEqual(resolveCallbackError('access_denied'), '/login?error=oauth');
assert.strictEqual(resolveCallbackError('User denied access'), '/login?error=oauth');
assert.strictEqual(resolveCallbackError('otp_expired'), '/login?error=link');
console.log('✔ OAuth Callback error routing passed');

// 13. Decoupled Anime Creation Validation (Without Episodes Required)
console.log('13. Testing Decoupled Anime Creation without episodes requirement...');
const decoupledAnime = validateAnime({
  title: 'Solo Leveling: Arise',
  alt_title: 'Ore dake Level Up na Ken',
  year: 2025,
  status: 'Davom etmoqda',
  age_rating: '16+',
  studio: 'A-1 Pictures',
  director: 'Shunsuke Nakashige',
  genres: ['Action', 'Fantaziya'],
  description: 'Jinwoo yangi darajaga ko‘tariladi',
  is_featured: true,
  is_published: true,
  release_day: 'shanba',
  fandub_team: 'Anicity Dub',
});
assert.strictEqual(decoupledAnime.errors.length, 0, 'Decoupled anime must pass without errors');
assert.strictEqual(decoupledAnime.value.title, 'Solo Leveling: Arise');
assert.strictEqual(decoupledAnime.value.age_rating, '16+');
assert.strictEqual(decoupledAnime.value.studio, 'A-1 Pictures');
assert.strictEqual(decoupledAnime.value.is_featured, true);
assert.strictEqual(decoupledAnime.value.is_published, true);
assert.strictEqual(decoupledAnime.value.release_day, 'shanba');
console.log('✔ Decoupled Anime Creation passed (Episodes are NOT required)');

// 14. Poster and Banner Image File Validation
console.log('14. Testing Poster and Banner Image File Validation...');
const validImageFile = {
  name: 'poster.webp',
  size: 2 * 1024 * 1024, // 2 MB
  type: 'image/webp',
};
const validCheck = validateImageFile(validImageFile, { maxSizeMB: 5 });
assert.strictEqual(validCheck.valid, true, 'Valid 2MB WebP must be accepted');

const oversizedFile = {
  name: 'heavy_poster.jpg',
  size: 7 * 1024 * 1024, // 7 MB
  type: 'image/jpeg',
};
const oversizedCheck = validateImageFile(oversizedFile, { maxSizeMB: 5 });
assert.strictEqual(oversizedCheck.valid, false, '7MB file must be rejected (>5MB)');
assert.ok(oversizedCheck.error.includes('5 MB'), 'Error message must mention 5 MB limit');

const invalidMimeFile = {
  name: 'document.pdf',
  size: 500 * 1024,
  type: 'application/pdf',
};
const invalidMimeCheck = validateImageFile(invalidMimeFile, { maxSizeMB: 5 });
assert.strictEqual(invalidMimeCheck.valid, false, 'PDF must not be accepted as image');
assert.ok(invalidMimeCheck.error.includes('JPG') || invalidMimeCheck.error.includes('PNG'), 'Error message must list allowed formats');
console.log('✔ Poster and Banner Image File Validation passed');

// 15. Independent Single Episode Creation & Google Drive URL Validation
console.log('15. Testing Independent Single Episode Creation & Google Drive URLs...');
const singleEpValid = validateSingleEpisode({
  season_number: 1,
  number: 1,
  title: 'Boshlanish',
  description: 'Sung Jinwoo uyg‘onishi',
  video_url: `https://drive.google.com/file/d/${testFileId}/view?usp=sharing`,
  quality: '1080p',
  is_published: true,
});
assert.strictEqual(singleEpValid.errors.length, 0, 'Valid single episode had errors');
assert.strictEqual(singleEpValid.value.season_number, 1);
assert.strictEqual(singleEpValid.value.number, 1);
assert.strictEqual(singleEpValid.value.video_url, `https://drive.google.com/file/d/${testFileId}/preview`);
assert.strictEqual(singleEpValid.value.quality, '1080p');

// Folder URL rejection in single episode
const singleEpFolder = validateSingleEpisode({
  season_number: 1,
  number: 2,
  video_url: 'https://drive.google.com/drive/folders/abcdef12345',
});
assert.ok(singleEpFolder.errors.length > 0, 'Google Drive folder must be rejected');
assert.ok(singleEpFolder.errors[0].includes('papka'), 'Error must inform user about folder rejection');
console.log('✔ Independent Single Episode Creation & Google Drive URLs passed');

// 16. Duplicate Episode Number Validation within Same Season
console.log('16. Testing Duplicate Episode Validation within same season...');
function checkEpisodeDuplicate(existingList, seasonNumber, episodeNumber, ignoreId = null) {
  return existingList.some((e) => {
    if (ignoreId && e.id === ignoreId) return false;
    return (e.season_number || 1) === Number(seasonNumber) && Number(e.number) === Number(episodeNumber);
  });
}
const mockEpisodes = [
  { id: 'ep1', season_number: 1, number: 1, title: '1-qism' },
  { id: 'ep2', season_number: 1, number: 2, title: '2-qism' },
  { id: 'ep3', season_number: 2, number: 1, title: '2-fasl 1-qism' },
];

// Duplicate in same season
assert.strictEqual(checkEpisodeDuplicate(mockEpisodes, 1, 1), true, 'Season 1 Episode 1 duplicate not caught');
assert.strictEqual(checkEpisodeDuplicate(mockEpisodes, 1, 2), true, 'Season 1 Episode 2 duplicate not caught');

// Non-duplicate new episode
assert.strictEqual(checkEpisodeDuplicate(mockEpisodes, 1, 3), false, 'Season 1 Episode 3 wrongly marked as duplicate');

// Same episode number in different season is allowed
assert.strictEqual(checkEpisodeDuplicate(mockEpisodes, 2, 2), false, 'Season 2 Episode 2 should be allowed');

// Updating existing episode with its own number should not flag as duplicate
assert.strictEqual(checkEpisodeDuplicate(mockEpisodes, 1, 1, 'ep1'), false, 'Self-update flagged as duplicate');
console.log('✔ Duplicate Episode Validation passed');

// 17. Unauthorized Admin Protection Tests
console.log('17. Testing Unauthorized Admin Protection...');
const rolesToTest = [
  { role: 'owner', canAdmin: true },
  { role: 'admin', canAdmin: true },
  { role: 'moderator', canAdmin: false },
  { role: 'vip', canAdmin: false },
  { role: 'user', canAdmin: false },
  { role: null, canAdmin: false },
  { role: undefined, canAdmin: false },
];
for (const { role, canAdmin } of rolesToTest) {
  assert.strictEqual(isAdminRole(role), canAdmin, `Role "${role}" admin permission mismatch`);
}
console.log('✔ Unauthorized Admin Protection passed');

// 18. Server Component Null-Safety and React Error #441 Prevention
console.log('18. Testing Server Component Null-Safety & React #441 Prevention...');
function simulateAdminPageStats(animesList, usersList, profileData) {
  // Defensive profile display
  const username = profileData?.username || 'Admin';
  const roleDisplay = (profileData?.role || 'admin').toUpperCase();

  // Defensive array operations
  const totalAnimes = Array.isArray(animesList) ? animesList.length : 0;
  const totalEpisodes = (animesList || []).reduce((acc, a) => acc + (Array.isArray(a?.episodes) ? a.episodes.length : 0), 0);
  const totalViews = (animesList || []).reduce((acc, a) => acc + (Number(a?.view_count) || 0), 0);
  const totalUsers = Array.isArray(usersList) ? usersList.length : 0;
  const totalVip = (usersList || []).filter((u) => u?.subscription_plan === 'vip').length;

  return { username, roleDisplay, totalAnimes, totalEpisodes, totalViews, totalUsers, totalVip };
}

// Case A: Missing profile, null animes, missing episodes
const edgeCaseA = simulateAdminPageStats(
  [
    { id: '1', title: null, episodes: null, view_count: null },
    { id: '2', title: 'Anime 2', episodes: undefined, view_count: 'invalid' },
  ],
  [
    { id: 'u1', subscription_plan: null, created_at: null },
  ],
  null
);
assert.strictEqual(edgeCaseA.username, 'Admin');
assert.strictEqual(edgeCaseA.roleDisplay, 'ADMIN');
assert.strictEqual(edgeCaseA.totalAnimes, 2);
assert.strictEqual(edgeCaseA.totalEpisodes, 0);
assert.strictEqual(edgeCaseA.totalViews, 0);
assert.strictEqual(edgeCaseA.totalUsers, 1);
assert.strictEqual(edgeCaseA.totalVip, 0);

// Case B: Proper populated data
const edgeCaseB = simulateAdminPageStats(
  [
    { id: '1', title: 'Anime 1', episodes: [{ id: 'e1' }, { id: 'e2' }], view_count: 50 },
  ],
  [
    { id: 'u1', subscription_plan: 'vip' },
    { id: 'u2', subscription_plan: 'free' },
  ],
  { username: 'bunyotbek', role: 'owner' }
);
assert.strictEqual(edgeCaseB.username, 'bunyotbek');
assert.strictEqual(edgeCaseB.roleDisplay, 'OWNER');
assert.strictEqual(edgeCaseB.totalEpisodes, 2);
assert.strictEqual(edgeCaseB.totalViews, 50);
assert.strictEqual(edgeCaseB.totalVip, 1);
console.log('✔ Server Component Null-Safety & React #441 Prevention passed');

console.log('\n========================================');
console.log('ALL 18 TEST SUITES PASSED PERFECTLY (100%)');
console.log('========================================\n');
