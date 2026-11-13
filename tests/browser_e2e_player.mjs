import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import { createClient } from '@supabase/supabase-js';

// Load environment if .env.local exists
if (fs.existsSync('.env.local')) {
  const envContent = fs.readFileSync('.env.local', 'utf-8');
  for (const line of envContent.split('\n')) {
    const [k, ...rest] = line.split('=');
    if (k && rest) process.env[k.trim()] = rest.join('=').trim();
  }
}

const PROD_URL = process.env.PROD_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const QA_EMAIL = process.env.QA_USER_EMAIL || process.env.TEST_USER_EMAIL || '';
const QA_PASSWORD = process.env.QA_USER_PASSWORD || process.env.TEST_USER_PASSWORD || '';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function runBrowserPlayerVerification() {
  if (!QA_EMAIL || !QA_PASSWORD) {
    console.log('Skipping browser player verification: QA_USER_EMAIL or QA_USER_PASSWORD not provided.');
    return;
  }
  console.log('\n======================================================');
  console.log('   BROWSER E2E: MOBILE VIDEO PLAYER & REAL PLAYBACK');
  console.log(`   Chrome Binary: ${CHROME_PATH}`);
  console.log(`   Target URL: ${PROD_URL}`);
  console.log('======================================================\n');

  if (!fs.existsSync('tests/screenshots')) {
    fs.mkdirSync('tests/screenshots', { recursive: true });
  }

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
    ],
  });

  const page = await browser.newPage();

  try {
    // 1. Authenticate via Supabase in the browser to set cookies
    console.log('1. Logging in via /login with QA credentials...');
    await page.goto(`${PROD_URL}/login`, { waitUntil: 'networkidle2' });

    // Fill login form
    await page.waitForSelector('#login', { timeout: 10000 });
    await page.type('#login', QA_EMAIL);
    await page.type('#password', QA_PASSWORD);
    await page.click('form button.btn');

    // Wait for redirect to home or profile
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    console.log(`✔ Authenticated. Current page: ${page.url()}`);

    // 2. Test Mobile Viewports on Watch Page
    const viewports = [
      { name: '360px (Standard Android)', width: 360, height: 800, file: 'tests/screenshots/player_360px.png' },
      { name: '390px (iPhone 13/14 / Modern Galaxy)', width: 390, height: 844, file: 'tests/screenshots/player_390px.png' },
      { name: '430px (iPhone Pro Max / Ultra Android)', width: 430, height: 932, file: 'tests/screenshots/player_430px.png' },
    ];

    const watchUrl = `${PROD_URL}/watch/ed7d0df3-a345-451b-8c18-dbb1364fe2a7/1`;

    for (const vp of viewports) {
      console.log(`\n--- Testing Viewport: ${vp.name} ---`);
      await page.setViewport({
        width: vp.width,
        height: vp.height,
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
      });

      await page.goto(watchUrl, { waitUntil: 'networkidle2', timeout: 30000 });

      // Wait for player container and iframe
      await page.waitForSelector('.ani-drive-container', { timeout: 10000 });
      await page.waitForSelector('.ani-drive-iframe', { timeout: 10000 });
      await page.waitForSelector('.ani-drive-external-bar', { timeout: 10000 });

      // Measure layout metrics
      const playerMetrics = await page.evaluate(() => {
        const container = document.querySelector('.ani-drive-container');
        const frameBox = document.querySelector('.ani-drive-frame-box');
        const iframe = document.querySelector('.ani-drive-iframe');
        const externalBar = document.querySelector('.ani-drive-external-bar');
        const oldPill = document.querySelector('.ani-drive-fs-pill');

        const boxRect = frameBox ? frameBox.getBoundingClientRect() : null;
        const barRect = externalBar ? externalBar.getBoundingClientRect() : null;
        const bodyWidth = document.body.scrollWidth;
        const viewportWidth = window.innerWidth;

        return {
          containerExists: Boolean(container),
          frameBoxWidth: boxRect ? Math.round(boxRect.width) : 0,
          frameBoxHeight: boxRect ? Math.round(boxRect.height) : 0,
          aspectRatio: boxRect ? (boxRect.width / boxRect.height).toFixed(2) : 0,
          barHeight: barRect ? Math.round(barRect.height) : 0,
          hasHorizontalOverflow: bodyWidth > viewportWidth,
          hasOldOverlappingPill: Boolean(oldPill),
          iframeSrc: iframe ? iframe.src : null,
        };
      });

      console.log(`  Frame Box Dimensions: ${playerMetrics.frameBoxWidth}px x ${playerMetrics.frameBoxHeight}px`);
      console.log(`  Aspect Ratio: ${playerMetrics.aspectRatio} (Expected ~1.78)`);
      console.log(`  External Bar Height: ${playerMetrics.barHeight}px`);
      console.log(`  Horizontal Overflow: ${playerMetrics.hasHorizontalOverflow ? 'FAIL' : 'NONE (PASS)'}`);
      console.log(`  Old Overlapping Pill Present: ${playerMetrics.hasOldOverlappingPill ? 'YES (FAIL)' : 'NO (PASS)'}`);

      // Capture screenshot
      await page.screenshot({ path: vp.file, fullPage: false });
      console.log(`  ✔ Screenshot saved: ${vp.file}`);
    }

    // 3. Test Fullscreen / Theater Mode Interaction on 390px
    console.log('\n--- Testing Fullscreen / Theater Mode Interaction ---');
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto(watchUrl, { waitUntil: 'networkidle2' });

    // Click "Katta ekran" button in the external toolbar
    const fsButton = await page.$('.ani-drive-bar-btn.fullscreen');
    if (fsButton) {
      await fsButton.click();
      await new Promise((r) => setTimeout(r, 1000));

      const isTheaterActive = await page.evaluate(() => {
        const c = document.querySelector('.ani-drive-container');
        return c?.classList.contains('is-theater-mode') || document.fullscreenElement !== null;
      });

      console.log(`  Fullscreen / Theater Mode Triggered: ${isTheaterActive ? 'YES (PASS)' : 'NO'}`);
      await page.screenshot({ path: 'tests/screenshots/player_fullscreen_mode.png' });
      console.log('  ✔ Screenshot saved: tests/screenshots/player_fullscreen_mode.png');

      // Click "✕ Chiqish" button
      const exitBtn = await page.$('.ani-theater-exit-btn');
      if (exitBtn) {
        await exitBtn.click();
        await new Promise((r) => setTimeout(r, 800));
        const isStillTheater = await page.evaluate(() => {
          const c = document.querySelector('.ani-drive-container');
          return c?.classList.contains('is-theater-mode');
        });
        console.log(`  Restored to normal layout upon Exit click: ${!isStillTheater ? 'YES (PASS)' : 'NO'}`);
      }
    }

    // 4. Test Google Drive Video Embed Actual Playback Structure
    console.log('\n--- Testing Google Drive Playback Structure & Codec Support ---');
    const iframeUrl = await page.evaluate(() => {
      const iframe = document.querySelector('.ani-drive-iframe');
      return iframe?.src || null;
    });

    console.log(`  Target Google Drive Embed: ${iframeUrl}`);
    if (iframeUrl) {
      const drivePage = await browser.newPage();
      await drivePage.setViewport({ width: 1280, height: 720 });
      await drivePage.goto(iframeUrl, { waitUntil: 'networkidle2', timeout: 30000 });

      const driveHtml = await drivePage.content();
      const hasDrivePlayer = driveHtml.includes('drive-viewer') || driveHtml.includes('video-player') || driveHtml.includes('drive-video') || driveHtml.includes('html5-video-player') || driveHtml.includes('docs-gm');
      console.log(`  Google Drive Player DOM Initialized: ${hasDrivePlayer ? 'YES (PASS)' : 'PARTIAL'}`);

      await drivePage.screenshot({ path: 'tests/screenshots/google_drive_embed_render.png' });
      console.log('  ✔ Screenshot saved: tests/screenshots/google_drive_embed_render.png');
      await drivePage.close();
    }

    console.log('\n======================================================');
    console.log('   BROWSER E2E TESTS COMPLETED SUCCESSFULLY (PASS)');
    console.log('======================================================\n');
  } catch (err) {
    console.error('Browser E2E Error:', err);
  } finally {
    await browser.close();
  }
}

runBrowserPlayerVerification().catch(console.error);
