# ANICITY — COMPREHENSIVE TECHNICAL & ARCHITECTURAL AUDIT
**Date:** 2026-11-06  
**Auditor:** Principal Software Architect & Application Security Engineer  
**Project:** AniCity Anime Streaming Web Platform (`yozora-app`)  
**Target Environment:** Production Ready (Next.js 16 App Router, React 19, Supabase PostgreSQL, Vercel)

---

## 1. Executive Summary

This comprehensive audit evaluates AniCity across 14 architectural dimensions: Architecture, Code Quality, UI/UX, Mobile Responsiveness, Security, Database Integrity, Video Streaming, VIP/Payments, Admin Dashboard, Performance, SEO, Reliability, Testing, and Commercial Readiness.

The codebase possesses solid fundamental security in Supabase RLS and server actions, but exhibits key architectural debt from rapid iterative growth:
- Monolithic files (`app/globals.css` at 7,858 lines, `components/Player.js` at 993 lines, `app/admin/page.js` at 645 lines).
- Provider coupling in video playback (Google Drive iframe fallback model vs. adaptive HLS streaming).
- Manual Telegram checkout for VIP subscriptions rather than a provider-independent transactional webhook system.
- Absence of application-level rate limiting on authentication and mutation endpoints.

---

## 2. Findings by Severity Matrix

| ID | Category | Issue Description | Severity | Impact |
| :--- | :--- | :--- | :---: | :--- |
| **SEC-01** | Security / DoS | No application-level rate limiting on `/login`, `/register`, `/forgot-password`, `/api/*` | **P1 (High)** | Vulnerable to credential stuffing and automated abuse |
| **VID-01** | Architecture / Video | Video player tightly coupled to Google Drive & direct MP4 without HLS/CDN provider abstraction | **P1 (High)** | Commercial streaming unviable with Google Drive rate limits |
| **PAY-01** | VIP / Billing | VIP checkout relies on manual Telegram links without transactional webhook handling | **P1 (High)** | Commercial revenue automation missing |
| **MOD-01** | Maintainability | `components/Player.js` is 993 lines combining controls, progress, iframe guards, and hotkeys | **P2 (Medium)** | High regression risk during player updates |
| **MOD-02** | Maintainability | `app/globals.css` is 7,858 lines with redundant declarations and mixed concern styles | **P2 (Medium)** | Slower dev cycle, increased style collision risk |
| **MOD-03** | Maintainability | `app/admin/page.js` is 645 lines with monolithic rendering of 7 different admin tabs | **P2 (Medium)** | Complex state management, difficult to scale |
| **DB-01** | Database / Integrity | `public.banners` has no default active record on fresh database seed | **P3 (Low)** | Hero banner falls back to first anime, which is safe but unconfigured |
| **PERF-01** | Performance | High volume of uncompressed SVG icons duplicated across client components | **P3 (Low)** | Minor bundle weight inflation |
| **ACC-01** | Accessibility | Video player progress scrub bar needs ARIA value-now / value-max semantics | **P2 (Medium)** | Screen reader usability in custom player |
| **SEO-01** | SEO | Missing JSON-LD structured schema for VideoObject and TVSeries | **P3 (Low)** | Sub-optimal Google rich snippets |

---

## 3. Deep Architectural Breakdown

### 3.1. Security & Authentication Audit
- **Authentication:** Powered by Supabase Auth with PKCE and session cookie synchronization in `proxy.js` and `lib/supabase/server.js`.
- **RBAC:** Enforced server-side via `lib/admin-access.js` (`authorizeAdminOperation` and `requireMainAdmin`) and database RLS. Roles: `user`, `moderator`, `assistant_admin`, `admin`, `owner`.
- **RLS Status:** All 24 PostgreSQL tables have `rls_enabled: true`.
- **Search Path:** Hardened across all migrations (`011`–`016`) with `SET search_path = public, pg_temp;`.
- **Input Sanitization:** Parameterized database queries via PostgREST; ASCII control characters stripped in profile updates; Open Redirect protected in `auth.js`.
- **Headers:** HSTS, X-Frame-Options (`SAMEORIGIN`), X-Content-Type-Options (`nosniff`), X-XSS-Protection, Referrer-Policy, and Permissions-Policy configured in `next.config.mjs`.
- **Remaining P1 Security Item:** In-memory + distributed rate limiting for auth endpoints and mutation routes.

