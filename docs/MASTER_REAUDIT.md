# AniCity — Master Technical Re-Audit & Architectural Gap Analysis

## 1. Executive Summary

This document establishes the verified baseline of the AniCity (`yozora-app`) codebase as of **November 2026**.
Following an independent inspection of repository code, database schema, Vercel edge deployment configuration, video streaming pipelines, and payment architectures, every discrepancy between theoretical design and live production behavior has been isolated and recorded.

---

## 2. Identified Deficiencies & Architectural Gaps

| ID | Category | Severity | Affected Files | Root Cause | Required Correction | Verification Method |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| **AUD-01** | **DevOps / Vercel** | **P0 (Critical)** | Git Branching / Vercel | Vercel production alias `anicity-app.vercel.app` is linked to branch `feature/takeover-codex-integration` (commit `e296855`), while recent master upgrades were pushed only to `main` (`717e0bb`). | Synchronize `feature/takeover-codex-integration` with `main` and configure Vercel production to track `main`. | Probe `/api/payments/webhook` on `anicity-app.vercel.app` to confirm HTTP 200/405 instead of HTML 404. |
| **AUD-02** | **Security / Rate Limiting** | **P0 (Critical)** | `lib/rate-limit.js` | In-memory `Map` storage does not persist across Vercel serverless microVMs or instance restarts. Multi-instance requests bypass limits. | Implement Supabase PostgreSQL atomic token-bucket RPC (`public.check_rate_limit`) with fallback to local in-memory. | Multi-threaded curl test and unit tests verifying atomic DB counter increments. |
| **AUD-03** | **Payments (Click)** | **P0 (Critical)** | `lib/payments/provider.js`, `app/api/payments/webhook/route.js` | Click Merchant API mandates a 2-step protocol: `action=0` (Prepare) and `action=1` (Complete) with `{ error: 0, click_trans_id, merchant_prepare_id }` response schema. Existing code handles only single generic request. | Implement dedicated `click.js` protocol engine handling Prepare/Complete state transitions and standard response schemas. | Comprehensive automated protocol simulation test suite with valid/invalid MD5 signatures. |
| **AUD-04** | **Payments (Payme)** | **P0 (Critical)** | `lib/payments/provider.js`, `app/api/payments/webhook/route.js` | Payme Merchant API strictly enforces **JSON-RPC 2.0** (`CheckPerformTransaction`, `CreateTransaction`, `PerformTransaction`, `CancelTransaction`, `CheckTransaction`). Existing code used simple POST parsing. | Implement dedicated `payme.js` protocol engine compliant with JSON-RPC 2.0 error codes and state machine. | Automated JSON-RPC 2.0 test suite simulating full transaction lifecycle. |
| **AUD-05** | **Video Streaming (HLS)** | **P1 (High)** | `components/Player.js`, `package.json` | `components/Player.js` had no `hls.js` integration. Direct `<video>` playback of `.m3u8` playlists fails on Chrome, Firefox, and Windows Edge (works only on Apple Safari). | Install `hls.js`, detect `.m3u8`, bind adaptive HLS engine with fallback to native Safari, add quality switching controls. | Real playback test of an HLS `.m3u8` stream in both Chrome/Edge and Safari engines. |
| **AUD-06** | **Video Security (HMAC Tokens)** | **P1 (High)** | `lib/video/provider.js`, `app/watch/[animeId]/[num]/page.js` | HMAC playback tokens were generated and verified in isolation, but no server delivery endpoint or proxy verified tokens prior to stream delivery. | Implement `/api/video/stream-token` gateway validating resource ID, user entitlement, expiration, and signature. | Unit & integration tests asserting rejection of expired, forged, and untrusted token playback requests. |
| **AUD-07** | **Security (Image Optimization SSRF)** | **P1 (High)** | `next.config.mjs` | `images.remotePatterns` contained `hostname: '**'`, allowing arbitrary external domain optimization and exposing server to SSRF. | Restrict `remotePatterns` to explicit trusted CDN and image hosts (Supabase Storage, Google Drive, Unsplash, Anime CDNs). | Next.js build verification and image component validation test. |
| **AUD-08** | **Video Player Architecture** | **P2 (Medium)** | `components/Player.js` | Oversized 1,000-line monolith component containing mixed iframe logic, direct video controllers, speed menus, and hotkey listeners. | Modularize reusable player subcomponents under `components/player/` while preserving the exact backwards-compatible `components/Player.js` facade. | Regression suite ensuring all 28 original assertions and fullscreen tests pass. |

---

## 3. Verified Current Baselines

- **Local Tests:** 18 automated test suites passing locally (`npm test`).
- **Production Build:** Turbopack builds cleanly with 0 errors (`npm run build`).
- **Database Status:** Production Supabase project `lngeosburovsxotywbfw` and staging project `dvuhwemkciebqufqanji` have all 16 migrations applied with RLS active.
- **Content Alignment:** Both `anicity-app.vercel.app` and `yozora-app.vercel.app` display "Code Geass: Qo‘zg‘olonchi Lelush" as confirmed by live scraper inspection.
