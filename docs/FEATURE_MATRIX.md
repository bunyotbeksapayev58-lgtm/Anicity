# AniCity — Complete Feature Matrix & Operational Status

**Author:** AniCity Principal Systems Architect & Product Lead  
**Date:** November 2026  
**Status:** COMPLETE & VERIFIED  
**Scope:** Complete Functional & Architectural Feature Inventory

---

## 1. Feature Matrix Overview

This matrix provides a transparent, evidence-based status of every subsystem, user-facing feature, administrative tool, and backend protocol in AniCity.

### Status Definitions:
- **FULLY IMPLEMENTED & LOCALLY VERIFIED:** Production-ready code, tested and confirmed in the automated test suite with exit code 0.
- **PARTIALLY VERIFIED (PENDING CREDENTIALS):** Protocol implementation is 100% complete and passes all mock protocol specifications, but requires live merchant API credentials from external vendors for live debit tests.
- **READY FOR MIGRATION:** Database migration script is written, hardened, and verified, awaiting execution in the live database upon owner approval.

---

## 2. Comprehensive Subsystem Matrix

| Subsystem / Feature | Description | Implementation File(s) | Verifying Test Suite | Status |
| :--- | :--- | :--- | :--- | :---: |
| **Catalog Browsing** | Filter by genre, format, status, year with responsive grid | `app/catalog/page.js` | `stitch_ui_integration.test.mjs` | **FULLY IMPLEMENTED** |
| **Anime Detail Showcase** | Two-column cinematic view with rating, synopsis, episodes | `app/anime/[id]/page.js` | `anicity.test.mjs` | **FULLY IMPLEMENTED** |
| **Episode Streaming** | Responsive player page with previous/next episode navigation | `app/watch/[animeId]/[num]/page.js` | `ux_media_standards_regression.test.mjs` | **FULLY IMPLEMENTED** |
| **HLS Adaptive Streaming** | Auto-bitrate manifest streaming via Hls.js with error recovery | `components/Player.js` | `hls_and_playback_token.test.mjs` | **FULLY IMPLEMENTED** |
| **Google Drive Streaming** | Normalized `/preview` embed with pop-out guard & iframe sandbox | `components/Player.js` | `mobile_player_fix_regression.test.mjs` | **FULLY IMPLEMENTED** |
| **Direct MP4 Streaming** | Native HTML5 video with playsInline hardware acceleration | `components/Player.js` | `video_streaming_layer.test.mjs` | **FULLY IMPLEMENTED** |
| **Cloudflare Stream** | UID resolution and signed player token support | `components/Player.js`, `lib/video/secure-delivery.js` | `secure_video_delivery.test.mjs` | **FULLY IMPLEMENTED** |
| **Delivery Token Signing** | HMAC-SHA256 playback token with user/episode binding | `lib/video/secure-delivery.js`, `app/api/video/token/route.js` | `secure_video_delivery.test.mjs` | **FULLY IMPLEMENTED** |
| **User Authentication** | Email/password sign-up, sign-in, session persistence | `components/AuthForm.js`, `app/login/page.js` | `ux_media_standards_regression.test.mjs` | **FULLY IMPLEMENTED** |
| **Password Recovery** | Forgot password, reset link email flow & password update | `app/forgot-password/page.js`, `app/reset-password/page.js` | `anicity.test.mjs` | **FULLY IMPLEMENTED** |
| **User Profile Management** | Dynamic stats, display name, bio, and avatar file upload | `components/ProfileView.js`, `components/ProfileEditModal.js` | `stitch_ui_integration.test.mjs` | **FULLY IMPLEMENTED** |
| **Avatar File Security** | Size $< 2\,\text{MB}$, MIME whitelist, orphaned asset cleanup | `app/actions/profile.js` | `avatar_security.test.mjs` | **FULLY IMPLEMENTED** |
| **Favorites System** | One-click bookmarking of anime titles with dedicated grid | `app/favorites/page.js`, `app/actions/favorites.js` | `anicity.test.mjs` | **FULLY IMPLEMENTED** |
| **Watch Progress Tracking** | Automatically records timestamp & marks episode completion | `app/api/progress/route.js` | `anicity.test.mjs` | **FULLY IMPLEMENTED** |
| **VIP Monetization Engine** | 1, 3, 12 month subscription tiers with auto-extension | `lib/subscription.js`, `app/subscription/page.js` | `payments_layer_regression.test.mjs` | **FULLY IMPLEMENTED** |
| **Manual VIP Grants** | Admin customer support tool with reason logging | `app/actions/admin.js` | `subscription_grant_regression.test.mjs` | **FULLY IMPLEMENTED** |
| **Financial Audit Logs** | Immutable administrative audit trail for VIP changes | `supabase/migrations/012_subscription_audit_logs.sql` | `subscription_grant_regression.test.mjs` | **FULLY IMPLEMENTED** |
| **Admin Dashboard** | Full catalog, episode, user, role & subscription management | `app/admin/page.js`, `app/actions/admin.js` | `security_blocker_investigation.test.mjs` | **FULLY IMPLEMENTED** |
| **Assistant Workspace** | Granular catalog editing without billing access | `app/assistant-admin/page.js` | `assistant_security_fixes.test.mjs` | **FULLY IMPLEMENTED** |
| **Server-Side RBAC** | `assertAdmin()` protects all privileged actions | `lib/admin-access.js` | `security_blocker_investigation.test.mjs` | **FULLY IMPLEMENTED** |
| **In-Memory Rate Limiting** | Sliding window rate limiter tracking client IP | `lib/rate-limit.js` | `rate_limit_regression.test.mjs` | **FULLY IMPLEMENTED** |
| **Distributed Rate Limiting** | PostgreSQL atomic row lock RPC with failover | `supabase/migrations/017_distributed_rate_limiting.sql` | `rate_limit_regression.test.mjs` | **READY FOR MIGRATION** |
| **Click Webhook Lifecycle** | 2-phase Prepare & Complete MD5 signed webhook handler | `app/api/payments/webhook/route.js` | `click_payme_protocol.test.mjs` | **PARTIALLY VERIFIED** |
| **Payme JSON-RPC 2.0** | Full state machine with Basic Auth & error codes | `app/api/payments/webhook/route.js` | `click_payme_protocol.test.mjs` | **PARTIALLY VERIFIED** |
| **Dynamic XML Sitemap** | Next.js sitemap endpoint indexing up to 500 published animes | `app/sitemap.js` | `production_readiness_fixes.test.mjs` | **FULLY IMPLEMENTED** |
| **Robots Directives** | Disallows private admin/profile/auth/api paths | `app/robots.js` | `production_readiness_fixes.test.mjs` | **FULLY IMPLEMENTED** |
| **OpenGraph & Schema.org** | Dynamic TVSeries JSON-LD structured data on anime pages | `app/anime/[id]/page.js` | `production_readiness_fixes.test.mjs` | **FULLY IMPLEMENTED** |
| **Mobile 360px Topbar** | `flex-wrap: nowrap !important` preventing mobile header wrap | `app/globals.css`, `components/Navbar.js` | `mobile_player_fix_regression.test.mjs` | **FULLY IMPLEMENTED** |
| **Player Shortcuts** | Space, K, arrows, F, M hotkeys + volume localStorage | `components/Player.js` | `ux_media_standards_regression.test.mjs` | **FULLY IMPLEMENTED** |
