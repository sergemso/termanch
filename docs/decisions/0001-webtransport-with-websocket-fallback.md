---
id: 0001
title: WebTransport with WebSocket Fallback
status: active
track: product
tags: [transport, webtransport, websocket, mobile]
date: 2026-10-09
accepted-by: architect
expires: 2027-10-09
---

# Decision: WebTransport Primary, WebSocket Fallback

## Context
Termanch requires Mosh-level session persistence on mobile networks with Wi-Fi↔LTE handoff, backgrounding, and tab eviction. The transport layer must support:
- UDP-like semantics for low-latency keystroke delivery
- Connection migration/resumption without session restart
- Multiplexing without head-of-line blocking
- Functionality on all target browsers (iOS Safari 16+, Chrome Android 100+)

## Decision
Use **WebTransport over HTTP/3 (QUIC)** as the primary transport, with **WebSocket over TLS (wss://)** as the fallback.

## Rationale
- **WebTransport (QUIC)** provides:
  - 0-RTT connection resumption — critical for fast reconnect after network handoff
  - Native multiplexing — keystrokes, delta frames, agent events on separate streams
  - Unreliable datagram support — can send latest frame only, drop stale
  - Better congestion control for mobile (BBR v2 in quinn)
- **WebSocket fallback** ensures:
  - Universal compatibility (works behind corporate proxies that block UDP/443)
  - Functional baseline on Safari < 17 where WebTransport is experimental
  - Simpler debugging (text frames inspectable in DevTools)

## Tradeoffs
| Aspect | WebTransport | WebSocket |
|---|---|---|
| Latency | ~1 RTT (0-RTT resumption) | ~1-2 RTT |
| Reconnect | Seamless (session ticket) | Full handshake |
| Mobile handoff | Native connection migration | Reconnect required |
| Browser support | Chrome 97+, Safari 17+ (flag in 16) | Universal |
| Proxy traversal | Blocked by some UDP-blocking proxies | Works over HTTP/2 |
| Implementation | Complex (quinn, h3) | Simple (tokio-tungstenite) |

## Consequences
- Server must accept both on port 443 (ALPN: h3, h2)
- Client implements transport abstraction layer with automatic fallback
- WebSocket path uses same wire protocol (binary frames over WS binary messages)
- iOS Safari < 17 users get WebSocket-only experience (tracked as known limitation)