---
id: 0054-session-backends
title: The server owns sessions through a pluggable backend
status: active
date: 2026-10-11
tags: [architecture, sessions, agents]
track: product
accepted-by: Sergey Strebulaev <s@vivantel.dev>
supersedes: [0007]
---

## Decision

`termanch-server` owns the terminal path itself: it lists and creates sessions and attaches a PTY client per WebSocket through a `SessionBackend` (`packages/server/src/backend.rs`). Built in: `tmux`. Any other session manager with a CLI (herdr, zellij, screen) plugs in with `TERMANCH_BACKEND=command` and three command templates (list, create, attach); a server-native backend implements the trait directly (plan step 7.2). A backend must keep the session alive when its attach client is killed and repaint the screen on attach: that is what makes reconnect resume without a replay buffer in the server.

The separate `termanch-agent` daemon and its server link are parked; agent detection moves into the server (plan step 4.1). Decision 0007's PTY-wrapper and shell-hook design is superseded.

## Why

The agent-to-server link was a placeholder that never carried terminal data. One process is simpler on 512MB/1 vCPU, and the backend seam lets users keep the multiplexer they already use.
