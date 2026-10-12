---
id: 0026
title: Client UI baseline before the v3 UI work
status: active
tags: [client, mobile, ios]
date: 2026-10-12
---

# Client UI baseline before the v3 UI work

- No UI or CSS framework. `packages/client/src/app.css` is about 135 lines of CSS variables and bare `button` rules; `App.svelte` (412 lines) lays out almost everything with inline `style` strings. Breakpoints come from JS (`matchMedia("(max-width: 720px)")` sets `narrow`).
- The client holds exactly one `Connection`; `connectToServer` closes the previous one.
- The sessions sidebar is `position: absolute` with `width: min(85vw, 320px)` on a phone, so it covers about 80% of the screen. It only opens or closes.
- Soft keyboard: `--app-height` follows `visualViewport` `resize` only (not `scroll`), and the viewport meta has `interactive-widget=resizes-content`, which iOS Safari ignores. The owner sees the iPhone keyboard cover the key row (Ctrl/Alt/arrows) after tapping the terminal. Root cause is unconfirmed; it cannot be reproduced without a device.
- `SessionBackend` (`packages/server/src/backend.rs`) can list, create and attach; it has no kill or rename, and the protocol has no matching messages.
- `SessionInfo.agent` can be `tmux` or `herdr`; `KeyRow.svelte` has one fixed key list.
