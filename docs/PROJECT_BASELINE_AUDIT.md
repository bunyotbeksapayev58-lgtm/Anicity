# AniCity — Project Discovery & Baseline Audit

**Audit Date:** November 8, 2026  
**Auditor Organization:** Senior Software Engineering & Product Audit Team  
**Git Branch:** `feature/sale-ready-transformation`  
**Base Commit:** `991a92964171a599361944f60e67e01ddc51003c` (`991a929`)  
**Main Branch Commit:** `b95cf5623723288a4ee7b8dee8d1efd78bddbac9` (`b95cf56`)  
**Safety Backup Anchor:** `backup-before-master-engineering-upgrade` at `e2968553fb157f2b5a1ca71d0f2c27cde83fe1b5` (`e296855`)  

---

## 1. Executive Summary

AniCity (formerly Yozora) is a full-stack anime streaming platform built with Next.js 16.4.3 (Turbopack), React 19, and Supabase PostgreSQL. This baseline audit assesses the current state of the platform across architecture, code quality, database security, streaming capabilities, payment integrations, and operational readiness to determine sale readiness.

---

## 2. Technical Stack & Environment

| Layer | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Framework** | Next.js (App Router, Turbopack) | `16.4.3` | Full-stack SSR, Server Actions, API routes |
| **UI Library** | React / React DOM | `19.0.0` | Concurrent UI rendering |
| **Database** | PostgreSQL on Supabase | `15.x` | Primary relational datastore |
| **Auth** | Supabase Auth | `@supabase/ssr 0.5.2` | Stateless JWTs, Cookie-based session |
| **Video Engine** | `hls.js` + Native HTML5 | `1.7.4` | Adaptive bitrate HLS & direct MP4/WebM |
| **Payments** | Click & Payme Merchant Adapters | Custom | Regional payment processing in Uzbekistan |
| **Dev Tools** | Node.js Test Runner, Puppeteer Core | Node `24.x`, Puppeteer `25.x` | Automated regression and E2E testing |

---

## 3. Route & Component Architecture

Next.js Turbopack compiles **28 routes** (2 static, 26 dynamic):
- **Public & Discovery:** `/` (Home), `/catalog` (Catalog & Filters), `/anime/[id]` (Anime Details & Reviews), `/premium` (VIP Plans).
- **Video Watching:** `/watch/[animeId]/[num]` (Video Player, episode navigation, watch history tracking).
- **User Account:** `/login`, `/register`, `/forgot-password`, `/reset-password`, `/profile` (Profile settings, avatar upload), `/favorites`, `/history`.
- **Administrative:** `/admin` (Master owner/admin dashboard), `/admin/[id]/edit`, `/assistant-admin` (Scoped assistant admin dashboard), `/assistant-admin/[id]/edit`.
- **API Endpoints:**
  - `GET/POST /api/animes` — Public search & admin creation
  - `GET/PATCH/DELETE /api/animes/[id]` — Details & admin mutations
  - `GET/POST/DELETE /api/animes/[id]/favorite` — User favorites
  - `GET /api/favorites` — User favorite collection
  - `GET/POST /api/progress` — Watch progress tracking
  - `POST /api/payments/webhook` — Unified payment webhook (Click/Payme/Sandbox)
  - `POST/GET /api/video/token` — Server-side VIP verified playback token generation & validation
- **SEO & Indexing:** `/robots.txt` (Static), `/sitemap.xml` (Dynamic XML from published animes).

---

## 4. Current State of Platform Capabilities

### 4.1 What is Working & Verified (Local Environment):
1. **Full-Stack Build:** `npm run build` succeeds in ~1.4 seconds with 0 errors.
2. **Automated Test Suite:** 22 test suites with 100+ assertions pass 100% (`npm test`).
3. **Database Integrity:** 17 migrations (`001` to `017`), all 25 tables have Row Level Security (RLS) enabled, admin RPCs hardened with `SET search_path = pg_catalog, public, pg_temp`.
4. **Server-Side Authorization & RBAC:** Strict 5-tier role hierarchy (`owner`, `admin`, `assistant_admin`, `moderator`, `user`). All 23 admin Server Actions invoke `assertAdmin()`.
5. **Distributed Rate Limiting:** Hardened Migration 017 created (`public.rate_limits`, `check_rate_limit` RPC restricted exclusively to `service_role`), with in-memory fallback.
6. **Video Streaming:** Multi-provider abstraction (`lib/video/provider.js`), HLS adaptive bitrate with quality selector (`Auto`, `1080p`, `720p`, etc.), Google Drive `/preview` normalizer with click-hijack popout guard, and HMAC playback tokens with user/episode binding.
7. **Server-Side VIP Authorization:** `validatePlaybackAccess()` verifies active subscription and expiry before issuing tokens; never trusts client claims.
8. **Payment Protocols:** Click MD5 Prepare/Complete lifecycle and Payme JSON-RPC 2.0 state machine verified via mock tests.
9. **UI/UX & Mobile:** Dark neo-cyber anime theme, zero horizontal overflow on 360px viewports, responsive player aspect ratio.
10. **Zero Leaked Secrets:** No API keys, credentials, or service role keys exposed in client bundles or Git diff.

---

## 5. Identified Gaps, Limitations & Technical Debt

### 5.1 Payment Gateway Reality:
- **Limitation:** Click and Payme protocols are completely implemented and unit-tested against mock databases, but **neither has been executed against live merchant sandbox accounts** because merchant credentials (`CLICK_SERVICE_ID`, `PAYME_MERCHANT_ID`, etc.) have not been provided.
- **Classification:** `PARTIALLY VERIFIED (Code/Mock Verified; Real Sandbox Pending)`.

### 5.2 Video Delivery Cryptographic Reality:
- **Limitation:** For Google Drive and static MP4 files, byte delivery occurs directly between the client browser and Google/CDN servers. Google Drive does not validate AniCity HMAC tokens.
- **Classification:** `DOCUMENTED ARCHITECTURAL BOUNDARY`. Token verification is active on AniCity's API, but byte-level segment protection on third-party CDNs requires an edge proxy or signed CDN (Cloudflare Stream / Bunny.net).

### 5.3 Database Migration 017 Status:
- **Limitation:** Migration `017_distributed_rate_limiting.sql` is authored and hardened locally, but has **not yet been executed on the live production Supabase instance** (`lngeosburovsxotywbfw`) pending user execution.

### 5.4 Vercel Deployment Tracking:
- **Limitation:** Vercel production deployment was tracking branch `feature/takeover-codex-integration` (commit `e296855`). Local branches have been fast-forwarded to the upgrade commits, but **no push to GitHub remote has occurred** in compliance with safety instructions.

---

## 6. Baseline Audit Conclusion

AniCity possesses a solid, high-performance, and secure architectural foundation. It is clean, well-tested, and free of fatal flaws. To achieve true commercial sale readiness (10/10 standard), the project requires:
1. Complete, commercial-grade buyer handover documentation (`docs/BUYER_HANDOVER.md`, `docs/FEATURE_MATRIX.md`, `docs/DEPLOYMENT_GUIDE.md`).
2. A safe, reversible procedure to wipe demo content without breaking schema or user authentication (`docs/DEMO_CONTENT_CLEANUP.md`).
3. An audit of UI/UX, database security, performance, SEO, and reliability.
4. An honest, evidence-based final scoring matrix separating code readiness from operational/commercial handover readiness.
