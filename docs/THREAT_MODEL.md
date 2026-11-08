# AniCity — Comprehensive Threat Model & Defense-in-Depth Specification

## 1. Executive Summary & Objective

This Threat Model provides a rigorous, architectural assessment of AniCity's security posture. It catalogs primary assets, identifies adversary profiles, maps out threat vectors aligned with OWASP Top 10 and STRIDE methodologies, and documents verified defensive controls.

---

## 2. Asset Inventory & Classification

| Asset | Sensitivity | Impact of Breach | Location |
| :--- | :--- | :--- | :--- |
| **User Authentication & Credentials** | High | Account takeover, credential stuffing | Supabase Auth (bcrypt/argon2 hashed) |
| **Administrative Powers & RBAC** | Critical | Site destruction, unauthorized content tampering | Supabase `profiles.role` + PostgreSQL RLS & RPCs |
| **VIP Subscription Entitlements** | High | Financial loss, unauthorized content access | Supabase `user_subscriptions` |
| **Payment Webhook Processing** | Critical | False payment confirmation, fraudulent subscriptions | `POST /api/payments/webhook`, Click & Payme secret keys |
| **Video Delivery Assets & CDN Leaching** | Medium-High | Bandwidth theft, hotlinking, content piracy | HMAC-SHA256 tokens (`/api/video/token`), Google Drive embeds |
| **User Profile Metadata (Avatars, Bio)** | Medium | Defacement, stored XSS, unauthorized file storage | Supabase Storage (`avatars`), PostgreSQL `profiles` |
| **System Audit Trails** | High | Loss of accountability, inability to investigate incidents | PostgreSQL `audit_logs`, `subscription_audit_logs` |

---

## 3. Adversary Profiles

