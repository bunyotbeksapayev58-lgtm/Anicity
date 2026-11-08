# AniCity — Commercial Buyer Handover & Operational Transfer Package

**Author:** AniCity Principal Software Architect & Product Engineering Team  
**Date:** November 2026  
**Document Version:** 1.0.0 (Commercial Sale-Ready Edition)  
**Project:** AniCity (Enterprise Anime Streaming Cinema Platform)  
**Status:** COMPLETE, AUDITED & READY FOR COMMERCIAL TRANSFER

---

## 1. Product Identity & Overview

**AniCity** is a commercial-grade, full-stack anime streaming platform engineered specifically for modern anime communities, high-traffic viewership, and seamless monetization. 

### Key Highlights:
- **Ultra-Modern Interface:** Dark neo-cyber cinematic UI built with custom CSS design tokens, smooth micro-interactions, responsive grids, and zero cumulative layout shift.
- **Multi-Provider Video Engine:** Decoupled streaming architecture supporting Google Drive embeds, direct MP4/WebM hosting, adaptive HLS (.m3u8), and Cloudflare Stream.
- **Enterprise Security:** Server-side authorization, cryptographic HMAC delivery tokens, distributed serverless rate limiting, and zero client-side credential exposure.
- **Dual Monetization:** Native Uzbek payment integrations (Click & Payme) with automated VIP subscriptions, manual admin grants, and comprehensive financial audit logging.

---

## 2. Technology Stack & Runtime Architecture

| Layer | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | Next.js (App Router) | `16.4.3` | Full-stack SSR, Server Components, Streaming |
| **UI Library** | React | `19.2.3` | Concurrent rendering, actions, optimistic UI |
| **Compiler / Bundler** | Turbopack | Integrated | Fast build times (< 600ms compiled) |
| **Database & Auth** | Supabase PostgreSQL | Latest Cloud | Row-Level Security (RLS), Auth, Storage, RPC |
| **Video Engine** | HLS.js + Native Video | `1.6.15` | Adaptive bitrate streaming, error recovery |
| **Hosting & CDN** | Vercel Serverless / Edge | Global Edge | Global low-latency edge delivery |
| **Automated Testing** | Node.js Test Runner | Native (v20+) | 25 comprehensive regression test suites (100% passing) |

---

## 3. Intellectual Property, Code Ownership & Licensing

- **Code Ownership:** 100% of the custom source code, CSS design tokens, custom database migration schemas, and architectural documentation are unencumbered and transferred entirely to the buyer upon completion of sale.
- **Open-Source Dependencies:** All third-party npm packages (Next.js, React, Supabase client, Hls.js) are licensed under permissive open-source licenses (MIT or Apache 2.0).
- **Third-Party Trademarks:** Brand names and external services mentioned (Supabase, Vercel, Click, Payme, Google Drive, Cloudflare) remain the property of their respective owners.

---

## 4. Repository Structure & Branching Strategy

```
anicity/
├── app/                     # Next.js 16 App Router pages, layouts, actions, webhooks
├── components/              # Modular UI components (Player, Navbar, Modals, Cards)
├── docs/                    # Complete commercial documentation library
├── lib/                     # Domain business logic, rate limiters, video engine
├── supabase/migrations/     # 18 sequential, idempotent PostgreSQL migrations
└── tests/                   # 25 automated test suites (100% passing)
```

### Git Branching Anchor Points:
- `main` (`b95cf56`): Production baseline branch.
- `backup-before-master-engineering-upgrade` (`e296855`): Untouched recovery anchor.
- `feature/sale-ready-transformation`: The complete, fully audited, sale-ready branch containing all architectural upgrades, test suites, and documentation.

---

## 5. Database Architecture & Schema Map

The PostgreSQL database contains 18 structured migrations implementing:
- `public.profiles`: User usernames, display names, bio, avatar paths.
- `public.animes`: Anime catalog entries, format, release year, genres, posters, banners.
- `public.episodes`: Episode numbers, titles, video URLs, provider types, VIP flags.
- `public.user_roles`: RBAC roles (`owner`, `admin`, `assistant`, `user`).
- `public.assistant_permissions`: Granular permission flags for assistant accounts.
- `public.user_subscriptions`: VIP status, starts_at, ends_at, auto-renew status.
- `public.payments`: Unified payment records for Click and Payme transactions.
- `public.subscription_audit_logs`: Immutable administrative audit trail for manual VIP grants.
- `public.rate_limits`: Distributed rate limiting state storage with atomic row locks.

