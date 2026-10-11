---
id: 0016
title: Browser Capabilities Relevant to Termanch
status: active
tags: [client, browser-support, ios, pwa, crypto]
date: 2026-10-11
---

# Browser Capabilities Relevant to Termanch

Checked 2026-10-11 against MDN and WebKit-related sources. "Unverified" means no authoritative source was reached; confirm on MDN/caniuse before depending on it.

| Capability | Verdict | Source |
|---|---|---|
| Web Push on iOS | Supported from iOS/Safari 16.4, **only for web apps installed to the Home Screen** | [WebKit 16.4](https://www.webkit.org/?p=13966), [firt.dev](https://firt.dev/notes/pwa-ios/) |
| Badging API | Supported from 16.4 for installed web apps; permission follows notification permission | same |
| Background Fetch, Background Sync, Periodic Background Sync | **Not supported on iOS** (firt.dev table; may be dated) | [firt.dev](https://firt.dev/notes/pwa-ios/) |
| WebTransport | MDN marks it Baseline 2026 "newly available" (since March 2026); exact Safari/iOS versions unverified | [MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebTransport) |
| Web Crypto ChaCha20-Poly1305 | **Not in SubtleCrypto** (encrypt/decrypt lists RSA-OAEP, AES-CTR, AES-CBC, AES-GCM); needs JS/WASM | [MDN](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt) |
| Web Crypto X25519 | Recently added in some browsers; unverified per browser, feature-detect | MDN deriveBits |
| WebSocket in background on iOS | Suspended once the page is suspended; close events may never fire after long inactivity. The "30 s" figure has no source | [Apple forums](https://developer.apple.com/forums/thread/716118) |
| VirtualKeyboard API on iOS | Not available (as of a 2024 WebKit bug); use `visualViewport` resize + focus events | [WebKit bug 230225](https://bugs.webkit.org/show_bug.cgi?id=230225) |
| `visualViewport` on iOS | Supported (iOS 13+) | MDN |
| Browser access to an SSH agent | None; only via extension native messaging (desktop) | platform design |

## Consequences
- Do not rely on silent push or Background Fetch; the client must reconnect and replay on foreground (plan step 2.2).
- Push needs an installed PWA (plan step 3.2).
- App-layer ChaCha20 would need WASM/JS crypto, not Web Crypto (deferred, DECISION-0051).
- WebSocket stays the baseline transport; treat WebTransport as optional with feature detection.
