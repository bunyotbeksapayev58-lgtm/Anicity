# AniCity — Performance Optimization & Core Web Vitals Engineering

## 1. Executive Summary

AniCity is optimized to deliver low latency, instant player initialization, and seamless navigation across desktop and mobile devices. This document outlines performance strategies, caching layers, and Core Web Vitals (CWV) benchmarks.

---

## 2. Core Web Vitals Targets & Implementation

| Metric | Target | Optimization Strategy |
| :--- | :--- | :--- |
| **LCP (Largest Contentful Paint)** | < 1.8s | Next/Image responsive sizes (`sizes="(max-width: 768px) 100vw, 50vw"`), priority poster preloading, optimized CDN asset delivery. |
| **FID / INP (Interaction to Next Paint)** | < 100ms | Lightweight state handling, asynchronous Server Actions, debounced search filters (300ms). |
| **CLS (Cumulative Layout Shift)** | 0.00 | Fixed aspect-ratio containers (`aspect-video`, `aspect-[2/3]`) for posters and players; explicit skeleton loaders. |
| **TTFB (Time to First Byte)** | < 250ms | Edge middleware caching, optimized PostgreSQL B-tree/GIN indexes, Supabase connection pooling. |

---

## 3. Next.js 16 & Turbopack Optimization

- **Turbopack Compiler:** Production build compiles in under 4 seconds across 28 routes.
- **Server Component Streaming:** Static shells render immediately while asynchronous dynamic sections stream in via React Suspense.
- **Bundle Optimization:**
  - Modern ES modules.
  - Zero heavy third-party UI libraries (Tailwind CSS utility classes used natively).
  - Dynamic import for `hls.js` video streaming engine ensuring player bundle is only loaded on `/watch` routes.

---

## 4. Database Query Optimization

- **Composite & Partial Indexes:**
  - `idx_animes_is_published_created_at` optimizes catalog queries.
  - `idx_episodes_anime_number` enables single-seek episode lookups.
  - `idx_rate_limits_expires_at` ensures rate limit expiration purges run in O(log N) time.
- **RPC Encapsulation:** Complex multi-step operations (e.g. creating anime with episodes, updating subscriptions) execute in a single round-trip database transaction, eliminating network waterfalls.
