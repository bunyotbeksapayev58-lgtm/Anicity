# AniCity — Administrative Operations & Content Management Manual

## 1. Accessing the Admin Console

The AniCity administration suite is accessible at `/admin` (or `/assistant-admin` for scoped content operators).

Access is restricted exclusively to authenticated users whose `profiles.role` is set to `admin`, `owner`, or `assistant_admin`. Attempts by standard users or unauthenticated visitors are automatically rejected and redirected to `/login`.

---

## 2. Managing Anime Content

### Adding a New Anime
1. Open `/admin` and click **"Yangi Anime Qo‘shish"**.
2. Complete the required metadata:
   - **Sarlavha (Title):** Primary anime title (e.g. *Code Geass: Lelouch of the Rebellion*).
   - **Muqobil nom (Alt Title):** English / Japanese transliteration.
   - **Yil (Release Year):** Valid year between 1960 and 2100.
   - **Holat (Status):** *Tugallangan* (Completed) or *Davom etmoqda* (Ongoing).
   - **Janrlar (Genres):** Select appropriate genre tags (Action, Sci-Fi, Drama).
   - **Poster & Banner URL:** Direct HTTPS links to high-resolution artworks.
   - **Tavsif (Description):** Detailed synopsis (supports up to 2000 characters).
3. Click **"Saqlash"** (Save). Animes can be published immediately or saved as drafts (`is_published: false`).

---

## 3. Uploading & Managing Episodes

Episodes can be added independently or batch-managed for an existing anime:
1. Select the anime from the `/admin` catalog and choose **"Qismlar"** (Episodes).
2. For each episode:
   - **Qism raqami (Episode Number):** Unique sequence integer (1, 2, 3...).
   - **Video havolasi (Video Stream URL):** Accepts Google Drive file links (`https://drive.google.com/file/d/...`), direct MP4/WebM URLs, or HLS `.m3u8` streams.
   - **Eskiz (Thumbnail):** Episode preview frame.
3. AniCity automatically normalizes Google Drive links into the secure `/preview` format.

---

## 4. VIP Subscription Management & Grants

Admins can manage user VIP status through the **"Foydalanuvchilar"** (Users) or **"Obunalar"** (Subscriptions) tabs:

### Granting VIP Privileges Manually
1. Locate the target user by username or email.
2. Select **"VIP Berish"** (Grant VIP).
3. Choose the plan duration (e.g., 30 days, 90 days, or 365 days).
4. Enter an administrative reason for the audit trail.
5. Click **"Tasdiqlash"** (Confirm). The database atomically extends or activates the subscription and records a non-repudiable entry in `subscription_audit_logs`.

---

## 5. Assistant Admins & Granular Delegation

Owners can delegate specific duties without giving full administrative power:
- **`anime_create`:** Authorize creating new anime catalog entries.
- **`episode_create`:** Authorize adding new episode streams.
- **`video_upload`:** Authorize video banner and trailer updates.
- Assistant admins **cannot** grant VIP tiers, promote users, or modify permissions.
