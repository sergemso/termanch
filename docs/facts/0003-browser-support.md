---
id: 0003
title: Minimum Supported Browsers
status: active
tags: [client, browser-support, compatibility]
date: 2026-10-09
---

# Minimum Supported Browsers

- **iOS Safari**: 16+ (WebTransport experimental behind flag in 16, stable in 17+)
- **Chrome Android**: 100+ (WebTransport stable since 97)
- **Desktop Chrome/Firefox/Edge**: Current - 2 versions
- **Safari macOS**: 16+ (WebTransport experimental)

WebTransport fallback to WebSocket ensures functional baseline on all targets.

> Correction (0016): WebTransport availability by Safari version is unverified; WebSocket is the baseline.

> Update (0112, 2026-10-17): the minimums are now iOS Safari 16.4, Chrome Android 111 and Safari macOS 16.4, because Tailwind v4 needs them. The versions listed above are the earlier floor.