1. **Anonymous Web Attacker:** Probes for open endpoints, SSRF, SQL injection, open redirects, or unauthenticated admin mutations.
2. **Malicious Authenticated User:** Attempts parameter tampering (IDOR), vertical privilege escalation (elevating from `user` to `admin`), horizontal tampering (modifying other users' profiles or watch history), and stored XSS in bios/display names.
3. **Bandwidth / Content Scraper:** Attempts to bypass authentication or subscription gates to rip video streams, hotlink media files, or harvest catalog metadata.
4. **Payment Fraudster:** Simulates fake payment webhook requests or replays legitimate webhooks to grant unearned VIP status.
5. **DDoS / Brute-Force Botnet:** Executes rapid credential-stuffing attacks on login/registration endpoints or exhausts serverless compute.

---

## 4. Threat Vectors & Defensive Mitigations (STRIDE & OWASP Top 10)

### 4.1 Injection (A03:2021)
- **Threat:** SQL injection through user search queries or ID filters.
- **Mitigation:**
  - Zero raw SQL string concatenation in application code.
  - Supabase client queries use parameterized PostgreSQL prepared statements.
  - Complex multi-table mutations are encapsulated within stored procedures (`admin_create_anime_with_episodes`, `admin_replace_anime_episodes`) using typed parameters.
  - Search wildcards (`%`, `_`, `\`) are strictly escaped via `escapeLike()` in `lib/supabase/admin.js`.

### 4.2 Broken Access Control (A01:2021)
- **Threat:** Direct access to `/admin` routes or unauthorized invocation of admin Server Actions.
- **Mitigation:**
  - **Server-Side Guard:** Every admin Server Action and API route verifies authorization via `requireAdminPermission()` or direct database lookup before executing logic.
  - **Assistant Admin Scoping:** Assistant Admins are restricted to granular permissions (`anime_create`, `anime_edit`, `anime_delete`) and cannot access user management, billing, or system settings.
  - **Horizontal IDOR Protection:** Profile edits enforce that the caller's session UID matches the target profile UID. Storage avatars enforce isolation via `{user_id}/{filename}` path structures.
  - **Row Level Security (RLS):** Supabase RLS policies are enabled across all tables (`animes`, `episodes`, `profiles`, `user_subscriptions`, `subscription_transactions`, `rate_limits`).

### 4.3 Server-Side Request Forgery (SSRF) (A10:2021)
- **Threat:** Abusing Next.js Image Optimization (`/_next/image`) to scan internal network infrastructure or access cloud metadata endpoints (`http://169.254.169.254`).
- **Mitigation:**
  - Hardened `next.config.mjs` by eliminating permissive wildcard patterns (`hostname: '**'`).
  - Strict domain whitelist restricted to authorized CDNs:
    - `*.supabase.co`
    - `drive.google.com`
    - `lh3.googleusercontent.com`
    - `images.unsplash.com`
    - `cdn.myanimelist.net`
    - `s4.anilist.co`
    - `m.media-amazon.com`
    - `i.ytimg.com`

### 4.4 Payment Fraud & Replay Attacks
- **Threat:** Attacker sends fake webhook payloads to `/api/payments/webhook` or replays captured notifications to extend subscriptions.
- **Mitigation:**
  - **Click Provider:** Enforces MD5 signature verification: `MD5(click_trans_id + service_id + secret_key + merchant_trans_id + amount + action + sign_time)`. Validates action state (`action=0` Prepare, `action=1` Complete) and returns official Click error codes.
  - **Payme Provider:** Enforces HTTP Basic Authentication (`Authorization: Basic base64(Paycom:secret_key)`). Implements strict JSON-RPC 2.0 merchant state machine (`CheckPerformTransaction`, `CreateTransaction`, `PerformTransaction`, `CancelTransaction`, `CheckTransaction`).
  - **Idempotency:** Transactions are locked and tracked by unique gateway transaction IDs in `subscription_transactions`. Duplicate callbacks return cached success without re-crediting VIP duration.

### 4.5 Brute-Force & Denial of Service (A07:2021)
- **Threat:** Distributed credential stuffing against `/login`, registration spam, or rapid API calls.
- **Mitigation:**
  - **Distributed Rate Limiting:** Implemented via PostgreSQL migration `017_distributed_rate_limiting.sql`. The atomic RPC `check_rate_limit(p_key, p_max_attempts, p_window_seconds)` provides synchronized tracking across all Vercel serverless instances.
  - **Sliding Window:** Tracks requests with millisecond precision and automatically expires stale tokens.
  - **Fail-Safe Fallback:** If the database connection is interrupted, the limiter seamlessly falls back to a local in-memory sliding window limiter to maintain continuous uptime.

### 4.6 Content Leaching & Hotlinking
- **Threat:** Direct extraction of video streams and embedding on third-party unauthorized portals.
- **Mitigation:**
  - **HMAC Playback Tokens:** Protected streams require a signed token generated via `POST /api/video/token` containing `userId`, `episodeId`, `expiresAt`, and a cryptographic `nonce`. Verified using `crypto.timingSafeEqual()`.
  - **Google Drive Embed Container:** Google Drive iframes enforce `referrerPolicy="no-referrer"`, click-hijack popout guards (`.ani-drive-popout-guard`), and sandboxed execution.

### 4.7 Cross-Site Scripting (XSS) & Defacement (A03:2021)
- **Threat:** Injecting malicious `<script>` tags into anime titles, descriptions, user bios, or comments.
- **Mitigation:**
  - React 19 JSX default context-aware HTML entity encoding.
  - Database varchar limits enforce concise bounds (e.g., 500 chars on bios).
  - Explicit sanitization for rich text elements.
  - Strict Content Security Policy (CSP) headers in `next.config.mjs` preventing inline script injection.

---

## 5. Security Verification & Continuous Monitoring

- **Regression Test Coverage:** 20 automated test suites with over 100 individual assertions run continuously on every pull request.
- **Audit Logging:** Administrative actions, subscription grants, and webhook events write immutable entries to `audit_logs` and `subscription_audit_logs`.
- **Structured Redaction:** Server-side logging (`lib/logger.js`) automatically masks passwords, tokens, API keys, cookies, and authorization headers before outputting JSON logs.
