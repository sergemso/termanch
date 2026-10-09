---
id: 0007
title: iOS Safari Mitigation Strategy
status: active
tags: [ios, safari, pwa, background, persistence]
date: 2026-10-09
---

# iOS Safari Mitigation Strategy

**Problem**: iOS Safari aggressively kills background tabs (after ~30s), throttles timers, limits WebTransport, and evicts service workers under memory pressure.

**Mitigations**:

1. **Background Fetch API**: Register periodic fetch (every 15 min) to wake service worker and checkpoint session state to IndexedDB.

2. **Push Notifications (Web Push / APNs)**: Server sends silent push on session events (agent output, completion). Client wakes, fetches delta, updates badge.

3. **Service Worker + IndexedDB**: 
   - Cache all static assets (WASM, JS, CSS) for offline start
   - Persist session state (buffer, cursor, crypto keys) every 500ms
   - On foreground: restore from IndexedDB in <200ms, then sync with server

4. **WebTransport → WebSocket fallback on iOS**: WebSocket has better background keepalive behavior. Use as primary on iOS until WebTransport stable.

5. **Page Visibility API**: Pause rendering when hidden; resume on visible.

6. **Badge API**: Update app badge with unread agent notifications.