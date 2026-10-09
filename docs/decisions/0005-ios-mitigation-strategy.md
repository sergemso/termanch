---
id: 0005
title: iOS Safari Mitigation via Background Fetch, Push, and Service Worker
status: active
track: product
tags: [ios, safari, pwa, background, persistence]
date: 2026-10-09
accepted-by: architect
expires: 2027-10-09
---

# Decision: iOS Safari Mitigation via Background Fetch, Push Notifications, and Service Worker

## Context
iOS Safari aggressively manages resources:
- Background tabs killed after ~30 seconds
- Timers throttled to 1/min in background
- WebTransport limited/experimental (stable only in Safari 17+)
- Service workers evicted under memory pressure
- No persistent background execution like native apps

Termanch must survive: screen lock, app switch, Wi-Fi↔LTE handoff, tab eviction.

## Decision
Implement a **three-layer persistence strategy**:

1. **Service Worker + IndexedDB** (always-on):
   - Cache all static assets (WASM, JS, CSS, fonts) for instant offline start
   - Persist session state (Rope buffer, cursor, crypto keys, version) every 500ms
   - On foreground: restore from IndexedDB → render immediately → background sync with server

2. **Background Fetch API** (periodic):
   - Register `backgroundfetch` every 15 minutes (minimum iOS interval)
   - Fetches `/api/session/state` to update IndexedDB with latest server version
   - Wakes service worker even if page evicted

3. **Web Push / APNs** (event-driven):
   - Server sends silent push on: agent completion, confirmation request, new output after idle
   - Push payload: `{ session_id, event_type, version }`
   - Client wakes, fetches delta, updates badge, shows notification if permitted

**Transport fallback**: On iOS < 17, use WebSocket as primary (better background keepalive). WebTransport attempted on Safari 17+.

## Rationale
- **No native wrapper** — preserves "web only" constraint
- **Layered approach** — each layer handles different failure mode
- **IndexedDB checkpointing** — enables <200ms perceived restore (user sees last frame instantly)
- **Push notifications** — only way to wake evicted tab for real-time agent events

## Tradeoffs
| Layer | Reliability | Battery | Complexity |
|---|---|---|---|
| IndexedDB | High (always works) | Low | Medium |
| Background Fetch | Medium (iOS may skip) | Low | Low |
| Push Notifications | High (APNs delivery) | Medium (radio wake) | High (VAPID/APNs setup) |

## Consequences
- Client requires HTTPS + valid cert (Push API requirement)
- Server implements VAPID for Web Push + APNs for iOS native push (optional enhancement)
- `termanch-server` stores push subscriptions per session
- Service worker lifecycle managed via `workbox` or custom SW
- Test matrix: iOS 16 (WS + BG Fetch), iOS 17+ (WT + Push)