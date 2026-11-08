# AniCity — Production & Local Deployment Guide

**Author:** AniCity DevOps Engineer & Systems Architect  
**Date:** November 2026  
**Status:** COMPLETE & VERIFIED  
**Target Environments:** Local Workstation (Node.js 20+) | Vercel Serverless | Supabase PostgreSQL

---

## 1. Local Development Setup

### 1.1 Prerequisites
- **Node.js:** Version 20.x or higher (LTS recommended)
- **Package Manager:** `npm` (version 10+)
- **Git:** Version 2.40+

### 1.2 Installation Steps
1. Clone the repository and navigate into the project root:
   ```bash
   cd yozora-app
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create your local environment configuration file:
   ```bash
   cp .env.example .env.local
   ```
4. Fill in your development Supabase credentials in `.env.local` (see Section 3 below).
5. Run the automated test suite to ensure local integrity:
   ```bash
   npm test
   ```
6. Start the local Next.js development server:
   ```bash
   npm run dev
   ```
7. Open `http://localhost:3000` in your web browser.

---

## 2. Supabase Database & Storage Setup

AniCity relies on Supabase PostgreSQL for authentication, database storage, and file storage.

### 2.1 Applying Database Migrations
Migrations must be executed in sequential order inside the **Supabase Dashboard -> SQL Editor**:

1. `001_initial_schema.sql` — Profiles, animes, episodes, roles, favorites, watch progress.
2. `002_user_roles.sql` — RBAC schema and role enforcement.
3. `003_storage_policies.sql` — Public read and authenticated upload policies for storage.
4. `004_fix_anime_and_roles.sql` — Foreign keys and indexing optimizations.
5. `005_audit_and_cleanup.sql` — Database consistency triggers.
6. `006_fix_roles_and_subscriptions.sql` — User subscriptions schema.
7. `007_episodes_storage.sql` — Episode storage buckets.
8. `008_trailers.sql` — Video trailers and promo clips.
9. `009_billing_and_payment_methods.sql` — Multi-gateway payment structure.
10. `010_payment_transactions.sql` — Click and Payme transaction schemas.
11. `011_user_profiles_patch.sql` — Bio, banner, and profile fields.
12. `012_subscription_audit_logs.sql` — Financial audit trail.
13. `013_user_roles_expansion.sql` — Assistant role support.
14. `014_assistant_permissions.sql` — Granular permission checkboxes.
15. `015_performance_indexes.sql` — Composite indexes for catalog and search.
16. `016_storage_cleanup_policy.sql` — Storage deletion permissions.
17. `017_distributed_rate_limiting.sql` — Atomic serverless rate limiter RPC.
18. `018_video_delivery_tokens.sql` — Playback tokens and delivery configuration.

### 2.2 Storage Buckets Configuration
Ensure the following storage buckets exist under **Storage -> Buckets**:
- `posters` (Public: ON) — Anime cover art images.
- `banners` (Public: ON) — Wide cinematic hero backdrops.
- `avatars` (Public: ON) — User profile pictures.
- `videos` (Public: OFF / Protected) — Direct video files (if self-hosting media).

### 2.3 Supabase Authentication Configuration
Under **Authentication -> URL Configuration**:
- **Site URL:** Set to your production URL (e.g., `https://anicity.uz` or `https://anicity-app.vercel.app`).
- **Redirect URLs:** Add:
  - `http://localhost:3000/auth/callback` (for local development)
  - `https://your-domain.vercel.app/auth/callback` (for production)

---

## 3. Environment Variables Reference

Configure these environment variables in your Vercel Project Settings (**Settings -> Environment Variables**):

| Variable Name | Environment | Description | Example / Note |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Production & Preview | Supabase project API URL | `https://xyz.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production & Preview | Supabase public anonymous key | `eyJhbGci...` |
| `NEXT_PUBLIC_SITE_URL` | Production & Preview | Canonical production URL | `https://anicity-app.vercel.app` |
| `SUPABASE_SERVICE_ROLE_KEY` | Production Only | High-privilege backend key | Required for admin actions & rate limit RPC |
| `CLICK_SERVICE_ID` | Production & Preview | Click merchant service identifier | Provided by Click.uz merchant cabinet |
| `CLICK_MERCHANT_ID` | Production & Preview | Click merchant user identifier | Provided by Click.uz merchant cabinet |
| `CLICK_SECRET_KEY` | Production Only | Click MD5 HMAC secret | Used to verify incoming payment webhooks |
| `PAYME_MERCHANT_ID` | Production & Preview | Payme merchant business ID | Provided by Paycom cabinet |
| `PAYME_SECRET_KEY` | Production Only | Payme HTTP Basic Auth password | Used to authorize JSON-RPC 2.0 calls |
| `PLAYBACK_TOKEN_SECRET` | Production Only | Cryptographic secret for video tokens | High-entropy random 64-char hex string |

---

## 4. Vercel Production Deployment Procedure

1. **Connect Repository:**
   - In the Vercel dashboard, click **"Add New... -> Project"**.
   - Select your AniCity GitHub repository.
2. **Build & Output Settings:**
   - **Framework Preset:** Next.js (Auto-detected).
   - **Root Directory:** `./` (Default).
   - **Build Command:** `next build` (or default).
   - **Output Directory:** `.next` (Default).
3. **Add Environment Variables:**
   - Input all variables from Section 3 above.
4. **Deploy:**
   - Click **Deploy**. Vercel will build the 28 routes and deploy the edge application globally.
5. **Assign Custom Domain:**
   - Navigate to **Project Settings -> Domains**.
   - Add your custom commercial domain (e.g., `anicity.uz`).
   - Configure DNS A / CNAME records as instructed by Vercel.

---

## 5. Webhook Integration Configuration

Once your production domain is active, provide these endpoints to your payment provider dashboards:

- **Click Webhook Endpoint:**
  ```
  https://your-domain.vercel.app/api/payments/webhook?provider=click
  ```
- **Payme Webhook Endpoint:**
  ```
  https://your-domain.vercel.app/api/payments/webhook?provider=payme
  ```

---

## 6. Post-Deployment Smoke Test Checklist

- [ ] **Home Page:** Loads hero carousel and trending rails without layout shift.
- [ ] **User Registration:** Create a new test user account via `/register`.
- [ ] **User Login:** Authenticate via `/login` and verify session persistence.
- [ ] **Profile Edit:** Upload a custom avatar and update bio in `/profile`.
- [ ] **Video Playback:** Open a free episode in `/watch/[animeId]/[num]` and verify video stream mounts.
- [ ] **Admin Gating:** Attempt to navigate to `/admin` as a standard user — verify immediate redirect to home or login.
- [ ] **Admin Dashboard:** Sign in with an `admin` or `owner` account and verify catalog operations.
- [ ] **Robots & Sitemap:** Verify `https://your-domain.vercel.app/robots.txt` and `https://your-domain.vercel.app/sitemap.xml` return valid HTTP 200 responses.
