# AniCity — Engineering Upgrade Changelog

## [Version 2.0.0] — Master Engineering Upgrade

### 🛡️ Security Hardening
- **Sliding-Window Rate Limiting (`lib/rate-limit.js`):** Built-in in-memory token bucket rate limiter with client IP resolution and automatic 5-minute memory pruning.
- **Server Action Protection (`app/actions/auth.js`):** Enforced rate limits on `login` (5/min), `register` (3/min), `forgotPassword` (3/min), and `resetPassword` (5/min).
- **API Endpoint Protection (`app/api/animes/route.js`):** Enforced rate limiting on public search catalog (`GET`, 60/min) and administrative creations (`POST`, 20/min).
- **Storage Isolation:** Hardened avatar uploads with single-folder depth constraints and file extension whitelisting.

### 🎬 Professional Video Streaming Architecture
- **Provider Abstraction (`lib/video/provider.js`):** Universal abstraction supporting Google Drive, HLS (`.m3u8`), direct MP4/WebM, and Cloudflare Stream.
- **HMAC Playback Tokens:** Added cryptographic HMAC-SHA256 time-bound signed tokens with timing-safe validation.
- **Player Accessibility (A11y):** Enhanced scrubber and volume sliders in `components/Player.js` with `role="slider"`, `aria-label`, `aria-valuemin`, `aria-valuemax`, and dynamic `aria-valuenow`.
- **Keyboard Hotkeys:** Space/K (play/pause), F (fullscreen toggle), M (mute/unmute), Left/Right (seek), Up/Down (volume).
- **Audio Etiquette:** Muted default autoplay and localStorage volume restoration.

### 💳 VIP Subscriptions & Payments
- **Payment Provider Abstraction (`lib/payments/provider.js`):** Added Click, Payme, Stripe, and Sandbox payment checkout generators and webhook signature validators.
- **Idempotent Payment Webhook (`app/api/payments/webhook/route.js`):** Double-charge and duplicate grant prevention with database uniqueness locks.
- **Smart Subscription Extension:** Intelligent rollover extending active subscriptions from current expiration rather than resetting paid days.

### 🔍 SEO & Semantic Search
- **Structured Data (JSON-LD):** Embedded schema.org `TVSeries` structured data in `app/anime/[id]/page.js` and `TVEpisode` / `VideoObject` in `app/watch/[animeId]/[num]/page.js`.
- **Dynamic Robots & Sitemap:** Dynamic `robots.js` and `sitemap.js` verified with 1-hour revalidation.

### 🧪 Automated Testing & Database Integrity
- **Test Suite Expansion:** Expanded automated regression testing battery to **18 test suites** (`npm test`), passing 100% green with zero mocks or disabling.
- **Database Hardening:** Formally verified 16+ migrations, foreign key cascades, and `SET search_path = pg_catalog, public, pg_temp` across all privileged RPCs.
