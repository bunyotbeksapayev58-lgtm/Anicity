# AniCity — Administrator Operations & Panel Guide

**Author:** AniCity Principal Systems Architect & Senior Product Engineer  
**Date:** November 2026  
**Status:** COMPLETE & VERIFIED  
**Audience:** Platform Owners, Administrators, Moderators, Content Managers

---

## 1. Overview & Architecture

The AniCity administration suite provides a modern, secure, and resilient control center for managing anime streaming content, user accounts, role delegations, VIP subscriptions, and financial audit logs.

All admin operations are executed through Next.js Server Actions with strict server-side validation (`assertAdmin()` in `lib/admin-access.js`). Client-side URL tampering or UI bypasses are physically impossible because authorization is checked on every single mutation directly against the PostgreSQL database.

---

## 2. Role Hierarchy & Access Privileges

AniCity implements a four-tier Role-Based Access Control (RBAC) structure:

```
[ Owner ] ───────► Complete platform ownership, database root, billing, role management
    │
    ▼
[ Admin ] ───────► Full catalog management, user roles, manual VIP grants, audit logs
    │
    ▼
[ Assistant ] ───► Content-only delegation (create/edit anime, add episodes)
    │              * CANNOT grant roles, cannot access billing, cannot view audit logs
    ▼
[ User ] ────────► Standard registered viewer (public catalog, personal profile, favorites)
```

| Permission / Action | Owner | Admin | Assistant | Regular User |
| :--- | :---: | :---: | :---: | :---: |
| Access `/admin` Dashboard | **YES** | **YES** | NO (Redirected) | NO (Redirected) |
| Access `/assistant-admin` | **YES** | **YES** | **YES** | NO (Redirected) |
| Create / Edit Anime | **YES** | **YES** | **YES** (with permission) | NO |
| Upload / Edit Episodes | **YES** | **YES** | **YES** (with permission) | NO |
| Publish / Unpublish Episodes | **YES** | **YES** | **YES** (with permission) | NO |
| Promote / Demote User Roles | **YES** | **YES** | **NO** (Blocked by code) | NO |
| Manual VIP Days Grant | **YES** | **YES** | **NO** (Blocked by code) | NO |
| View Financial Audit Logs | **YES** | **YES** | **NO** (Blocked by code) | NO |
| Configure Payment Credentials | **YES** | NO | NO | NO |

---

## 3. Content Operations: Anime Management

### 3.1 Creating a New Anime
1. Navigate to `/admin` (or `/assistant-admin` if signed in as Assistant).
2. Click **"Yangi Anime Qo‘shish"** (Create Anime).
3. Fill in the required metadata fields:
   - **Title (Nomi):** e.g., `Code Geass: Lelouch of the Rebellion`
   - **Slug:** Auto-generated from title or custom (e.g., `code-geass`)
   - **Type (Turi):** TV Series, Movie, OVA, ONA
   - **Release Year (Yili):** e.g., `2006`
   - **Status:** Ongoing (Davom etmoqda) or Completed (Tugallangan)
   - **Genres (Janrlar):** Action, Mecha, Psychological, Sci-Fi
   - **Description (Tavsif):** Plot synopsis (rendered with 68ch line length for readability)
   - **Poster Image:** JPEG/PNG/WebP upload (saved to Supabase `posters` bucket)
   - **Banner Image:** Cinematic 16:9 backdrop upload (saved to `banners` bucket)
4. Click **"Saqlash"** (Save).
5. **Decoupled Architecture:** In AniCity, an anime can be saved without episodes. You do not need video files ready immediately to create the anime entry.

### 3.2 Editing Existing Anime
- From the catalog table in `/admin`, click **"Tahrirlash"** (Edit) on any entry.
- Update metadata, upload replacement artwork, or toggle visibility.
- Changes propagate instantly across the platform.

---

## 4. Episode & Video Streaming Management

### 4.1 Adding Episodes to an Anime
1. In the admin catalog, click on the anime title or **"Qismlar"** (Episodes).
2. Click **"Yangi Qism Qo‘shish"** (Add Episode).
3. Specify:
   - **Episode Number (Qism raqami):** Integer (e.g., `1`, `2`, `3`). Duplicate episode numbers within the same anime season are automatically rejected by validation.
   - **Episode Title (Qism nomi):** e.g., `The Day a New Falcon Was Born`
   - **Video Source Type:** Select the video provider:
     - `Google Drive`: Enter Google Drive shared file URL (system normalizes to `/preview` embed).
     - `Direct MP4`: Direct CDN HTTPS link to `.mp4` / `.webm` video file.
     - `HLS (.m3u8)`: Adaptive bitrate streaming manifest URL.
     - `Cloudflare Stream`: Cloudflare video UID.
   - **VIP Only Toggle (Faqat VIP uchun):** Toggle ON if this episode requires an active VIP subscription to watch. Free episodes (e.g. Episode 1 & 2) should remain untoggled.
   - **Published Status (Chop etilgan):** Toggle ON to make immediately visible to viewers, or leave OFF to save as an internal draft.
4. Click **"Qismni Saqlash"** (Save Episode).

---

## 5. User Management & Role Delegation

### 5.1 Searching and Inspecting Users
- Navigate to `/admin -> Foydalanuvchilar` (Users tab).
- Search users by username, email, or display name.
- Review account creation date, current role, and VIP subscription expiration date.

### 5.2 Role Assignments
- To promote a trusted moderator or content creator:
  1. Select the user row.
  2. Change role dropdown from `user` to `assistant` or `admin`.
  3. Click **"Rolni Yangilash"** (Update Role).
  4. The server validates that the actor is an `admin` or `owner` before committing the change to `public.user_roles`.

### 5.3 Granular Assistant Delegation (`/assistant-admin`)
- Assistants have their own clean interface focused exclusively on anime and episode management.
- Assistants cannot see financial metrics, payment configurations, or other users' private account details.

---

## 6. Subscription Operations & VIP Grants

### 6.1 Inspecting Active VIP Subscribers
- In the `/admin -> Obunalar` (Subscriptions tab), view all active user subscriptions with exact start and expiry timestamps.

### 6.2 Manual VIP Days Grant (Customer Support Tool)
When a user pays via offline cash or requires customer support compensation:
1. Locate the user in the Users tab.
2. Click **"VIP Qo‘shish"** (Grant VIP).
3. Select the duration (e.g., `30 kun`, `90 kun`, `365 kun`).
4. Enter an administrative reason (e.g., "Manual bank transfer verified" or "Promo giveaway").
5. Confirm grant:
   - If the user already has an active subscription, the new days are automatically appended to their existing `ends_at` date.
   - An immutable record is created in `public.subscription_audit_logs` tracking the admin who granted the days, timestamp, and duration.

---

## 7. Security Best Practices for Administrators

1. **Keep Service Role Secrets Safe:** Never share the `SUPABASE_SERVICE_ROLE_KEY` or place it in client-side code.
2. **Assign Assistant Role for Content Uploaders:** Never grant full `admin` role to contractors or uploaders who only need to add video episodes. Give them `assistant` role.
3. **Use Strong Passwords:** Admin accounts must enforce strong passwords ($\ge 12$ characters) and enable MFA in Supabase Auth where applicable.
4. **Regularly Review Audit Logs:** Inspect `subscription_audit_logs` periodically to ensure no unauthorized manual VIP grants occurred.
