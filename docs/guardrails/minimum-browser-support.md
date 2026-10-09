---
id: minimum-browser-support
title: Minimum Browser Support Policy
status: active
governed-by: 0001,0005
grounded-in: 0003,0004
derivation-note: WebTransport fallback decision + iOS mitigation strategy define minimum viable browser versions
tags: [client, compatibility, support]
---

# Guardrail: Minimum Browser Support Policy

## Rule
**MUST** support and test against minimum browser versions. **MUST NOT** use APIs unavailable in minimum versions without polyfill/fallback.

## Minimum Versions
| Browser | Minimum Version | Release Date | Key APIs |
|---|---|---|---|
| iOS Safari | 16 | Sep 2022 | WebTransport (flag), Push API, Background Fetch, Service Worker |
| Chrome Android | 100 | Mar 2022 | WebTransport, Push API, Background Fetch, WebGL2 |
| Safari macOS | 16 | Oct 2022 | WebTransport (flag), Push API |
| Chrome Desktop | 108 | Nov 2022 | WebTransport, all above |
| Firefox Desktop | 118 | Oct 2023 | WebTransport, all above |
| Edge Desktop | 108 | Nov 2022 | WebTransport, all above |

## Required Polyfills/Fallbacks
- **WebTransport**: Fallback to WebSocket (DECISION-0001)
- **Push API**: Graceful degradation to polling (DECISION-0005)
- **Background Fetch**: Graceful degradation to manual sync (DECISION-0005)
- **WebGL2**: Required (xterm.js WebGL addon); no Canvas 2D fallback for terminal
- **Web Crypto API**: Required (ChaCha20-Poly1305); WASM crypto as fallback

## Deprecation Policy
- Minimum version bump requires ADR (track: product)
- 6-month notice before dropping a version
- Telemetry (opt-in) to track actual user browser distribution

## Enforcement
- CI: `browserslist` config in client package; `npm run test:browsers` runs against minimum versions via Playwright
- PR check: `eslint-plugin-compat` flags unsupported APIs
- Release checklist: Verify test matrix includes all minimum versions