import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('Stitch Neo-Cyber Profile & Edit Modal UI Integration', async () => {
  // 1. Check ProfileView.js
  const profileViewSrc = await read('../components/ProfileView.js');

  // Verify modal is wired and accessible
  assert.ok(profileViewSrc.includes('ProfileEditModal'), 'ProfileView must import and render ProfileEditModal');
  assert.ok(profileViewSrc.includes('open-edit-modal-btn'), 'ProfileView must contain open-edit-modal-btn');
  assert.ok(profileViewSrc.includes('open-edit-modal-hero-btn'), 'ProfileView must contain open-edit-modal-hero-btn');
  assert.ok(profileViewSrc.includes('stitch-avatar-clickable'), 'ProfileView avatar must be clickable to edit');
  assert.ok(profileViewSrc.includes('setIsEditModalOpen(true)'), 'Trigger button must set isEditModalOpen to true');

  // Verify NO hardcoded mock demo data
  assert.ok(!profileViewSrc.includes('Laylo CyberKitsune'), 'Mock name Laylo CyberKitsune must not be hardcoded in ProfileView');
  assert.ok(!profileViewSrc.includes('@cyber_laylo'), 'Mock handle @cyber_laylo must not be hardcoded in ProfileView');
  assert.ok(!profileViewSrc.includes('Neo Edgerunner: 2099'), 'Mock anime cards must not be hardcoded in ProfileView');

  // Verify real dynamic props
  assert.ok(profileViewSrc.includes('favoritesList.length'), 'Favorites count must be dynamic');
  assert.ok(profileViewSrc.includes('historyList.length'), 'History count must be dynamic');
  assert.ok(profileViewSrc.includes('totalWatchedHours'), 'Watched hours must be calculated dynamically');
  assert.ok(profileViewSrc.includes('displayName'), 'Display name must be dynamic');
  assert.ok(profileViewSrc.includes('username'), 'Username must be dynamic');
  assert.ok(profileViewSrc.includes('bio'), 'Bio must be passed and rendered');

  // 2. Check ProfileEditModal.js
  const modalSrc = await read('../components/ProfileEditModal.js');
  assert.ok(modalSrc.includes('id="edit-profile-modal"'), 'Modal must have id="edit-profile-modal"');
  assert.ok(modalSrc.includes('updateOwnProfile'), 'Modal must use updateOwnProfile server action');
  assert.ok(modalSrc.includes('name="display_name"'), 'Modal must have display_name form input');
  assert.ok(modalSrc.includes('name="avatar"'), 'Modal must have avatar file input');
  assert.ok(modalSrc.includes('name="avatarAction"'), 'Modal must support removing avatar');
  assert.ok(modalSrc.includes('name="bio"'), 'Modal must have bio input field');
  assert.ok(modalSrc.includes('role="dialog"'), 'Modal must have accessible role="dialog"');
  assert.ok(modalSrc.includes('aria-modal="true"'), 'Modal must have aria-modal="true"');

  // 3. Check layout.js has font & Material Symbols
  const layoutSrc = await read('../app/layout.js');
  assert.ok(layoutSrc.includes('Material+Symbols+Outlined'), 'RootLayout must include Material Symbols Outlined font');
  assert.ok(layoutSrc.includes('Inter'), 'RootLayout must include Inter font');

  // 4. Check globals.css has Stitch design tokens & modal styles
  const cssSrc = await read('../app/globals.css');
  assert.ok(cssSrc.includes('--stitch-surface: #121221;'), 'CSS must define --stitch-surface token');
  assert.ok(cssSrc.includes('.stitch-modal-overlay'), 'CSS must define .stitch-modal-overlay');
  assert.ok(cssSrc.includes('.stitch-modal-container'), 'CSS must define .stitch-modal-container');
  assert.ok(cssSrc.includes('.stitch-hero-card'), 'CSS must define .stitch-hero-card');
  assert.ok(cssSrc.includes('.stitch-vip-card'), 'CSS must define .stitch-vip-card');
  assert.ok(cssSrc.includes('.stitch-avatar-hero-ring'), 'CSS must define .stitch-avatar-hero-ring');
  assert.ok(cssSrc.includes('.stitch-btn-edit-hero'), 'CSS must define .stitch-btn-edit-hero');
  assert.ok(cssSrc.includes('.stitch-avatar-clickable'), 'CSS must define .stitch-avatar-clickable');

  // 5. Check app/actions/profile.js updates bio and preserves avatars safely
  const actionSrc = await read('../app/actions/profile.js');
  assert.ok(actionSrc.includes("formData.get('bio')"), 'Server action must read bio from formData');
  assert.ok(actionSrc.includes('{ bio }'), 'Server action must update bio column');
  assert.ok(actionSrc.includes('display_name: displayName'), 'Server action must update display_name column');

  console.log('✔ All Stitch Neo-Cyber Profile & Edit Modal integration assertions passed!');
});
