# AniCity — Search Engine Optimization (SEO) & Discoverability Specification

## 1. Executive Summary

AniCity implements search engine optimization and social metadata standards to maximize organic discovery, click-through rates (CTR), and rich snippet visibility on Google and social media platforms.

---

## 2. Dynamic Metadata & OpenGraph Integration

Every dynamic route generates comprehensive metadata via Next.js `generateMetadata`:

### 2.1 Home & Catalog
- **Title Template:** `%s — AniCity | O'zbekistondagi Eng Katta Anime Portali`
- **Description:** Optimized for anime streaming in Uzbek language with localized keywords (`anime uzbek tilida`, `anime uz`, `bepul anime`, `online anime`).
- **Canonical URLs:** Enforced dynamically using `getSiteUrl()`.

### 2.2 Anime Detail Pages (`/anime/[id]`)
- **Dynamic Title:** `{anime.title} — O'zbek tilida tomosha qilish | AniCity`
- **Dynamic Description:** First 160 characters of anime synopsis.
- **OpenGraph & Twitter Card:**
  - `og:title`, `og:description`
  - `og:image` pointing to high-resolution anime poster or banner.
  - `og:type: 'video.tv_show'` or `'video.movie'`
  - `twitter:card: 'summary_large_image'`

---

## 3. JSON-LD Structured Data (Schema.org)

Anime detail pages inject structured JSON-LD schemas:

```json
{
  "@context": "https://schema.org",
  "@type": "Movie",
  "name": "Code Geass: Lelouch of the Rebellion",
  "alternateName": "Koukyou Shihen",
  "description": "...",
  "image": "https://...",
  "genre": ["Action", "Mecha", "Psychological"],
  "datePublished": "2006",
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "8.7",
    "reviewCount": "1250"
  }
}
```

---

## 4. Crawling & Indexing Infrastructure

- **Dynamic Sitemap (`app/sitemap.js`):**
  - Automatically queries published anime records from Supabase.
  - Generates XML sitemap URLs for static pages (`/`, `/catalog`, `/premium`) with daily change frequency.
  - Generates dynamic URLs for all published anime detail pages (`/anime/[id]`).
- **Robots.txt (`app/robots.js`):**
  - Allows public crawling of catalog and anime pages.
  - Disallows internal administrative routes (`/admin/`, `/assistant-admin/`, `/api/`).
  - References authoritative sitemap location: `https://anicity-app.vercel.app/sitemap.xml`.
