---
id: 0051-mvp-evolve-baseline
title: The hybrid MVP is the baseline; v1-only designs are deferred
status: active
date: 2026-10-11
tags: [architecture, roadmap]
track: product
accepted-by: Sergey Strebulaev <s@vivantel.dev>
supersedes: [0001, 0003, 0005, 0006, 0009, 0012]
---

## Decision

Termanch evolves the shipped MVP: GitHub OAuth, WebSocket, xterm.js WebGL, tmux-backed sessions, Cloudflare Tunnel (0013). Decisions 0001, 0003, 0005, 0006, 0009, 0012 and facts 0004, 0005, 0007, 0008, 0011, 0014 describe the v1 design (WebTransport, WASM/SSP, SSH-agent auth, app-layer ChaCha20) and are `deferred`: they are not requirements until a new decision reactivates them. Persistence on mobile comes from tmux server-side plus fast client reconnect and screen replay, not from SSP.

## Why

The MVP is built and works; the v1 designs rest on unverified browser capabilities (browsers cannot reach an SSH agent; Web Crypto has no ChaCha20-Poly1305; iOS has no Background Fetch).
