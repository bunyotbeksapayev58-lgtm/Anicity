import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { validatePlaybackAccess } from '../lib/video/secure-delivery.js';

test('1. updateOwnCredentials Source Inspection & Security Controls', () => {
  const authActions = fs.readFileSync(path.resolve('app/actions/auth.js'), 'utf8');

  // Must export updateOwnCredentials
  assert.ok(
    authActions.includes('export async function updateOwnCredentials'),
    'updateOwnCredentials must be exported from app/actions/auth.js'
  );

  // Must authenticate caller via supabase.auth.getUser()
  assert.match(
    authActions,
    /const\s*\{\s*data:\s*\{\s*user\s*\}\s*\}\s*=\s*await\s*supabase\.auth\.getUser\(\)/,
    'updateOwnCredentials must authenticate caller from active session'
  );

  // Must validate password confirmation
  assert.ok(
    authActions.includes('newPassword !== confirmPassword'),
    'Must check password confirmation match'
  );

  // Must validate password length (min 6, max 72)
  assert.ok(
    authActions.includes('newPassword.length < 8'),
    'Must enforce minimum 8 characters for passwords'
  );

  // Must validate username pattern
  assert.ok(
    authActions.includes('^[A-Za-z0-9_]{3,20}$'),
    'Must enforce alphanumeric + underscore username pattern (3-20 chars)'
  );

  // Must check distributed rate limit
  assert.ok(
    authActions.includes('checkDistributedRateLimit'),
    'Must apply rate limiting against brute force'
  );
});

test('2. updateUserRole Source Inspection & Privilege Escalation Defenses', () => {
  const adminActions = fs.readFileSync(path.resolve('app/actions/admin.js'), 'utf8');

  // Must export updateUserRole
  assert.ok(
    adminActions.includes('export async function updateUserRole'),
    'updateUserRole must be exported from app/actions/admin.js'
  );

  // Must require admin authorization
  assert.match(
    adminActions,
    /const\s+actor\s*=\s*await\s*assertAdmin\(supabase\)/,
    'updateUserRole must invoke assertAdmin'
  );

  // Must validate valid roles
  assert.ok(
    adminActions.includes("['user', 'moderator', 'admin', 'owner']"),
    'Must restrict roles strictly to user, moderator, admin, or owner'
  );

  // Anti-Privilege Escalation: Non-owner cannot appoint Owner
  assert.ok(
    adminActions.includes("newRole === 'owner' && actor.role !== 'owner'"),
    'Only Owner can appoint another Owner'
  );

  // Anti-Privilege Escalation: Non-owner cannot modify Owner
  assert.ok(
    adminActions.includes("targetProfile?.role === 'owner' && actor.role !== 'owner'"),
    'Non-owner cannot demote or alter an Owner profile'
  );
});

test('3. Admin UI Integration: Role Selection & Password Management Links', () => {
  const adminPage = fs.readFileSync(path.resolve('app/admin/page.js'), 'utf8');

  // Header must provide quick link to credentials editing
  assert.ok(
    adminPage.includes('/profile?edit=credentials'),
    'Admin header must link to /profile?edit=credentials'
  );

  // Users table must contain active role selector form
  assert.ok(
    adminPage.includes('action={updateUserRole}'),
    'Users table must wire updateUserRole form'
  );
  assert.ok(
    adminPage.includes('<select'),
    'Users table must provide role selection dropdown'
  );
});

test('4. ProfileEditModal: Dual Tabs & Password Management Interface', () => {
  const modalCode = fs.readFileSync(path.resolve('components/ProfileEditModal.js'), 'utf8');

  // Must import updateOwnCredentials
  assert.ok(
    modalCode.includes('updateOwnCredentials'),
    'ProfileEditModal must import updateOwnCredentials action'
  );

  // Must support security/credentials tab
  assert.ok(
    modalCode.includes("activeModalTab === 'security'"),
    'Modal must support security credentials tab'
  );

  // Must provide password inputs
  assert.ok(
    modalCode.includes('name="new_password"'),
    'Must have new_password input'
  );
  assert.ok(
    modalCode.includes('name="confirm_password"'),
    'Must have confirm_password input'
  );
});

test('5. Video Paywall & VIP Playback Gating Verification', () => {
  const freeUser = { id: 'user-free-123' };
  const vipUser = { id: 'user-vip-456' };
  const adminUser = { id: 'admin-789' };

  const regularProfile = { role: 'user', suspended_at: null };
  const adminProfile = { role: 'admin', suspended_at: null };

  const activeVipSub = [{
    id: 'sub-1',
    plan_name: 'VIP Oylik',
    status: 'active',
    expires_at: new Date(Date.now() + 86400000 * 30).toISOString(),
  }];

  // 1080p regular episode (Free)
  const regularEpisode = {
    id: 'ep-free',
    quality: '1080p',
    is_published: true,
  };

  // 4K / VIP episode (Paid)
  const vipEpisode = {
    id: 'ep-paid',
    quality: '4K',
    is_published: true,
  };

  // Free user accessing regular episode -> ALLOWED
  const res1 = validatePlaybackAccess({
    user: freeUser,
    profile: regularProfile,
    episode: regularEpisode,
    subscriptions: [],
  });
  assert.equal(res1.allowed, true, 'Free user can watch regular 1080p episode');

  // Free user accessing 4K / VIP episode -> REJECTED with VIP_REQUIRED
  const res2 = validatePlaybackAccess({
    user: freeUser,
    profile: regularProfile,
    episode: vipEpisode,
    subscriptions: [],
  });
  assert.equal(res2.allowed, false, 'Free user cannot watch 4K / VIP episode');
  assert.equal(res2.code, 'VIP_REQUIRED');

  // VIP user accessing 4K / VIP episode -> ALLOWED
  const res3 = validatePlaybackAccess({
    user: vipUser,
    profile: regularProfile,
    episode: vipEpisode,
    subscriptions: activeVipSub,
  });
  assert.equal(res3.allowed, true, 'Active VIP user can watch 4K / VIP episode');
  assert.equal(res3.isVip, true);

  // Admin accessing 4K / VIP episode without subscription -> ALLOWED (Privileged)
  const res4 = validatePlaybackAccess({
    user: adminUser,
    profile: adminProfile,
    episode: vipEpisode,
    subscriptions: [],
  });
  assert.equal(res4.allowed, true, 'Admin can preview 4K / VIP episode without subscription');
  assert.equal(res4.isPrivileged, true);
});

test('6. Admin Subscription Plans & Episode Manager UI Verification', () => {
  const plansCode = fs.readFileSync(path.resolve('components/AdminSubscriptionPlans.js'), 'utf8');
  assert.ok(
    plansCode.includes('Pullik Video Ruxsati'),
    'AdminSubscriptionPlans must offer quick button for paid streaming access'
  );
  assert.ok(
    plansCode.includes('🎬 PULLIK VIDEO'),
    'AdminSubscriptionPlans must render paid video badge'
  );

  const episodeCode = fs.readFileSync(path.resolve('components/AdminEpisodeManager.js'), 'utf8');
  assert.ok(
    episodeCode.includes('ep_requires_vip'),
    'AdminEpisodeManager must have VIP paid video toggle'
  );
  assert.ok(
    episodeCode.includes('Havolani tekshirish'),
    'AdminEpisodeManager must have test video URL button'
  );
  assert.ok(
    episodeCode.includes('👑 VIP / Pullik'),
    'AdminEpisodeManager must display VIP badge in episode list'
  );
});
