-- =====================================================================
-- Migration 010: Video Banners Support & Storage Upgrade
-- =====================================================================

-- 1. Add video_url to public.banners and make image_url nullable
ALTER TABLE public.banners ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE public.banners ALTER COLUMN image_url DROP NOT NULL;

-- 2. Update storage.buckets to allow video formats (MP4, WebM, QuickTime) in anime-banners with 50MB limit
UPDATE storage.buckets
SET file_size_limit = 52428800,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']
WHERE id = 'anime-banners';
