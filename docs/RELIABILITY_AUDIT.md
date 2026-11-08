# AniCity — System Reliability & Fault Tolerance Audit

**Author:** AniCity Principal Reliability Engineer & Systems Architect  
**Date:** November 2026  
**Status:** COMPLETE & VERIFIED  
**Architecture:** Next.js Serverless + Supabase PostgreSQL + Multi-Provider Streaming

---

## 1. Executive Summary

This audit evaluates AniCity's resilience to external failures, network interruptions, database outages, concurrency races, and unexpected user input. AniCity incorporates multi-tier defensive engineering to ensure that temporary infrastructure hiccups do not cause catastrophic platform failure or permanent data corruption.

---

## 2. Multi-Tier Error Boundaries & UI Degradation

### 2.1 React Error Boundaries (`app/error.js`)
- Catches uncaught runtime exceptions in client components.
- Displays an accessible error screen with an localized explanation ("Xatolik yuz berdi") and a recovery button calling `reset()` to re-mount the component subtree without forcing a full page reload.

### 2.2 Not Found & Routing Guards (`app/_not-found.js` & `notFound()`)
- Handled via Next.js standard `notFound()` when querying non-existent anime IDs or out-of-range episode numbers (`app/anime/[id]/page.js`, `app/watch/[animeId]/[num]/page.js`).
- Renders an informative 404 page styled with AniCity's dark neo-cyber aesthetic with a single-click button back to `/catalog` or `/`.

### 2.3 Server Component Null Safety & React #441 Prevention
- Database queries across all Server Components use `.maybeSingle()` or safe array fallbacks (`data || []`).
- Null checks precede all property accesses (e.g. `episodes?.map(...)`, `user ? (...) : null`).
- Verified by automated regression test `tests/anicity.test.mjs` (Check 18: Server Component Null-Safety & React #441 Prevention).

---

## 3. Database Outage & Rate Limiter Failover Resiliency

A common vulnerability in serverless applications is hard-coupling every API request to an external database RPC. If the database experiences high latency or brief downtime, the entire application crashes.

### The AniCity Distributed Rate Limiting Failover Pattern:
In `lib/rate-limit.js`, `checkDistributedRateLimit(key, options)` implements a resilient fail-safe architecture:

```
[ Incoming Request ]
         │
         ▼
[ Attempt Supabase RPC: check_rate_limit ]
         │
    ┌────┴───────────────────────────┐
    │ Success                        │ Network Error / DB Timeout
    ▼                                ▼
[ Return Distributed Result ]    [ Fallback to Local In-Memory Sliding Window ]
                                     │
                                     ▼
                                 [ Return Safe Fallback Result (Log Warning) ]
```

### Key Reliability Safeguards:
1. **Never Hard Crash:** A database timeout returns `{ allowed: true, remaining: ..., fallback: true }` or enforces local in-memory limit.
2. **Atomic Row Locks:** The SQL RPC `check_rate_limit` in `017_distributed_rate_limiting.sql` locks the bucket with `SELECT ... FOR UPDATE`, eliminating race conditions between concurrent serverless invocations.
3. **Opportunistic Garbage Collection:** Every 20 requests (~5% probability), the function executes:
   ```sql
   DELETE FROM public.rate_limit_buckets WHERE expires_at < now();
   ```
   This prevents database table bloat without requiring an external cron job daemon.

---

## 4. Video Streaming Fault Tolerance & Player Recovery

Video playback is the core customer experience. AniCity's player (`components/Player.js`) implements specific recovery workflows for each provider:

### 4.1 HLS.js Error Recovery State Machine
When streaming adaptive HLS manifests:
- **Network Errors (`Hls.ErrorTypes.NETWORK_ERROR`):**
  - Triggers `hls.startLoad()` to retry chunk downloading during mobile network switches (e.g., 4G to Wi-Fi).
- **Media Decoding Errors (`Hls.ErrorTypes.MEDIA_ERROR`):**
  - Triggers `hls.recoverMediaError()` to re-initialize hardware decoders without dropping the player session.
- **Fatal Unrecoverable Errors:**
  - Cleans up and destroys the HLS instance (`hls.destroy()`), falling back to direct video stream if available.

### 4.2 Google Drive Embedded Iframe Resilience
- **Pop-out Guard:** Transparent overlay intercepts clicks on the native "Pop-out" icon, preventing external redirect navigation.
- **Interactive Quick-Reload:** An integrated reload button (`ani-drive-reload-overlay-btn`) updates `iframeKey = Date.now()`. This re-mounts the iframe sandbox cleanly if Google Drive serves a temporary rate-limit or cookie notice.
- **Mobile Direct Stream Fallback:** Mobile devices that block third-party iframe cookies automatically fall back to native `<video playsInline controls>`.

---

## 5. Payment Gateway Concurrency & Idempotency Safeguards

### 5.1 Click Gateway (`app/api/payments/webhook/route.js`)
- **Two-Step State Lock:**
  - `action = 0` (Prepare): Validates amount, user existence, and verifies the transaction does not already exist in completed status. Returns `error = 0`.
  - `action = 1` (Complete): Enforces that the payment was previously prepared and has not been marked as `error_note`. If Click retries the same `click_trans_id`, AniCity recognizes the completed transaction and returns idempotently without double-crediting VIP days.

### 5.2 Payme Gateway (JSON-RPC 2.0)
- **State Machine Transitions:**
  - `CreateTransaction`: State transitions from non-existent to State `1` (Created). Sets a 12-hour timeout.
  - `PerformTransaction`: Transitions from State `1` to State `2` (Completed) only if within the timeout window. Idempotent on retries.
  - `CancelTransaction`: Transitions to State `-1` (Cancelled before complete) or State `-2` (Cancelled after complete), revoking VIP days if already credited.

---

## 6. Storage & Orphaned Asset Garbage Collection

In `app/actions/profile.js`, avatar updates handle existing asset cleanup:
- When a user uploads a new avatar or deletes their avatar, the server queries the user's existing avatar path in Supabase Storage (`avatars` bucket).
- Old avatars are deleted via `supabase.storage.from('avatars').remove([oldPath])` before or immediately following successful upload.
- Prevents unused image clutter and runaway storage billing.

---

## 7. Reliability Summary & Verdict

| Category | Primary Failure Mode | Mitigation Strategy | Verdict |
| :--- | :--- | :--- | :--- |
| **Database** | Supabase connection pool exhaustion | In-memory sliding window fallback in rate limiter | **RESILIENT** |
| **Video Player** | Mobile chunk drops or CDN hiccups | HLS auto-recovery + Drive iframe reload button | **RESILIENT** |
| **Payments** | Network retry duplicate webhooks | DB transaction locks + state machine idempotency | **RESILIENT** |
| **File Storage** | Runaway orphaned avatars | Automatic deletion of previous avatar assets | **RESILIENT** |
| **Client UI** | Uncaught JS exceptions | Error boundary with localized retry button | **RESILIENT** |
