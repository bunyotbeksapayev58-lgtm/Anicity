# AniCity — Quality Assurance & Automated Testing Architecture

## 1. QA Strategy & Testing Pyramid

AniCity enforces a zero-regression policy. No code is committed to `main` without passing all unit, integration, and security test suites.

The testing suite consists of **18 automated test suites** covering:
- Media URL resolution and Google Drive embed normalization.
- Defensive security (open redirect, avatar path traversal, admin boundary leaks).
- Rate limiting sliding windows and IP resolution.
- Video streaming layer and HMAC playback token verification.
- Payment checkout generation, webhook signatures, and idempotency.
- Database integrity, foreign keys, and hardened RPC search paths.
- UI/UX standards, responsive viewport styling, and accessibility attributes.

---

## 2. Test Suites Reference (`npm test`)

Running `npm test` executes the complete battery in under 3 seconds:

| # | Test Suite | Primary Target & Scope |
| :--- | :--- | :--- |
| **1** | `tests/anicity.test.mjs` | Core business logic, Google Drive resolution, URL gating, admin placeholder leak defense, subscription expiration, and responsive viewport sizing (360px–430px). |
| **2** | `tests/security_regression.test.mjs` | Profile actions, user ID boundary guards, image size constraints, and public read vs mutation permission checks. |
| **3** | `tests/live_safety_regression.test.mjs` | Live URL allowlist regression checks ensuring no unexpected live external calls during standard test runs. |
| **4** | `tests/admin_pagination_regression.test.mjs` | Pagination logic for user management and admin listings. |
| **5** | `tests/subscription_grant_regression.test.mjs` | VIP subscription grant scheduling, transactional lock assertions, and duration calculations. |
| **6** | `tests/profile_assistant_regression.test.mjs` | Assistant admin permission boundaries and content read/edit grants. |
| **7** | `tests/assistant_security_fixes.test.mjs` | Assistant authorization verification and failure audit logging. |
| **8** | `tests/avatar_security.test.mjs` | Storage RLS rules, path traversal defenses, MIME whitelists, and `profiles_guard` trigger integrity. |
| **9** | `tests/production_readiness_fixes.test.mjs` | SEO robots.js, dynamic sitemap.js, auth guidance, and 360px overflow rules. |
| **10** | `tests/migration_bridge_repair.test.mjs` | SQL migrations 011b, 012, and 015 search_path compatibility. |
| **11** | `tests/stitch_ui_integration.test.mjs` | Neo-cyber profile aesthetics and modal component bindings. |
| **12** | `tests/mobile_player_fix_regression.test.mjs` | Google Drive black screen fixes, popout guard, and topbar `flex-wrap: nowrap`. |
| **13** | `tests/fullscreen_toggle_regression.test.mjs` | Cross-browser vendor prefixes (`webkit`, `moz`, `ms`) and fullscreen state synchronization. |
| **14** | `tests/ux_media_standards_regression.test.mjs` | Global keyboard shortcuts (`⌘K`, `/`, `Space`, `F`, `M`), volume persistence, and boundary navigation buttons. |
| **15** | `tests/rate_limit_regression.test.mjs` | In-memory token bucket rate limiter, IP extraction, window exhaustion, and automatic memory pruning. |
| **16** | `tests/video_streaming_layer.test.mjs` | Multi-provider video detection (HLS, Direct, Drive, Cloudflare) and HMAC token cryptographic security. |
| **17** | `tests/payments_layer_regression.test.mjs` | Click MD5 signatures, Payme basic auth, checkout generation, and subscription extension logic. |
| **18** | `tests/database_integrity_regression.test.mjs` | Verification of all 16+ migrations, foreign key cascades, and hardened search_paths. |

---

## 3. Running Test Suites

```bash
# Execute standard automated test battery
npm test

# Execute browser E2E tests (Headless Puppeteer)
npm run test:e2e:browser

# Execute live production verification checks
npm run test:live:verify
```
