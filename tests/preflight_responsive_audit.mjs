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
const TEST_ANIME_ID = 'd139dbb0-73cc-49d9-b35a-8d37f3856303';
const SCREENSHOT_DIR = path.resolve('tests/screenshots');

const VIEWPORTS = [
  { name: '360px (Standard / Compact Android)', width: 360, height: 780, isMobile: true },
  { name: '375px (iPhone SE)', width: 375, height: 667, isMobile: true },
  { name: '390px (iPhone 13/14 / Galaxy)', width: 390, height: 844, isMobile: true },
  { name: '430px (iPhone Pro Max / S24 Ultra)', width: 430, height: 932, isMobile: true },
  { name: '768px (iPad / Tablet)', width: 768, height: 1024, isMobile: false },
  { name: '1280px (Desktop HD)', width: 1280, height: 800, isMobile: false },
];

async function runPreflightResponsiveAudit() {
  console.log('========================================================================');
  console.log('   ANICITY FINAL PRODUCTION PREFLIGHT: FULL RESPONSIVE & LAYOUT AUDIT');
  console.log('   Target URL:', LOCAL_URL);
  console.log('   Note: Using Chromium DevTools CDP viewport/touch emulation (no physical Android)');
  console.log('========================================================================\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--mute-audio'],
  });

  const authPage = await browser.newPage();

  try {
    // 1. Authenticate as QA Admin
    console.log('--- 1. AUTHENTICATING QA ADMIN ---');
    await authPage.goto(`${LOCAL_URL}/login`, { waitUntil: 'networkidle2' });
    await authPage.waitForSelector('input[name="login"]', { timeout: 10000 });
    await authPage.type('input[name="login"]', QA_ADMIN_EMAIL);
    await authPage.type('input[name="password"]', QA_ADMIN_PASSWORD);
    await Promise.all([
      authPage.waitForNavigation({ waitUntil: 'networkidle2' }),
      authPage.click('form button.btn'),
    ]);
    console.log('✔ Authenticated successfully as Admin.\n');

    const authPages = [
      { name: 'Bosh sahifa', path: '/' },
      { name: 'Katalog', path: '/catalog' },
      { name: 'Anime sahifasi', path: `/anime/${TEST_ANIME_ID}` },
      { name: 'Tomosha sahifasi', path: `/watch/${TEST_ANIME_ID}/1` },
      { name: 'Profil', path: '/profile' },
      { name: 'Admin panel', path: '/admin' },
    ];

    console.log('--- 2. AUTHENTICATED USER LAYOUT & OVERFLOW AUDIT ---');
    const authResults = [];

    for (const vp of VIEWPORTS) {
      console.log(`\n▶ Viewport: ${vp.name} (${vp.width}x${vp.height})`);
      await authPage.setViewport({
        width: vp.width,
        height: vp.height,
        isMobile: vp.isMobile,
        hasTouch: vp.isMobile,
        deviceScaleFactor: vp.isMobile ? 2 : 1,
      });

      for (const p of authPages) {
        await authPage.goto(`${LOCAL_URL}${p.path}`, { waitUntil: 'networkidle2' });

        const metrics = await authPage.evaluate(() => {
          const docW = document.documentElement.clientWidth;
          const bodyW = document.body.clientWidth;
          const scrollW = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
          const winW = window.innerWidth;
          const overflow = scrollW - winW;

          // Check if any element protrudes beyond window width
          const overflowing = [];
          const allEls = document.querySelectorAll('*');
          for (const el of allEls) {
            const r = el.getBoundingClientRect();
            if (r.right > winW + 2) {
              overflowing.push({
                tag: el.tagName,
                cls: String(el.className).slice(0, 40),
                right: Math.round(r.right),
                excess: Math.round(r.right - winW),
              });
            }
          }

          return {
            winW,
            docW,
            scrollW,
            overflow: Math.max(0, overflow),
            overflowCount: overflowing.length,
            sampleOverflow: overflowing.slice(0, 3),
          };
        });

        const status = metrics.overflow === 0 ? 'PASS (0px)' : `FAIL (+${metrics.overflow}px)`;
        console.log(`  [Auth: ${p.name}] ${status} | Scroll: ${metrics.scrollW}px vs Win: ${metrics.winW}px`);
        if (metrics.overflow > 0) {
          console.warn('    Protruding elements:', metrics.sampleOverflow);
        }

        authResults.push({
          viewport: vp.name,
          width: vp.width,
          page: p.name,
          path: p.path,
          overflow: metrics.overflow,
          pass: metrics.overflow === 0,
        });

        assert.strictEqual(metrics.overflow, 0, `Auth page ${p.name} must not overflow in ${vp.name}`);
      }
    }

    // ---------------------------------------------------------
    // 3. GUEST USER AUDIT
    // ---------------------------------------------------------
    console.log('\n--- 3. GUEST (UNAUTHENTICATED) USER AUDIT ---');
    const guestContext = await browser.createBrowserContext();
    const guestPage = await guestContext.newPage();

    const guestPages = [
      { name: 'Bosh sahifa', path: '/' },
      { name: 'Katalog', path: '/catalog' },
      { name: 'Anime sahifasi', path: `/anime/${TEST_ANIME_ID}` },
      { name: 'Login', path: '/login' },
      { name: 'Register', path: '/register' },
    ];

    const guestResults = [];

    for (const vp of VIEWPORTS) {
      console.log(`\n▶ Guest Viewport: ${vp.name} (${vp.width}x${vp.height})`);
      await guestPage.setViewport({
        width: vp.width,
        height: vp.height,
        isMobile: vp.isMobile,
        hasTouch: vp.isMobile,
        deviceScaleFactor: vp.isMobile ? 2 : 1,
      });

      for (const p of guestPages) {
        await guestPage.goto(`${LOCAL_URL}${p.path}`, { waitUntil: 'networkidle2' });

        const metrics = await guestPage.evaluate(() => {
          const scrollW = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
          const winW = window.innerWidth;
          const overflow = scrollW - winW;
          return {
            winW,
            scrollW,
            overflow: Math.max(0, overflow),
          };
        });

        const status = metrics.overflow === 0 ? 'PASS (0px)' : `FAIL (+${metrics.overflow}px)`;
        console.log(`  [Guest: ${p.name}] ${status} | Scroll: ${metrics.scrollW}px vs Win: ${metrics.winW}px`);
        guestResults.push({
          viewport: vp.name,
          width: vp.width,
          page: p.name,
          overflow: metrics.overflow,
          pass: metrics.overflow === 0,
        });

        assert.strictEqual(metrics.overflow, 0, `Guest page ${p.name} must not overflow in ${vp.name}`);
      }
    }

    await guestContext.close();

    console.log('\n========================================================================');
    console.log('   ALL 6 VIEWPORTS ACROSS 7 PAGES PASSED WITH 0px HORIZONTAL OVERFLOW!  ');
    console.log('========================================================================\n');
  } finally {
    await browser.close();
  }
}

runPreflightResponsiveAudit().catch((err) => {
  console.error('\n❌ PREFLIGHT RESPONSIVE AUDIT FAILED:', err);
  process.exit(1);
});
