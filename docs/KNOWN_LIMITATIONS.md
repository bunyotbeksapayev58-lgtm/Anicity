# AniCity — Known Limitations & Architectural Boundaries

**Author:** AniCity Principal Software Architect & Application Security Engineer  
**Date:** November 2026  
**Status:** COMPLETE & TRANSPARENT  
**Purpose:** Honest Technical Due Diligence for Buyers, Investors, and DevOps Teams

---

## 1. Executive Summary

In strict accordance with AniCity's zero-false-claims directive, this document provides a comprehensive and transparent disclosure of all technical boundaries, architectural trade-offs, and external service requirements in the platform.

Understanding these boundaries ensures that operators and buyers make informed engineering decisions as traffic scales.

---

## 2. Video Delivery & Media Segment Protection

### The Boundary:
AniCity enforces strict server-side playback authorization (`validatePlaybackAccess()`) and signs HMAC-SHA256 playback tokens (`verifyDeliveryToken()`) before granting access to episode streams.

However, the level of protection depends directly on the video provider:

| Provider | Playback Gated by AniCity? | Media Bytes Encrypted / Signed at CDN? | Direct URL Sniffable via DevTools? |
| :--- | :---: | :---: | :---: |
| **Cloudflare Stream** | **YES** | **YES** (Signed edge tokens) | NO |
| **HLS via Signed CDN** | **YES** | **YES** (Signed manifest & chunks) | NO |
| **Direct MP4 / WebM** | **YES** | NO (Delivers raw byte stream) | **YES** (Inspect Network tab) |
| **Google Drive Embed** | **YES** | NO (Google manages byte delivery) | NO (Sandboxed iframe, but external) |

### Technical Reality:
- For **Google Drive**: The video streams within an iframe loaded directly from `drive.google.com`. AniCity protects the page and intercepts pop-outs with a transparent guard (`.ani-drive-popout-guard`), but Google Drive does not allow AniCity's HMAC keys to validate individual video chunks.
- For **Direct MP4**: The video is loaded via an HTML5 `<video src="...">` tag. Any user with browser developer tools can inspect the network request to discover the raw MP4 URL.
- **Enterprise Solution:** For 100% cryptographic byte-level protection, content owners should utilize Cloudflare Stream or Bunny.net Token Authentication (both supported by AniCity's multi-provider architecture).

---

## 3. Rate Limiting Across Serverless Instances

### The Boundary:
On serverless platforms like Vercel, requests are distributed across multiple independent container instances running in different edge locations.

### Technical Reality:
1. **In-Memory Rate Limiting:**
   - The in-memory sliding window limiter in `lib/rate-limit.js` tracks request timestamps inside the local memory of the specific Node.js process.
   - If an attacker sends 100 rapid requests that hit 10 different serverless instances, each instance only sees 10 requests. Therefore, in-memory rate limiting alone **cannot guarantee global rate limiting** under high multi-region concurrency.
2. **Distributed PostgreSQL Rate Limiting:**
   - To solve this, AniCity engineered `supabase/migrations/017_distributed_rate_limiting.sql` using an atomic PostgreSQL function (`check_rate_limit`) with `SELECT ... FOR UPDATE` row locks.
   - **Operational Requirement:** The distributed limiter requires applying migration 017 to the Supabase database. Until migration 017 is applied in production, the system automatically runs on local in-memory sliding window fallback.

---

## 4. Payment Gateway Live Sandboxes

### The Boundary:
AniCity includes complete implementations of:
- Click SHOP-API 2-Phase Lifecycle (Prepare & Complete with MD5 HMAC verification)
- Payme JSON-RPC 2.0 State Machine (with HTTP Basic Auth and transaction state tracking)

### Technical Reality:
- Both implementations pass 100% of automated mock protocol assertions (`tests/click_payme_protocol.test.mjs`).
- However, **live financial processing cannot be tested with real bank cards** until a registered business entity submits merchant applications to Click.uz and Payme (Paycom) and receives official merchant credentials.
- Status is accurately classified as **PARTIALLY VERIFIED** pending merchant onboarding.

---

## 5. Next.js Server Actions Upload Size Limits

### The Boundary:
In `next.config.mjs`, server action body size limit is set to:
```javascript
experimental: {
  serverActions: {
    bodySizeLimit: '50mb',
  },
}
```

### Technical Reality:
- This 50MB limit is optimal for high-resolution poster art, wide cinematic banners, and user avatar uploads.
- **Video Episodes (typically 200MB – 1.5GB):** Should NOT be uploaded through Next.js server actions. Serverless functions have execution timeout limits (15–60s) and memory caps.
- Video files should be uploaded directly to Google Drive, Cloudflare Stream, or an S3-compatible bucket via presigned upload URLs, and the resulting stream URL entered into AniCity's episode manager.

---

## 6. Supabase Connection Limits on Free Tier

### The Boundary:
Supabase Free tier projects include a limit of 60 direct PostgreSQL connections.

### Technical Reality:
- Serverless architectures can rapidly exhaust direct database connections if traffic spikes.
- **Recommendation:** Production deployments should configure `SUPABASE_URL` to connect through Supabase's integrated connection pooler (**Supavisor**, port 6543, Transaction mode) to support tens of thousands of concurrent viewers without pool exhaustion.
