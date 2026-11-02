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
  validateEpisodes,
  validateProgress,
} from '../lib/validate.js';
import {
  isAdminRole,
  isStaffRole,
} from '../lib/roles.js';

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

// 4. Anime validation tests
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

console.log('\n========================================');
console.log('ALL 7 TEST SUITES PASSED PERFECTLY (100%)');
console.log('========================================\n');
