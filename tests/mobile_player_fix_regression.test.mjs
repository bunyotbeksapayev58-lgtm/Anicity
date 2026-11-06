import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

test('Mobile Navbar and Avatar Layout Fixes', () => {
  const css = fs.readFileSync(path.resolve('app/globals.css'), 'utf8').replace(/\r\n/g, '\n');
  const navbar = fs.readFileSync(path.resolve('components/Navbar.js'), 'utf8');

  // 1. Topbar flex nowrap enforcement
  assert.ok(
    css.includes('.topbar-inner {\n  max-width: 1440px;\n  margin: 0 auto;\n  padding: 12px 24px;\n  display: flex !important;\n  align-items: center !important;\n  justify-content: space-between !important;\n  flex-wrap: nowrap !important;\n  gap: 16px;\n}'),
    'Topbar-inner must enforce flex-wrap: nowrap !important'
  );

  // 2. Avatar circle - strict dimensions and removal of purple background
  assert.ok(css.includes('background: #1a1a2e; /* Neutral dark base - no purple blob */'), 'Avatar circle must not use purple accent gradient');
  assert.ok(css.includes('width: 36px;'), 'Avatar circle must have mobile width 36px');
  assert.ok(css.includes('width: 40px;'), 'Avatar circle must have desktop width 40px');
  assert.ok(css.includes('.avatar-circle::before,\n.avatar-circle::after {\n  display: none !important;'), 'Avatar circle pseudo elements must be disabled');
  assert.ok(css.includes('.avatar-img-block {\n  width: 100% !important;\n  height: 100% !important;\n  object-fit: cover !important;\n  display: block !important;\n  border-radius: inherit;\n}'), 'Avatar img block must be 100% cover block');

  // 3. Navbar JSX classes
  assert.ok(navbar.includes('avatar-circle w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden shrink-0'), 'Navbar avatar must include strict dimension classes');
  assert.ok(navbar.includes('avatar-img-block w-full h-full object-cover block'), 'Navbar img must include cover block classes');

  // 4. Watch nav sub-bar isolation
  assert.ok(css.includes('.watch-nav-header {\n  display: flex !important;\n  align-items: center !important;\n  justify-content: space-between !important;\n  flex-wrap: nowrap !important;'), 'Watch-nav-header must be styled as dedicated sub-bar');
});

test('Google Drive Mobile Player Black Screen & Popout Guard Fixes', () => {
  const player = fs.readFileSync(path.resolve('components/Player.js'), 'utf8');
  const trailers = fs.readFileSync(path.resolve('components/TrailersClips.js'), 'utf8');
  const css = fs.readFileSync(path.resolve('app/globals.css'), 'utf8').replace(/\r\n/g, '\n');

  // 1. Container aspect ratio and classes
  assert.ok(
    player.includes('className="ani-drive-frame-box w-full aspect-video bg-black rounded-xl overflow-hidden relative"'),
    'Player must define explicit aspect ratio container classes'
  );

  // 2. Iframe attributes for mobile sandbox & security
  assert.ok(
    player.includes('className="ani-drive-iframe w-full h-full border-0 absolute inset-0"'),
    'Iframe must have absolute inset-0 sizing'
  );
  assert.ok(
    player.includes('referrerPolicy="no-referrer"'),
    'Player iframe must have referrerPolicy="no-referrer" to prevent mobile Drive black screen'
  );
  assert.ok(
    player.includes('loading="eager"'),
    'Player iframe must have loading="eager"'
  );
  assert.ok(
    player.includes('allow="autoplay; fullscreen; encrypted-media; picture-in-picture"'),
    'Player iframe must allow autoplay fullscreen encrypted-media'
  );

  // 3. Pop-out Guard
  assert.ok(
    player.includes('className="ani-drive-popout-guard"'),
    'Player must include .ani-drive-popout-guard'
  );
  assert.ok(
    css.includes('.ani-drive-popout-guard {\n  position: absolute;\n  top: 0;\n  right: 0;'),
    'CSS must style .ani-drive-popout-guard at top-right'
  );

  // 4. Trailers iframe also protected
  assert.ok(
    trailers.includes('referrerPolicy="no-referrer"'),
    'Trailers modal iframe must also set referrerPolicy="no-referrer"'
  );
});