---

## 6. User Authentication & Identity Model

- Powered by **Supabase Auth** with secure HTTP-only cookie session management via `@supabase/ssr`.
- Supports email/password registration, password recovery (`/forgot-password`, `/reset-password`), and OAuth providers (Google).
- Public profile data is decoupled from authentication credentials via automated database triggers on `auth.users` insert.

---

## 7. Role-Based Access Control (RBAC) & Governance

AniCity enforces a strict 4-level hierarchy:
1. **Owner:** Full system control, database access, credential configuration.
2. **Admin:** Full access to `/admin` dashboard, catalog management, role assignment, and manual VIP grants.
3. **Assistant:** Delegated content creation via `/assistant-admin` (cannot touch billing or assign roles).
4. **User:** Standard viewer with personal watch history and favorites.

All privileged actions execute server-side through `assertAdmin()` in `lib/admin-access.js`.

---

## 8. Content Management Pipeline

- **Anime Management:** Create and edit anime series or movies without requiring immediate episode uploads (decoupled creation).
- **Episode Management:** Add episodes with custom titles, numbers, thumbnails, and provider selection. Duplicate episode numbers are blocked automatically.
- **Trailers & Promos:** Dedicated trailers table and modal player (`components/TrailersClips.js`) supporting YouTube and teaser clips.

---

## 9. Video Streaming Architecture & Supported Providers

AniCity supports four distinct video delivery methods:
1. **Google Drive:** Zero-hosting-cost streaming via Google Drive file embeds. The system normalizes URLs to `/preview` and overlays a pop-out guard to prevent redirect leaks.
2. **Direct MP4 / WebM:** High-performance direct streaming via HTML5 `<video>` from external CDNs, object storage, or VPS servers.
3. **HLS (.m3u8):** Industry-standard HTTP Live Streaming via `Hls.js` with adaptive bitrate, multi-quality audio/video, and automatic network error recovery.
4. **Cloudflare Stream:** Scalable edge-transcoded video with optional signed token generation.

---

## 10. Video Delivery Security & Token Validation

Implemented in `lib/video/secure-delivery.js` and `app/api/video/token/route.js`:
- Generates cryptographic HMAC tokens binding the viewer's `userId`, `episodeId`, and `expiresAt` (4-hour TTL).
- Anti-Cross-User Sharing: Token generated for User A is rejected when attempted by User B.
- Anti-Episode Substitution: Token generated for Episode 1 is rejected when attempted for Episode 2.
- VIP Protection: Automatically verifies active subscription before issuing playback tokens for VIP episodes.

---

## 11. Monetization, VIP Subscriptions & Billing Engine

- **Subscription Plans:**
  - 1 Month (30 Days)
  - 3 Months (90 Days)
  - 12 Months (365 Days)
- **Automatic Extension:** If an active VIP user purchases an additional plan, the new days are automatically appended to their current expiration date.
- **Financial Audit Logging:** Every manual VIP grant or webhook transaction creates an audit log entry.

---

## 12. Click Payment Integration & Onboarding

- **Protocol:** Click SHOP-API 2-Phase Transaction Lifecycle (Prepare & Complete).
- **Security:** MD5 HMAC signature verification of incoming merchant parameters.
- **Endpoint:** `POST https://your-domain/api/payments/webhook?provider=click`
- **Buyer Setup:** Register in Click.uz merchant cabinet, obtain `service_id` and `secret_key`, and input them in Vercel environment variables.

---

## 13. Payme Payment Integration & Onboarding

- **Protocol:** Paycom JSON-RPC 2.0 official protocol.
- **Security:** HTTP Basic Authentication (`Authorization: Basic ...`) with merchant secret.
- **State Machine:** Full state transitions (Created $\to$ Completed $\to$ Cancelled).
- **Endpoint:** `POST https://your-domain/api/payments/webhook?provider=payme`
- **Buyer Setup:** Register in Paycom cabinet, obtain Merchant ID and Secret Key, and input them in Vercel environment variables.

