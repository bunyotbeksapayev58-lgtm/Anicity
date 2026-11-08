# AniCity — Demo Content Cleanup & Catalog Migration Guide

**Author:** AniCity Database Architect & Operations Lead  
**Date:** November 2026  
**Status:** PRODUCTION OPERATIONAL PROCEDURE  
**Target Environment:** Supabase PostgreSQL Database

---

## 1. Overview & Objective

During development and automated testing, demo anime records (such as sample seeds for *Suzume*, *Your Name*, *Attack on Titan*, or *Test Series*) were created in the Supabase database.

This guide provides a safe, idempotent procedure to purge mock and demo content before launching commercial production or transferring ownership to a buyer, **without harming real user accounts, user subscriptions, payments, or administrative roles.**

---

## 2. Foreign Key Cascade Architecture

AniCity's relational schema is designed with strict foreign key constraints:
- `animes.id` is referenced by:
  - `episodes.anime_id` (`ON DELETE CASCADE`)
  - `trailers.anime_id` (`ON DELETE CASCADE`)
  - `favorites.anime_id` (`ON DELETE CASCADE`)
  - `watch_progress.anime_id` (`ON DELETE CASCADE`)
  - `ratings.anime_id` (`ON DELETE CASCADE`)

**Safety Guarantee:**  
Deleting an anime record automatically and cleanly cascades to all its associated episodes, trailers, and user watch progress records. It **does NOT** touch:
- `public.profiles` (User identity & display names)
- `public.user_roles` (Admin / Moderator / Assistant roles)
- `public.user_subscriptions` (VIP active dates)
- `public.payments` (Click & Payme transaction records)
- `public.subscription_audit_logs` (Financial audit trail)

---

## 3. Step 1: Pre-Execution Inspection (Dry Run)

Before deleting any data, open the **Supabase Dashboard -> SQL Editor** and run the following inspection query to view all current anime entries in the database:

```sql
-- Step 1.1: List all existing animes with their episode counts
SELECT 
    a.id, 
    a.title, 
    a.slug, 
    a.is_published, 
    a.created_at,
    COUNT(e.id) AS total_episodes
FROM public.animes a
LEFT JOIN public.episodes e ON e.anime_id = a.id
GROUP BY a.id, a.title, a.slug, a.is_published, a.created_at
ORDER BY a.created_at DESC;
```

Review the returned list to identify which entries are demo test records (e.g., titles containing "Demo", "Test", "Sample") versus genuine content uploaded by your team (e.g., *Code Geass*).

---

## 4. Step 2: Selective Purge (Recommended)

If you have real uploaded content (such as *Code Geass*) that you want to preserve while removing only demo titles, use targeted deletion by ID or title:

```sql
-- Step 2.1: Delete specific demo anime by ID (Recommended Safe Mode)
-- Replace the UUIDs below with the exact IDs from your Step 1 inspection
DELETE FROM public.animes
WHERE id IN (
    '00000000-0000-0000-0000-000000000001', -- Example demo UUID 1
    '00000000-0000-0000-0000-000000000002'  -- Example demo UUID 2
);

-- OR Step 2.2: Delete by title matching known demo keywords
DELETE FROM public.animes
WHERE title ILIKE '%demo%' 
   OR title ILIKE '%test seed%' 
   OR title ILIKE '%sample%';
```

---

## 5. Step 3: Complete Catalog Reset (Clean Slate Mode)

If you are handing the platform to a buyer who wants a completely clean catalog to populate from scratch via the Admin Panel:

> [!CAUTION]
> This command will permanently delete ALL anime titles, episodes, and watch progress. User accounts and subscriptions will remain untouched.

```sql
BEGIN;

-- 1. Truncate anime catalog with cascade
TRUNCATE TABLE public.animes CASCADE;

-- 2. Verify all dependent tables are cleanly reset
SELECT COUNT(*) AS remaining_animes FROM public.animes;
SELECT COUNT(*) AS remaining_episodes FROM public.episodes;
SELECT COUNT(*) AS remaining_trailers FROM public.trailers;
SELECT COUNT(*) AS remaining_progress FROM public.watch_progress;

-- If counts are all 0 and you are satisfied, COMMIT:
COMMIT;
-- If any mistake occurred, ROLLBACK;
```

---

## 6. Step 4: Storage Asset Cleanup (Optional)

If demo posters, banners, or video files were uploaded to Supabase Storage:

1. In Supabase Dashboard, navigate to **Storage -> Buckets**.
2. Open the `posters` bucket: Select demo images and click **Delete**.
3. Open the `banners` bucket: Select demo banners and click **Delete**.
4. Open the `avatars` bucket: **DO NOT DELETE** — user profile avatars reside here.

---

## 7. Step 5: Post-Cleanup Verification

After running the cleanup:
1. Visit `https://your-domain.vercel.app/catalog`: Catalog should display the empty state or only your real anime (*Code Geass*).
2. Visit `https://your-domain.vercel.app/admin`: Admin dashboard should accurately reflect the active anime count.
3. User login, profile page, and VIP subscriptions continue functioning seamlessly.
