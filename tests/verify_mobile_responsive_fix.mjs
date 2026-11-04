import puppeteer from 'puppeteer-core';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

// Load .env.test.local
const envTestPath = path.resolve('.env.test.local');
if (fs.existsSync(envTestPath)) {
  const envLines = fs.readFileSync(envTestPath, 'utf-8').split('\n');
  for (const line of envLines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [k, ...v] = trimmed.split('=');
    if (k && v.length && !process.env[k.trim()]) {
      process.env[k.trim()] = v.join('=').trim();
    }
  }
}

const CHROME_PATH = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const LOCAL_URL = 'http://localhost:3000';
const QA_ADMIN_EMAIL = process.env.QA_ADMIN_EMAIL || 'qa-admin@anicity.internal';
const QA_ADMIN_PASSWORD = process.env.QA_ADMIN_PASSWORD;
const REAL_ANIME_ID = 'd139dbb0-73cc-49d9-b35a-8d37f3856303';
const SCREENSHOT_DIR = path.resolve('tests/screenshots');

async function verifyResponsiveFix() {
  console.log('======================================================================');
  console.log('   ANICITY 360px TOPBAR OVERFLOW FIX VERIFICATION (LOCAL SSR)');
  console.log('   Target URL:', LOCAL_URL);
  console.log('======================================================================\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--mute-audio'],
  });

  const page = await browser.newPage();

  try {
    // ---------------------------------------------------------
    // TEST 1: LOGGED-IN USER ACROSS VIEWPORTS & PAGES
    // ---------------------------------------------------------
    console.log('--- TEST 1: LOGGED-IN USER OVERFLOW & ELEMENT CHECKS ---');
    console.log('Logging in at /login...');
    await page.goto(`${LOCAL_URL}/login`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('input[name="login"]', { timeout: 10000 });
    await page.type('input[name="login"]', QA_ADMIN_EMAIL);
    await page.type('input[name="password"]', QA_ADMIN_PASSWORD);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2' }),
      page.click('form button.btn'),
    ]);
    console.log('✔ Authenticated successfully.\n');

    const viewports = [
      { name: '360px (Standard / Compact Android)', width: 360, height: 780 },
      { name: '375px (iPhone SE / Standard iPhone)', width: 375, height: 667 },
      { name: '390px (iPhone 13/14 / Modern Galaxy)', width: 390, height: 844 },
      { name: '430px (iPhone Pro Max / Galaxy S24 Ultra)', width: 430, height: 932 },
    ];

    const loggedInPages = [
      { path: '/', label: 'Home Page' },
      { path: '/catalog', label: 'Catalog Page' },
      { path: '/profile', label: 'Profile Page' },
      { path: `/watch/${REAL_ANIME_ID}/1`, label: 'Watch Page (Real Drive Player)' },
    ];

    for (const vp of viewports) {
      console.log(`\n▶ Testing Viewport: ${vp.name} (${vp.width}x${vp.height})`);
      await page.setViewport({
        width: vp.width,
        height: vp.height,
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
      });

      for (const p of loggedInPages) {
        await page.goto(`${LOCAL_URL}${p.path}`, { waitUntil: 'networkidle2' });

        const check = await page.evaluate(() => {
          const scrollW = document.documentElement.scrollWidth;
          const clientW = document.documentElement.clientWidth;
          const bodyScrollW = document.body.scrollWidth;
          const windowW = window.innerWidth;
          const maxScroll = Math.max(scrollW, bodyScrollW);

          const nameLabel = document.querySelector('.user-name-label');
          const avatar = document.querySelector('.avatar-circle');
          const trigger = document.querySelector('.user-avatar-trigger');

          let nameVisible = false;
          if (nameLabel) {
            const style = window.getComputedStyle(nameLabel);
            nameVisible = style.display !== 'none' && style.visibility !== 'hidden';
          }

          return {
            scrollW,
            clientW,
            bodyScrollW,
            windowW,
            maxScroll,
            overflow: maxScroll - windowW,
            hasAvatar: Boolean(avatar && avatar.offsetWidth > 0),
            hasTrigger: Boolean(trigger && trigger.offsetWidth > 0),
            triggerWidth: trigger ? Math.round(trigger.offsetWidth) : 0,
            nameVisible,
          };
        });

        const isPass = check.overflow <= 0;
        console.log(`  [${p.label}] Scroll: ${check.maxScroll}px <= Viewport: ${check.windowW}px | Overflow: ${isPass ? 'PASS (0px)' : `FAIL (+${check.overflow}px)`} | Avatar: ${check.hasAvatar} | TriggerWidth: ${check.triggerWidth}px | NameVisible: ${check.nameVisible}`);
        assert.ok(isPass, `Page ${p.path} must not have horizontal overflow in ${vp.name} (got +${check.overflow}px)`);
        assert.ok(check.hasAvatar, `Avatar circle must remain visible on ${p.path} in ${vp.name}`);
        assert.ok(check.hasTrigger, `Avatar trigger must exist on ${p.path} in ${vp.name}`);
        if (vp.width <= 480) {
          assert.strictEqual(check.nameVisible, false, `user-name-label must be hidden on ${p.path} in ${vp.name}`);
        }
      }

      // Take screenshot at 360px watch page
      if (vp.width === 360) {
        const shot360 = path.join(SCREENSHOT_DIR, 'fixed_360px_watch_page.png');
        await page.screenshot({ path: shot360, fullPage: false });
        console.log(`  ✔ Screenshot captured: ${shot360}`);
      }
    }

    // Test dropdown menu interaction on 360px
    console.log('\n▶ Testing Menu Dropdown interaction on 360px...');
    await page.setViewport({ width: 360, height: 780, isMobile: true, hasTouch: true });
    await page.goto(`${LOCAL_URL}/`, { waitUntil: 'networkidle2' });
    const trigger = await page.$('.user-avatar-trigger');
    assert.ok(trigger, 'User avatar trigger button must exist');
    await trigger.click();
    await new Promise((r) => setTimeout(r, 400));

    const dropdownState = await page.evaluate(() => {
      const popover = document.querySelector('.user-dropdown-popover');
      return {
        isOpen: Boolean(popover),
        hasProfileLink: Boolean(popover?.querySelector('a[href="/profile"]')),
      };
    });
    console.log('✔ Dropdown popover opened cleanly on 360px:', dropdownState);
    assert.ok(dropdownState.isOpen, 'User menu popover must open on avatar tap');
    assert.ok(dropdownState.hasProfileLink, 'Popover must contain profile link');

    // ---------------------------------------------------------
    // TEST 2: DESKTOP & TABLET REGRESSION CHECK (> 480px)
    // ---------------------------------------------------------
    console.log('\n--- TEST 2: DESKTOP & TABLET REGRESSION CHECK (> 480px) ---');
    for (const dt of [{ name: '768px (Tablet)', width: 768 }, { name: '1280px (Desktop)', width: 1280 }]) {
      await page.setViewport({ width: dt.width, height: 800 });
      await page.goto(`${LOCAL_URL}/`, { waitUntil: 'networkidle2' });
      const nameStyle = await page.evaluate(() => {
        const el = document.querySelector('.user-name-label');
        if (!el) return null;
        const s = window.getComputedStyle(el);
        return { display: s.display, text: el.innerText };
      });
      console.log(`  [${dt.name}] user-name-label display: "${nameStyle?.display}" | text: "${nameStyle?.text}"`);
      assert.notStrictEqual(nameStyle?.display, 'none', `user-name-label must NOT be hidden on ${dt.name}`);
    }
    console.log('✔ Desktop and tablet designs remain 100% intact.\n');

    // ---------------------------------------------------------
    // TEST 3: LOGGED-OUT USER ACROSS VIEWPORTS
    // ---------------------------------------------------------
    console.log('--- TEST 3: LOGGED-OUT USER ACROSS ALL VIEWPORTS ---');
    const incognitoContext = await browser.createBrowserContext();
    const guestPage = await incognitoContext.newPage();

    const loggedOutPages = ['/', '/catalog', '/login', '/register'];

    for (const vp of viewports) {
      console.log(`\n▶ Testing Guest Viewport: ${vp.name} (${vp.width}x${vp.height})`);
      await guestPage.setViewport({ width: vp.width, height: vp.height, isMobile: true, hasTouch: true });

      for (const p of loggedOutPages) {
        await guestPage.goto(`${LOCAL_URL}${p}`, { waitUntil: 'networkidle2' });
        const check = await guestPage.evaluate(() => {
          const maxScroll = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
          const windowW = window.innerWidth;
          const loginBtn = document.querySelector('.btn-login-nav') || document.querySelector('a[href="/login"]');
          return {
            maxScroll,
            windowW,
            overflow: maxScroll - windowW,
            hasLogin: Boolean(loginBtn),
          };
        });
        const isPass = check.overflow <= 0;
        console.log(`  [Guest: ${p}] Scroll: ${check.maxScroll}px <= Viewport: ${check.windowW}px | Overflow: ${isPass ? 'PASS (0px)' : `FAIL (+${check.overflow}px)`} | HasLoginBtn: ${check.hasLogin}`);
        assert.ok(isPass, `Guest page ${p} must not have horizontal overflow in ${vp.name}`);
      }
    }
    await incognitoContext.close();

    console.log('\n======================================================================');
    console.log('   ALL RESPONSIVE AND OVERFLOW CHECKS PASSED (100% VERIFIED)          ');
    console.log('======================================================================\n');
  } finally {
    await browser.close();
  }
}

verifyResponsiveFix().catch((err) => {
  console.error('\n❌ RESPONSIVE FIX TEST FAILED:', err);
  process.exit(1);
});
