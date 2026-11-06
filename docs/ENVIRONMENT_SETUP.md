# AniCity — Environment Setup & Local Development Guide

## 1. Prerequisites

Ensure your development machine has the following tools installed:
- **Node.js:** Version 20.x or higher (Node 24 LTS verified).
- **Git:** Version 2.30 or higher.
- **npm:** Included with Node.js.

---

## 2. Step-by-Step Local Setup

### Step 1: Clone the Repository
```bash
git clone https://github.com/shoxjahondev/yozora-app.git
cd yozora-app
```

### Step 2: Install Project Dependencies
```bash
npm install
```

### Step 3: Configure Environment Variables
Create a `.env.local` file in the root directory:
```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Site URL
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Video Streaming Cryptographic Secret
VIDEO_SIGNING_KEY=local-dev-stream-secret-key

# Payments (Click / Payme / Sandbox)
CLICK_SERVICE_ID=dummy-service
CLICK_MERCHANT_ID=dummy-merchant
CLICK_SECRET_KEY=dummy-click-secret
PAYME_MERCHANT_ID=dummy-payme-merchant
PAYME_SECRET_KEY=dummy-payme-secret
PAYMENTS_SANDBOX_SECRET=anicity-sandbox-secret
```

### Step 4: Run Automated Tests
Verify all 18 regression test suites pass before starting development:
```bash
npm test
```

### Step 5: Start the Local Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your web browser.

---

## 3. Database Migrations Workflow

Database migrations are stored sequentially in `supabase/migrations/`.
To apply migrations to your local or cloud Supabase instance:

```bash
# Using Supabase CLI
supabase db push
# or link and apply
supabase link --project-ref your-project-id
supabase db push
```
