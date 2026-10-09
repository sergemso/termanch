---
id: 0004
title: Transport Protocol Strategy
status: active
tags: [transport, webtransport, websocket, protocol]
date: 2026-10-09
---

# Transport Protocol Strategy

**Primary**: WebTransport over HTTP/3 (QUIC)
- UDP-like semantics critical for mobile network handoff
- Multiplexed streams without head-of-line blocking
- 0-RTT connection resumption for fast reconnect

**Fallback**: WebSocket over TLS (wss://)
- Universal browser support
- Used when WebTransport unavailable (Safari < 17, enterprise proxies)
- Single-stream fallback; higher latency but functional

**Selection logic**: Client attempts WebTransport first; on failure or explicit fallback signal, upgrades to WebSocket. Server accepts both on same port (443) via ALPN/h2+h3.