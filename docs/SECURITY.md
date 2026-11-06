# AniCity — Defensive Security Architecture & Vulnerability Mitigation

## 1. Threat Model & Security Posture

AniCity operates on a **zero-trust, defense-in-depth** model. The application protects sensitive streaming assets, user credentials, VIP subscriptions, and administrative powers against common web threats including OWASP Top 10 vulnerabilities, credential stuffing, and unauthorized privilege escalation.

---

## 2. Role-Based Access Control (RBAC)

AniCity enforces a strict 5-tier role hierarchy:

```
[Owner] ──► [Admin] ──► [Assistant Admin] ──► [Moderator] ──► [User]
```

### Hierarchy & Permissions Table

| Role | Catalog View | Favorite / History | Moderate Comments | Assistant Create/Edit | Manage Users & Roles | Manage VIP Grants |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **User** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Moderator** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Assistant Admin** | ✅ | ✅ | ✅ | Scoped (`anime_create`, etc.) | ❌ | ❌ |
| **Admin** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Owner** | ✅ | ✅ | ✅ | ✅ | Full Root Access | Full Root Access |

### Critical Security Guarantees:
- **Server-Side Enforcement:** Roles are verified inside Server Actions and API routes via `requireAdminPermission()` and database-level checks. Frontend flags only modify cosmetic presentation.
- **Atomic Grants via RPC:** Role promotions and VIP grants can only be executed through explicit database functions (`set_admin_claim`, `admin_grant_user_subscription`) with `SECURITY DEFINER` constraints.

---

## 3. Rate Limiting & Abuse Prevention (`lib/rate-limit.js`)

AniCity includes an in-memory sliding-window token bucket rate limiter to neutralize brute-force login attempts, registration spam, and search scraping.

### Rate Limiting Rules

| Endpoint / Action | Identifier | Max Requests | Window (Seconds) | Response on Limit |
| :--- | :--- | :--- | :--- | :--- |
| **User Login** | `auth:login:{ip}` | 5 | 60 | Friendly retry cooldown message |
| **Registration** | `auth:register:{ip}` | 3 | 60 | Block submission |
| **Forgot Password** | `auth:forgot:{ip}` | 3 | 60 | Block submission |
| **Public Anime Search** | `api:animes:get:{ip}` | 60 | 60 | HTTP 429 Too Many Requests |
| **Admin Anime Mutation** | `api:animes:post:{ip}` | 20 | 60 | HTTP 429 Too Many Requests |

### IP Address Extraction Security
Client IPs are extracted with proxy awareness:
1. `x-forwarded-for` (first hop client IP, stripped of internal proxy addresses)
2. `x-real-ip` / `cf-connecting-ip` (fallback for edge providers)
3. Defaults to `127.0.0.1` if unresolvable.

---

## 4. Input Sanitization & Injection Vectors

1. **SQL Injection Defense:** All database queries utilize Supabase parameterization or typed PostgreSQL RPCs. Direct SQL concatenation is strictly forbidden.
2. **Wildcard Escaping:** Search queries utilize `escapeLike()` (`lib/supabase/admin.js`) to escape `%`, `_`, and `\` before `ILIKE` evaluations.
3. **Cross-Site Scripting (XSS):**
   - React 19 automatically escapes all interpolated JSX variables.
   - User profile bios are checked for maximum length (500 characters) via table constraints.
   - All external media URLs are validated against strict protocols (`https:`, `http:`).

---

## 5. Storage Security & Path Traversal Mitigation (`lib/storage.js`)

The `avatars` bucket in Supabase Storage is safeguarded against folder traversal and impersonation:
- **Folder Isolation:** Files must be stored strictly within `{user_id}/{filename}`. A user cannot overwrite or reference files outside their own folder.
- **Extension Whitelist:** Only `.jpg`, `.jpeg`, `.png`, and `.webp` are accepted. SVG, HTML, and executable scripts are rejected at both API and trigger levels.
- **Database Trigger:** The `profiles_guard` trigger on `public.profiles` aborts any transaction where an unauthorized avatar URL is provided.

---

## 6. Secrets Hygiene & Environment Variables

- **Service Role Key:** `SUPABASE_SERVICE_ROLE_KEY` is never prefixed with `NEXT_PUBLIC_` and is never imported into any client component (`'use client'`).
- **Signing Keys:** Video streaming signing secrets (`VIDEO_SIGNING_KEY`) and payment secrets (`CLICK_SECRET_KEY`, `PAYME_SECRET_KEY`) reside exclusively in server environments (`.env.local` or Vercel Secret Store).
- **Git Protection:** `.env*.local` is explicitly ignored in `.gitignore`.
