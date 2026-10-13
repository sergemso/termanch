---
id: 0084-tab-switch-shows-a-server-snapshot-first
title: A tab switch shows a server snapshot at once, then attaches live
status: active
date: 2026-10-13
track: product
accepted-by: Sergey Strebulaev <s@vivantel.dev>
tags: [client, mobile, performance, protocol]
---

## Decision

- Only the active session is attached on a phone; there are no hidden terminals. Background work is heartbeats and event deltas only.
- The server answers `peek {session, hash?}` with `snapshot {session, text, hash}`: the pane's visible text with its colour codes (`capture-pane -e`), capped to the pane size and 16 KB, text and not an image, a whole screen and not a diff. If `hash` equals the current one it answers unchanged and sends no text.
- The client sends `peek` on touch-down over a tab or card, before the tap completes, and draws the snapshot into the terminal at once, dimmed. It then attaches; the live repaint replaces the snapshot. A manager that cannot capture (herdr) falls back to a plain attach.
- Snapshot text is terminal content: it travels only on the authenticated connection and is never logged, put in events, pushes or diagnostics.

## Why

The two wants collide: the foreground should feel instant and the background should cost almost nothing. The standing cost moves to the VPS, which is idle and mains powered, and the phone does a small request only when a tap is about to happen. Keeping terminals alive would cost memory, PTY streams and battery on the device that has the least of each.