### 3.2. Video Delivery Architecture
- **Current State:** Supports Google Drive preview embed (`/preview`) and native HTML5 video for direct MP4/WebM files.
- **Limitation:** Google Drive throttles concurrent streaming requests across multiple users with "Playback limit reached / 403 Forbidden" errors.
- **Architectural Target:** Create a provider-agnostic streaming engine (`lib/video/`) capable of switching between Google Drive, Direct HLS (`.m3u8`), Cloudflare Stream, Mux, or custom S3/MinIO CDN storage with short-lived playback token authorization.

### 3.3. VIP & Payment Architecture
- **Current State:** Subscription schema exists (`subscription_plans`, `user_subscriptions`, `subscription_audit_logs`). VIP expiration calculation and active checks are verified.
- **Limitation:** User checkout is redirected to Telegram (`https://t.me/anicity_admin?text=...`) where admins manually invoke `admin_grant_user_subscription`.
- **Architectural Target:** Provider-independent payment layer (`lib/payments/`) supporting signature verification, idempotency tokens, transaction recording, and automated status webhooks.

### 3.4. Code Organization & Modularity
- **Player Modularization:** Refactor `components/Player.js` into focused sub-modules:
  1. `components/player/PlayerContainer.js`
  2. `components/player/PlayerControls.js`
  3. `components/player/PlayerProgressBar.js`
  4. `components/player/PlayerDriveIframe.js`
  5. `components/player/PlayerNativeVideo.js`
  6. `components/player/PlayerSpeedMenu.js`
  7. `components/player/PlayerErrorState.js`
  8. `components/player/usePlayerHotkeys.js`
  9. `components/player/useFullscreenToggle.js`
  10. `components/player/useVolumePersistence.js`
  With `components/Player.js` acting as the zero-breaking-change orchestrator.
- **CSS Modularization:** Partition `app/globals.css` into logical modular partials under `styles/` preserving 100% of existing visual design.
- **Admin Modularization:** Partition `app/admin/page.js` into modular tab components under `app/admin/components/`.

---

## 4. Remediation Plan & Execution Phasing

1. **Phase B — Security Hardening:**
   - Implement universal Rate Limiting middleware & helper (`lib/rate-limit.js`).
   - Wire rate limiter to login, registration, password recovery, search, and API routes.
2. **Phase C — Architecture & Code Quality:**
   - Modularize `components/Player.js` into `components/player/*` sub-modules.
   - Modularize `app/globals.css` into organized `styles/*` modules imported into `globals.css`.
   - Modularize `app/admin/page.js` into clean tab components.
3. **Phase D — Database Integrity & Verification:**
   - Verify table constraints, foreign key indexes, and RLS policies across all 24 tables.
   - Ensure clean initial seed state for banners and active items.
4. **Phase E — Premium UI/UX & Mobile Hardening:**
   - Verify responsive viewports (320px–768px), touch targets, and ARIA attributes.
   - Add player progress bar ARIA attributes (`aria-valuenow`, `aria-valuemin`, `aria-valuemax`).
5. **Phase F — Professional Video Streaming Layer:**
   - Create `lib/video/provider.js` abstraction (HLS, Cloudflare Stream, Mux, Drive).
   - Implement quality level negotiation and playback token validation interface.
6. **Phase G — VIP & Payment System:**
   - Create `lib/payments/provider.js` with Click, Payme, Stripe, and Sandbox adapters.
   - Implement `/api/payments/webhook` with signature verification and idempotency locks.
7. **Phase H — Admin Dashboard Refinement:**
   - Enhance filtering, pagination, and audit log inspection.
8. **Phase I — Performance & SEO:**
   - Add JSON-LD VideoObject and TVSeries metadata to `/anime/[id]` and `/watch/[animeId]/[num]`.
   - Verify Turbopack build optimization.
9. **Phase J — Comprehensive Testing & Master Documentation:**
   - Run all existing 14 test suites and add new test suites for rate limiting, video provider, and payment webhooks.
   - Generate all 12 master documentation files under `docs/`.
