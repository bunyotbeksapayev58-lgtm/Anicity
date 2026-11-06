import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

test('Video Player Fullscreen Toggle Implementation', () => {
  const playerCode = fs.readFileSync(path.resolve('components/Player.js'), 'utf8');

  // 1. Helper function checks all vendor prefixes for fullscreen element
  assert.ok(
    playerCode.includes('document.fullscreenElement') &&
    playerCode.includes('document.webkitFullscreenElement') &&
    playerCode.includes('document.mozFullScreenElement') &&
    playerCode.includes('document.msFullscreenElement'),
    'Must check document.fullscreenElement and vendor prefixes (webkit, moz, ms)'
  );

  // 2. Helper functions check vendor prefixes for exit and request
  assert.ok(
    playerCode.includes('document.exitFullscreen') &&
    playerCode.includes('document.webkitExitFullscreen') &&
    playerCode.includes('document.mozCancelFullScreen') &&
    playerCode.includes('document.msExitFullscreen'),
    'Must support exitFullscreen with vendor prefixes (webkit, moz, ms)'
  );

  assert.ok(
    playerCode.includes('element.requestFullscreen') &&
    playerCode.includes('element.webkitRequestFullscreen') &&
    playerCode.includes('element.mozRequestFullScreen') &&
    playerCode.includes('element.msRequestFullscreen'),
    'Must support requestFullscreen with vendor prefixes (webkit, moz, ms)'
  );

  // 3. toggleFullscreen checks if in fullscreen and branches properly
  assert.ok(
    playerCode.includes('if (activeFs || isFullscreen)'),
    'toggleFullscreen must branch to exit if activeFs or isFullscreen is true'
  );

  // 4. Safe promise rejection catch handlers
  assert.ok(
    playerCode.includes('console.error('),
    'Must wrap fullscreen promises with catch handler'
  );
});

test('Video Player Fullscreen State Sync and Event Listeners', () => {
  const playerCode = fs.readFileSync(path.resolve('components/Player.js'), 'utf8');

  // 1. Event listener registrations
  assert.ok(playerCode.includes("document.addEventListener('fullscreenchange'"), 'Must listen to fullscreenchange');
  assert.ok(playerCode.includes("document.addEventListener('webkitfullscreenchange'"), 'Must listen to webkitfullscreenchange');
  assert.ok(playerCode.includes("document.addEventListener('mozfullscreenchange'"), 'Must listen to mozfullscreenchange');
  assert.ok(playerCode.includes("document.addEventListener('MSFullscreenChange'"), 'Must listen to MSFullscreenChange');

  // 2. Event listener cleanups
  assert.ok(playerCode.includes("document.removeEventListener('fullscreenchange'"), 'Must cleanup fullscreenchange');
  assert.ok(playerCode.includes("document.removeEventListener('webkitfullscreenchange'"), 'Must cleanup webkitfullscreenchange');

  // 3. Icon rendering for fullscreen toggle
  // Expand icon (4 corners pointing outward)
  assert.ok(
    playerCode.includes('M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3'),
    'Must render Expand icon when windowed'
  );
  // Compress icon (arrows pointing inward)
  assert.ok(
    playerCode.includes('M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3'),
    'Must render Compress icon when fullscreen'
  );
});

test('Fullscreen Controls Overlay CSS Visibility & Interactivity', () => {
  const css = fs.readFileSync(path.resolve('app/globals.css'), 'utf8');

  assert.ok(
    css.includes('.ani-player-wrapper.is-fullscreen .ani-player-controls-overlay') ||
    css.includes('.ani-player-wrapper:fullscreen .ani-player-controls-overlay'),
    'CSS must ensure controls overlay is elevated and interactive in fullscreen'
  );
  assert.ok(
    css.includes('z-index: 50 !important;'),
    'CSS must elevate overlay z-index in fullscreen'
  );
});
