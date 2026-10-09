---
id: 0005
title: Screen Synchronization Algorithm
status: active
tags: [ssp, protocol, crdt, terminal]
date: 2026-10-09
---

# Screen Synchronization Protocol (SSP) Algorithm

**Approach**: Full frame deltas with Rope/sequence CRDT

**Server (authoritative)**:
- Maintains terminal buffer as Rope data structure (efficient insert/delete/splice)
- Tracks cursor position, scrollback, SGR state, DEC private modes
- Computes minimal diff (line/region granularity) on each PTY output
- Sends delta frames: `{ version, ops: [{ retain, delete, insert }] }`

**Client (WASM)**:
- Applies ops to local Rope mirror
- Renders visible viewport only (virtual scrolling)
- Sends only intents: keystrokes, resize, paste, focus events
- On reconnect: sends last known version; server responds with full state or delta from version

**Reconnect**: Client sends `SyncRequest { client_version }`. Server responds with `SyncResponse { server_version, ops[] }` or `FullState { buffer, cursor, modes }` if version too old (>1000 ops behind).

**Large output handling**: Server ring buffer capped at 10,000 lines (configurable). Lines beyond cap are truncated; client shows "[output truncated]" marker.