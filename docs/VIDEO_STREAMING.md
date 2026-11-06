# AniCity — Video Streaming Architecture & Player Specification

## 1. Executive Summary

AniCity delivers video streaming through a resilient, multi-tiered architecture that supports both external embed providers (Google Drive, Cloudflare Stream) and native direct streams (HLS adaptive bitrate, MP4, WebM).

The streaming pipeline is designed to eliminate common streaming failure points:
- Mobile black-screen issues on third-party embeds.
- Volume blasts upon video initialization.
- Fullscreen inconsistencies across Safari, Chrome, and Firefox.
- Inaccessible scrubber controls for assistive technologies.

---

## 2. Multi-Provider Streaming Abstraction (`lib/video/provider.js`)

Streaming URLs are dynamically analyzed and routed to appropriate rendering pipelines:

```
Stream URL ──► detectProvider(url) ──► getPlaybackSource(url)
                                            │
               ┌────────────────────────────┴────────────────────────────┐
               ▼                                                         ▼
       [Embed Provider]                                           [Native Provider]
   (Google Drive, Cloudflare)                                   (HLS .m3u8, MP4, WebM)
               │                                                         │
   Protected Sandbox Iframe                                    Custom Video Controller
   - Popout Guard                                              - Keyboard Shortcuts
   - Reload Overlay                                            - Scrubbing / ARIA
   - ReferrerPolicy="no-referrer"                              - Volume Persistence
```

### Supported Stream Types

| Provider | Indicator | Mime Type | Capability |
| :--- | :--- | :--- | :--- |
| **Google Drive** | `drive:*`, `drive.google.com` | `text/html` (Embed) | Unified `/preview` iframe with popout guard |
| **HLS** | `.m3u8` | `application/x-mpegURL` | Adaptive bitrate (1080p, 720p, 480p, 360p) |
| **Direct MP4** | `.mp4` | `video/mp4` | Hardware accelerated HTML5 playback |
| **Direct WebM** | `.webm` | `video/webm` | Open standard HTML5 playback |
| **Cloudflare Stream** | `videodelivery.net` | `text/html` | Signed token adaptive streaming |

---

## 3. Cryptographic Playback Authorization Tokens

For premium or protected streams, AniCity issues time-bound, cryptographically signed playback tokens to prevent direct hotlinking and unauthorized CDN leaching:

```js
import { generatePlaybackToken, verifyPlaybackToken } from '@/lib/video/provider';

// 1. Generate token on server
const token = generatePlaybackToken({
  userId: 'user-uuid',
  episodeId: 'episode-uuid',
  ttlSeconds: 7200, // Valid for 2 hours
});

// 2. Token is verified on CDN or edge streaming proxy
const { valid, payload, reason } = verifyPlaybackToken(token);
```

- **Algorithm:** HMAC-SHA256
- **Timing Safe:** Uses `crypto.timingSafeEqual()` to eliminate timing attack vectors.
- **Payload:** Includes `userId`, `episodeId`, `expiresAt`, and a cryptographic `nonce`.

---

## 4. Google Drive Embed Hardening

Google Drive links are converted and enclosed in a defensive container:
1. **URL Normalization:** All forms (`/view`, `/uc?id=`, `open?id=`, `drive:ID`) are normalized to:
   `https://drive.google.com/file/d/${fileId}/preview`
2. **Referrer Policy:** `referrerPolicy="no-referrer"` is enforced so Google does not block requests originating from mobile or staging domains.
3. **Pop-out Guard:** A transparent overlay button (`.ani-drive-popout-guard`) positioned at the top-right prevents users from accidentally clicking Google's pop-out button and leaving the platform.
4. **Interactive Reload Button:** If a network interruption occurs, the `.ani-drive-reload-overlay-btn` forces a clean iframe re-render by incrementing a React key timestamp.

---

## 5. Native Player UX & Accessibility Standards

The native HTML5 player (`components/Player.js`) adheres to strict psychological UX and accessibility guidelines:

### Keyboard Hotkeys
- `Space` / `K` — Toggle Play / Pause.
- `F` — Toggle Fullscreen (two-way state synchronization).
- `M` — Mute / Unmute.
- `←` / `→` — Seek backward / forward 10 seconds.
- `↑` / `↓` — Adjust volume up / down by 5% increments.

### State Persistence & Etiquette
- **Volume Memory:** Volume and mute states are saved in `localStorage` (`anicity_player_volume`, `anicity_player_muted`). Audio levels are smoothly restored on episode switches.
- **Autoplay Protection:** Video begins muted if autoplay policies restrict unprompted audio playback.
- **ARIA Compliance:** Scrubber and volume inputs feature:
  - `role="slider"`
  - `aria-label="Video vaqtini surish"` / `aria-label="Ovoz balandligi"`
  - `aria-valuemin`, `aria-valuemax`, and dynamic `aria-valuenow`.
