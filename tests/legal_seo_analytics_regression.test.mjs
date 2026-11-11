import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

test('1. Privacy Policy Legal & Security Standards', () => {
  const privacyPath = path.join(rootDir, 'app', 'privacy', 'page.js');
  assert.ok(fs.existsSync(privacyPath), 'app/privacy/page.js must exist');
  const content = fs.readFileSync(privacyPath, 'utf8');

  assert.ok(content.includes('O‘RQ-547') || content.includes('O‘zbekiston'), 'Must reference Uzbekistan personal data law');
  assert.ok(content.includes('Click') && content.includes('Payme'), 'Must state payment gateways security');
  assert.ok(content.includes('saqlamaydi'), 'Must state card numbers/CVV are never stored');
  assert.ok(content.includes('SSL/TLS') && content.includes('bcrypt'), 'Must document encryption and bcrypt');
  assert.ok(content.includes('Row-Level Security') || content.includes('RLS'), 'Must document database RLS');
});

test('2. Terms of Service Anti-Abuse & Liability Standards', () => {
  const termsPath = path.join(rootDir, 'app', 'terms', 'page.js');
  assert.ok(fs.existsSync(termsPath), 'app/terms/page.js must exist');
  const content = fs.readFileSync(termsPath, 'utf8');

  assert.ok(content.includes('Anti-abuse') || content.includes('botlar') || content.includes('skreperlar'), 'Must restrict scraping and bots');
  assert.ok(content.includes('VIP Obuna'), 'Must document VIP subscription terms');
  assert.ok(content.includes('DMCA') || content.includes('mualliflik'), 'Must reference DMCA/copyright');
  assert.ok(content.includes('qonunchiligi'), 'Must reference governing law');
});

test('3. Cookie Policy & Interactive Consent Banner', () => {
  const cookiesPath = path.join(rootDir, 'app', 'cookies', 'page.js');
  const bannerPath = path.join(rootDir, 'components', 'CookieBanner.js');
  const footerPath = path.join(rootDir, 'components', 'Footer.js');

  assert.ok(fs.existsSync(cookiesPath), 'app/cookies/page.js must exist');
  assert.ok(fs.existsSync(bannerPath), 'components/CookieBanner.js must exist');

  const cookiesContent = fs.readFileSync(cookiesPath, 'utf8');
  assert.ok(cookiesContent.includes('Zaruriy') || cookiesContent.includes('Necessary'), 'Must document necessary cookies');
  assert.ok(cookiesContent.includes('Analitika') || cookiesContent.includes('Analytics'), 'Must document analytics cookies');

  const bannerContent = fs.readFileSync(bannerPath, 'utf8');
  assert.ok(bannerContent.includes('anicity_cookie_consent'), 'Must persist consent in storage');
  assert.ok(bannerContent.includes('Barchasini qabul qilish'), 'Must have accept all button');
  assert.ok(bannerContent.includes('Faqat zaruriylar'), 'Must have essential only button');

  const footerContent = fs.readFileSync(footerPath, 'utf8');
  assert.ok(footerContent.includes('/cookies'), 'Footer must link to /cookies');
});

test('4. Sitemap Inclusion of Legal & Policy Routes', () => {
  const sitemapPath = path.join(rootDir, 'app', 'sitemap.js');
  const content = fs.readFileSync(sitemapPath, 'utf8');

  assert.ok(content.includes('/terms'), 'Sitemap must include /terms');
  assert.ok(content.includes('/privacy'), 'Sitemap must include /privacy');
  assert.ok(content.includes('/cookies'), 'Sitemap must include /cookies');
  assert.ok(content.includes('/dmca'), 'Sitemap must include /dmca');
});

test('5. SEO, Google Search Console & Schema.org JSON-LD', () => {
  const layoutPath = path.join(rootDir, 'app', 'layout.js');
  const content = fs.readFileSync(layoutPath, 'utf8');

  assert.ok(content.includes('NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION'), 'Must wire Google verification env');
  assert.ok(content.includes('application/ld+json'), 'Must include JSON-LD structured data');
  assert.ok(content.includes('SearchAction'), 'Must declare SearchAction for catalog');
  assert.ok(content.includes('GoogleAnalytics'), 'Must include GoogleAnalytics component');
  assert.ok(content.includes('CookieBanner'), 'Must include CookieBanner component');
});

test('6. GA4, GTM & Content Security Policy (CSP) Whitelist', () => {
  const gaComponentPath = path.join(rootDir, 'components', 'GoogleAnalytics.js');
  const nextConfigPath = path.join(rootDir, 'next.config.mjs');

  assert.ok(fs.existsSync(gaComponentPath), 'GoogleAnalytics component must exist');
  const gaContent = fs.readFileSync(gaComponentPath, 'utf8');
  assert.ok(gaContent.includes('NEXT_PUBLIC_GA_ID'), 'Must support GA4 ID');
  assert.ok(gaContent.includes('NEXT_PUBLIC_GTM_ID'), 'Must support GTM ID');
  assert.ok(gaContent.includes('afterInteractive'), 'Must load non-blocking for optimal PageSpeed');

  const configContent = fs.readFileSync(nextConfigPath, 'utf8');
  assert.ok(configContent.includes('https://www.googletagmanager.com'), 'CSP must whitelist GTM in script-src');
  assert.ok(configContent.includes('https://www.google-analytics.com'), 'CSP must whitelist GA in script-src/connect-src');
  assert.ok(configContent.includes('X-DNS-Prefetch-Control'), 'Must enable DNS prefetch');
});
