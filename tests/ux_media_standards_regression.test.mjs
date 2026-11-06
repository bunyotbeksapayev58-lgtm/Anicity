import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('1. Navbar UX, Notification Bell & Global Search Shortcuts', () => {
  const navbarContent = fs.readFileSync(path.resolve('components/Navbar.js'), 'utf8');

  // Assert global shortcuts: ⌘K or /
  assert.ok(
    navbarContent.includes("e.key?.toLowerCase() === 'k'") || navbarContent.includes("e.key.toLowerCase() === 'k'"),
    'Navbar must support ⌘K / Ctrl+K shortcut for search'
  );
  assert.ok(
    navbarContent.includes("e.key === '/'"),
    'Navbar must support / shortcut for search'
  );

  // Assert Notification Bell component
  assert.ok(
    navbarContent.includes('notification-bell-btn'),
    'Navbar must render notification bell button'
  );
  assert.ok(
    navbarContent.includes('notification-dot'),
    'Navbar must have notification unread dot indicator'
  );
  assert.ok(
    navbarContent.includes('notifications-popover'),
    'Navbar must render notifications dropdown popover'
  );

  // Assert mobile bottom thumb bar
  assert.ok(
    navbarContent.includes('mobile-bottom-bar'),
    'Navbar must contain mobile bottom navigation bar'
  );
  assert.ok(
    navbarContent.includes('bottom-bar-item'),
    'Navbar must contain bottom-bar-item links'
  );
});

test('2. Video Player Hotkeys & Volume Persistence in localStorage', () => {
  const playerContent = fs.readFileSync(path.resolve('components/Player.js'), 'utf8');

  // Assert hotkeys: Space, K, Left, Right, Up, Down, F, M
  assert.ok(
    playerContent.includes("e.code === 'Space' || e.code === 'KeyK'"),
    'Player must support Space and K for play/pause'
  );
  assert.ok(
    playerContent.includes("e.code === 'ArrowRight'"),
    'Player must support ArrowRight for skip forward'
  );
  assert.ok(
    playerContent.includes("e.code === 'ArrowLeft'"),
    'Player must support ArrowLeft for skip backward'
  );
  assert.ok(
    playerContent.includes("e.code === 'ArrowUp'"),
    'Player must support ArrowUp for volume up'
  );
  assert.ok(
    playerContent.includes("e.code === 'ArrowDown'"),
    'Player must support ArrowDown for volume down'
  );
  assert.ok(
    playerContent.includes("e.code === 'KeyF'"),
    'Player must support KeyF for fullscreen toggle'
  );
  assert.ok(
    playerContent.includes("e.code === 'KeyM'"),
    'Player must support KeyM for mute/unmute'
  );

  // Assert localStorage persistence
  assert.ok(
    playerContent.includes('anicity_player_volume'),
    'Player must persist volume to anicity_player_volume in localStorage'
  );
  assert.ok(
    playerContent.includes('anicity_player_muted'),
    'Player must persist mute state to anicity_player_muted in localStorage'
  );
});

test('3. Watch Page Episode Navigation Disabled Boundary Standards', () => {
  const watchPageContent = fs.readFileSync(path.resolve('app/watch/[animeId]/[num]/page.js'), 'utf8');

  // Assert disabled buttons have disabled class and aria-disabled
  assert.ok(
    watchPageContent.includes('watch-nav-btn disabled'),
    'Watch page must render disabled class on disabled nav buttons'
  );
  assert.ok(
    watchPageContent.includes('aria-disabled="true"'),
    'Watch page must include aria-disabled on disabled buttons'
  );
});

test('4. AuthForm Password Visibility Toggle, Inline Validation & Submission Spinner', () => {
  const authFormContent = fs.readFileSync(path.resolve('components/AuthForm.js'), 'utf8');

  // Assert Show/Hide password toggle
  assert.ok(
    authFormContent.includes('showPassword'),
    'AuthForm must have showPassword state'
  );
  assert.ok(
    authFormContent.includes('password-toggle-btn'),
    'AuthForm must have password toggle button'
  );

  // Assert inline validation onBlur
  assert.ok(
    authFormContent.includes('onBlur={handleBlur}'),
    'AuthForm must attach handleBlur to inputs for inline validation'
  );
  assert.ok(
    authFormContent.includes('clientErrors'),
    'AuthForm must track client errors for instant feedback'
  );

  // Assert submit loading spinner
  assert.ok(
    authFormContent.includes('btn-spinner-icon'),
    'AuthForm must render spinner SVG when pending'
  );
});

test('5. Global CSS Standards (Focus Visible, Synopsis Max-Width, Disabled States)', () => {
  const cssContent = fs.readFileSync(path.resolve('app/globals.css'), 'utf8');

  assert.ok(
    cssContent.includes('focus-visible'),
    'globals.css must define focus-visible accessibility rules'
  );
  assert.ok(
    cssContent.includes('max-width: 68ch'),
    'globals.css must constrain long synopses to max 68ch for cognitive readability'
  );
  assert.ok(
    cssContent.includes('.watch-nav-btn.disabled'),
    'globals.css must style disabled navigation buttons'
  );
  assert.ok(
    cssContent.includes('.notification-bell-btn'),
    'globals.css must style notification bell'
  );
  assert.ok(
    cssContent.includes('.password-toggle-btn'),
    'globals.css must style password visibility button'
  );
  assert.ok(
    cssContent.includes('.btn-spinner-icon'),
    'globals.css must define spinner animation'
  );
});
