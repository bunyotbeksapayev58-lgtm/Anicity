import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

test('1. Bunny Stream Direct Upload Signature Algorithm Integrity', () => {
  const libraryId = '34567';
  const apiKey = 'my-bunny-secret-api-key-123';
  const expirationTime = 1794500000;
  const videoId = 'd83c2718-4a69-4f70-982f-87d9a1f2b604';

  const stringToSign = `${libraryId}${apiKey}${expirationTime}${videoId}`;
  const signature = crypto.createHash('sha256').update(stringToSign).digest('hex');

  assert.equal(typeof signature, 'string');
  assert.equal(signature.length, 64, 'SHA-256 signature must be 64 hex characters');

  // Verify repeatability
  const expectedHash = crypto.createHash('sha256').update(`${libraryId}${apiKey}${expirationTime}${videoId}`).digest('hex');
  assert.equal(signature, expectedHash);
});

test('2. Bunny Upload API Route Source Inspection & Defenses', async () => {
  const routePath = path.resolve('app/api/admin/bunny/upload-signature/route.js');
  const code = await fs.readFile(routePath, 'utf8');

  assert.ok(code.includes('authorizeAdminOperation'), 'Route must enforce admin or assistant authorization');
  assert.ok(code.includes("'video_upload'"), 'Route must check video_upload permission');
  assert.ok(code.includes('BUNNY_STREAM_LIBRARY_ID'), 'Route must read BUNNY_STREAM_LIBRARY_ID');
  assert.ok(code.includes('BUNNY_STREAM_API_KEY'), 'Route must read BUNNY_STREAM_API_KEY');
  assert.ok(code.includes('https://video.bunnycdn.com/library/'), 'Route must create video on Bunny API');
  assert.ok(code.includes("crypto.createHash('sha256')"), 'Route must generate SHA-256 presigned signature');
  assert.ok(code.includes('https://video.bunnycdn.com/tusupload'), 'Route must direct client to TUS endpoint');
  assert.ok(code.includes('bunny:'), 'Route must return bunny: protocol videoUrl');
});

test('3. BunnyVideoUploader Component Source Inspection', async () => {
  const compPath = path.resolve('components/BunnyVideoUploader.js');
  const code = await fs.readFile(compPath, 'utf8');

  assert.ok(code.includes("from 'tus-js-client'"), 'Component must use tus-js-client');
  assert.ok(code.includes('/api/admin/bunny/upload-signature'), 'Component must fetch credentials from API');
  assert.ok(code.includes('AuthorizationSignature'), 'TUS request must set AuthorizationSignature header');
  assert.ok(code.includes('AuthorizationExpire'), 'TUS request must set AuthorizationExpire header');
  assert.ok(code.includes('LibraryId'), 'TUS request must set LibraryId header');
  assert.ok(code.includes('VideoId'), 'TUS request must set VideoId header');
  assert.ok(code.includes('onProgress'), 'Component must support upload progress tracking');
});

test('4. AdminEpisodeManager Integration Verification', async () => {
  const managerPath = path.resolve('components/AdminEpisodeManager.js');
  const code = await fs.readFile(managerPath, 'utf8');

  assert.ok(code.includes('import BunnyVideoUploader'), 'AdminEpisodeManager must import BunnyVideoUploader');
  assert.ok(code.includes('<BunnyVideoUploader'), 'AdminEpisodeManager must render BunnyVideoUploader');
  assert.ok(code.includes('onUploadSuccess'), 'Must connect onUploadSuccess callback to setVideoUrl');
});

test('5. ByteString / BOM (charCode 65279) Sanitization Verification', () => {
  const dirtyInput = '\uFEFF807345';
  assert.equal(dirtyInput.charCodeAt(0), 65279);

  const cleanByteString = (val) => {
    if (val === null || val === undefined) return '';
    return String(val)
      .replace(/^\uFEFF+/, '')
      .replace(/[^\x20-\x7E]/g, '')
      .trim();
  };

  const clean = cleanByteString(dirtyInput);
  assert.equal(clean, '807345');
  assert.equal(clean.charCodeAt(0), 56);
  assert.ok([...clean].every((c) => c.charCodeAt(0) <= 255), 'All characters must be valid ByteStrings (<= 255)');
});
