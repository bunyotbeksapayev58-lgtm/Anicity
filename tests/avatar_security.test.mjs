import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { isSafeAvatarUrl, getOwnedAvatarPath, validateProfileImage } from '../lib/profile-image.js';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('isSafeAvatarUrl accepts null, empty and valid owned storage paths', () => {
  const userId = '550e8400-e29b-41d4-a716-446655440000';
  assert.equal(isSafeAvatarUrl(null, userId), true);
  assert.equal(isSafeAvatarUrl('', userId), true);
  assert.equal(isSafeAvatarUrl(`https://project.supabase.co/storage/v1/object/public/profile-avatars/${userId}/photo_1.jpg`, userId), true);
  assert.equal(isSafeAvatarUrl(`https://project.supabase.co/storage/v1/object/public/profile-avatars/${userId}/photo-2.png`, userId), true);
  assert.equal(isSafeAvatarUrl(`https://project.supabase.co/storage/v1/object/public/profile-avatars/${userId}/avatar.webp`, userId), true);
});

test('isSafeAvatarUrl rejects mismatched user ID (stealing/referencing another user folder)', () => {
  const userId = 'user-owner-111';
  const victimId = 'user-victim-222';
  assert.equal(isSafeAvatarUrl(`https://project.supabase.co/storage/v1/object/public/profile-avatars/${victimId}/avatar.png`, userId), false);
});

test('isSafeAvatarUrl rejects path traversal and directory escape attempts', () => {
  const userId = 'user-123';
  assert.equal(isSafeAvatarUrl(`https://project.supabase.co/storage/v1/object/public/profile-avatars/${userId}/../victim/photo.jpg`, userId), false);
  assert.equal(isSafeAvatarUrl(`https://project.supabase.co/storage/v1/object/public/profile-avatars/${userId}/%2e%2e/victim/photo.jpg`, userId), false);
  assert.equal(isSafeAvatarUrl(`https://project.supabase.co/storage/v1/object/public/profile-avatars/${userId}/subdir/photo.jpg`, userId), false);
});

test('isSafeAvatarUrl rejects malicious schemes and unallowed MIME extensions', () => {
  const userId = 'user-123';
  assert.equal(isSafeAvatarUrl('javascript:alert(1)', userId), false);
  assert.equal(isSafeAvatarUrl('data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==', userId), false);
  assert.equal(isSafeAvatarUrl('file:///etc/passwd', userId), false);
  assert.equal(isSafeAvatarUrl(`https://project.supabase.co/storage/v1/object/public/profile-avatars/${userId}/xss.html`, userId), false);
  assert.equal(isSafeAvatarUrl(`https://project.supabase.co/storage/v1/object/public/profile-avatars/${userId}/vector.svg`, userId), false);
  assert.equal(isSafeAvatarUrl(`https://project.supabase.co/storage/v1/object/public/profile-avatars/${userId}/payload.exe`, userId), false);
  assert.equal(isSafeAvatarUrl(`https://project.supabase.co/storage/v1/object/public/profile-avatars/${userId}/script.php`, userId), false);
});

test('isSafeAvatarUrl rejects external domains, query parameters and credentials', () => {
  const userId = 'user-123';
  assert.equal(isSafeAvatarUrl('https://evil.com/fake.png', userId), false);
  assert.equal(isSafeAvatarUrl(`https://project.supabase.co/storage/v1/object/public/profile-avatars/${userId}/photo.jpg?token=malicious`, userId), false);
  assert.equal(isSafeAvatarUrl(`https://user:pass@project.supabase.co/storage/v1/object/public/profile-avatars/${userId}/photo.jpg`, userId), false);
});

test('getOwnedAvatarPath extracts correct relative storage path and rejects forged URLs', () => {
  const userId = 'user-123';
  const validUrl = `https://lngeosburovsxotywbfw.supabase.co/storage/v1/object/public/profile-avatars/${userId}/avatar_abc.png`;
  assert.equal(getOwnedAvatarPath(validUrl, userId), `${userId}/avatar_abc.png`);
  assert.equal(getOwnedAvatarPath(`https://lngeosburovsxotywbfw.supabase.co/storage/v1/object/public/profile-avatars/other-user/avatar.png`, userId), null);
  assert.equal(getOwnedAvatarPath('javascript:alert(1)', userId), null);
});

test('Storage RLS policy enforces extension whitelist and exact folder depth in 013', async () => {
  const sql = await read('../supabase/migrations/013_profiles_assistant_admins.sql');
  assert.match(sql, /CREATE POLICY "avatars own insert" ON storage\.objects FOR INSERT TO authenticated/);
  assert.match(sql, /lower\(storage\.extension\(name\)\) IN \('jpg', 'jpeg', 'png', 'webp'\)/);
  assert.match(sql, /array_length\(string_to_array\(name, '\/'\), 1\) = 2/);
  assert.match(sql, /CREATE POLICY "avatars own update" ON storage\.objects FOR UPDATE TO authenticated/);
});

test('profiles_guard trigger strictly blocks unauthorized avatar URLs in 015', async () => {
  const sql = await read('../supabase/migrations/015_assistant_security_audit_fixes.sql');
  assert.match(sql, /NEW\.avatar_url IS DISTINCT FROM OLD\.avatar_url/);
  assert.match(sql, /storage\/v1\/object\/public\/profile-avatars/);
  assert.match(sql, /auth\.uid\(\)::text/);
  assert.match(sql, /invalid or unauthorized avatar url/);
});
