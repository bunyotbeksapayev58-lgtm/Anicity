# AniCity — Deployment & Production Operations Guide

## 1. Hosting Architecture & Prerequisites

AniCity is configured for continuous zero-downtime deployment on **Vercel** connected to a **Supabase PostgreSQL** instance.

### System Prerequisites
- **Node.js:** Runtime 20.x or higher (Active LTS: Node 24 verified).
- **Package Manager:** `npm` (with `package-lock.json` lockfile integrity).
- **Vercel Account:** Team or Personal tier with Next.js Turbopack support.
- **Supabase Project:** Configured with migrations `001` through `016`.

---

## 2. Environment Variables Checklist

The following variables must be configured in Vercel Project Settings (`Settings -> Environment Variables`):

| Variable | Scope | Description |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Production & Preview | Supabase project REST API endpoint |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production & Preview | Supabase public anonymous access key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Production Server Only** | Secret administrative key (never expose to client) |
| `NEXT_PUBLIC_SITE_URL` | Production | Primary domain (e.g. `https://anicity-app.vercel.app`) |
| `VIDEO_SIGNING_KEY` | Production Server Only | HMAC key for signing time-bound video tokens |
| `CLICK_SERVICE_ID` | Production Server Only | Click merchant service ID |
| `CLICK_MERCHANT_ID` | Production Server Only | Click merchant ID |
| `CLICK_SECRET_KEY` | Production Server Only | Click merchant secret key |
| `PAYME_MERCHANT_ID` | Production Server Only | Payme merchant ID |
| `PAYME_SECRET_KEY` | Production Server Only | Payme merchant secret key |

---

## 3. Deployment Pipeline

### Automated Git Deployments
1. Any commit pushed to `main` on GitHub triggers an automatic Vercel production build.
2. Branches or Pull Requests trigger isolated Vercel Preview Deployments.

### Local Verification Before Deploying
Always execute local regression tests and a Turbopack production build prior to pushing commits:
```bash
# 1. Run all 18 automated regression test suites
npm test

# 2. Verify Turbopack production build
npm run build
```

---

## 4. Google OAuth 2.0 Production Alignment

For Google Authentication to function properly in production:
1. Navigate to **Google Cloud Console -> APIs & Services -> Credentials**.
2. Select your OAuth 2.0 Web Client.
3. Verify **Authorized JavaScript Origins**:
   - `https://anicity-app.vercel.app`
   - `https://yozora-app.vercel.app`
   - `https://lngeosburovsxotywbfw.supabase.co`
4. Verify **Authorized Redirect URIs**:
   - `https://lngeosburovsxotywbfw.supabase.co/auth/v1/callback`
   - `https://dvuhwemkciebqufqanji.supabase.co/auth/v1/callback`

---

## 5. Rollback Procedures & Health Checks

In the event of an incident or deployment error:
1. **Instant Rollback:** In the Vercel dashboard, navigate to `Deployments`, select the previous healthy deployment, and click `Promote to Production`. Rollbacks occur in under 2 seconds without rebuilding.
2. **Health Check Endpoints:**
   - Homepage: `GET /` -> Returns HTTP 200 OK
   - API Catalog: `GET /api/animes` -> Returns HTTP 200 with JSON payload
   - Robots: `GET /robots.txt` -> Returns HTTP 200
   - Sitemap: `GET /sitemap.xml` -> Returns HTTP 200