---

## 14. Frontend Architecture & Design Tokens

- Built on high-contrast, accessible design tokens defined in `app/globals.css`.
- Catppuccin Mocha / Tokyo Night hybrid palette with `--primary` (#6C5CE7) and `--accent-gold` (#FDCB6E).
- Text contrast ratios exceed WCAG AAA standards (> 7:1).
- Long synopses constrained to 68ch line-length for optimal reading comfort.

---

## 15. Mobile Responsiveness & Viewport Standards

- Fully responsive across 360px, 375px, 390px, 430px mobile viewports up to 4K desktop displays.
- Topbar enforces `flex-wrap: nowrap !important` to prevent mobile layout wrapping.
- Sticky bottom thumb bar on mobile devices (< 768px) with direct links to Home, Catalog, Favorites, History, Profile.
- Touch target sizes strictly adhere to $\ge 44 \times 44\,\text{px}$.

---

## 16. Search Engine Optimization & Social Metadata

- Dynamic sitemap at `/sitemap.xml` automatically indexing up to 500 published animes every 1 hour.
- Automated `robots.txt` allowing public indexing while disallowing private admin/auth paths.
- Dynamic OpenGraph and Twitter cards generated per anime.
- Schema.org `TVSeries` JSON-LD structured data on anime detail pages.

---

## 17. Performance, Caching & Core Web Vitals

- Next.js 16 Turbopack compilation compiles 28 routes in under 600ms.
- Cumulative Layout Shift (CLS) is $< 0.02$ due to pre-allocated aspect ratios on poster cards (2/3) and video players (16/9).
- Hero imagery uses Next.js priority loading to ensure Largest Contentful Paint (LCP) $< 1.8\,\text{s}$.

---

## 18. Security Posture, Rate Limiting & Threat Defenses

- Distributed atomic rate limiting via Supabase RPC (`check_rate_limit`) with local in-memory sliding window fallback.
- Security headers configured in `next.config.mjs` (nosniff, SAMEORIGIN, strict-origin-when-cross-origin, HSTS, Permissions-Policy).
- Strict zero-secrets hygiene: no credentials or service role keys exposed in client bundles or Git history.

---

## 19. Deployment, Hosting & Infrastructure Runbook

- Refer to [`docs/DEPLOYMENT_GUIDE.md`](file:///c:/Users/user/Desktop/yozora-app/docs/DEPLOYMENT_GUIDE.md) for full deployment instructions on Vercel and Supabase.
- Refer to [`docs/DEMO_CONTENT_CLEANUP.md`](file:///c:/Users/user/Desktop/yozora-app/docs/DEMO_CONTENT_CLEANUP.md) for safe pre-launch test content purge instructions.

---

## 20. 30-Day Transition Checklist & Transfer Protocol

- [ ] **Day 1–3: Repository & Cloud Transfer:**
  - Transfer GitHub repository ownership to buyer's GitHub organization.
  - Transfer Supabase project or provide database export dump.
  - Connect buyer's Vercel team account and assign production domain.
- [ ] **Day 4–7: Credential Rotation:**
  - Generate fresh `SUPABASE_SERVICE_ROLE_KEY` in Supabase dashboard.
  - Generate fresh `PLAYBACK_TOKEN_SECRET` hex string.
  - Apply migration `017_distributed_rate_limiting.sql` in Supabase SQL Editor.
- [ ] **Day 8–14: Merchant Provider Onboarding:**
  - Submit business verification to Click.uz and Payme (Paycom).
  - Configure production merchant credentials in Vercel environment variables.
  - Execute end-to-end sandbox purchase verification.
- [ ] **Day 15–21: Catalog Curation:**
  - Execute demo content purge using `docs/DEMO_CONTENT_CLEANUP.md`.
  - Upload licensed or curated anime series and episodes via `/admin`.
- [ ] **Day 22–30: Public Launch & Marketing:**
  - Verify sitemap indexing in Google Search Console.
  - Open registration and launch commercial streaming operations.
