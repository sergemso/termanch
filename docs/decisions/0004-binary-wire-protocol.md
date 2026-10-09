---
id: 0004
title: Binary Protobuf-like Wire Protocol with Varint Encoding
status: active
track: process
tags: [protocol, wire-format, serialization, protobuf]
date: 2026-10-09
accepted-by: architect
---

# Decision: Binary Protobuf-like Wire Protocol with Varint Encoding

## Context
The wire protocol must:
- Work efficiently over both WebTransport (QUIC streams) and WebSocket (binary frames)
- Support schema evolution (add fields without breaking old clients)
- Minimize bandwidth on mobile networks
- Allow zero-copy parsing in WASM (via `bincode`/`postcard` or custom)

## Decision
Use a **custom binary format** with:
- Length-prefixed frames (`varint:total_length`)
- Varint-encoded message type tag
- Protobuf-style field tags (varint) + length-delimited values
- No external schema file — schema defined in Rust `protocol.rs` with `serde` + custom `encode`/`decode`

## Format Details
```
Frame: [varint:len][varint:msg_type][payload...]
Payload: repeated [varint:field_tag][value...]
Value encoding:
  - uint32/64: varint
  - int32/64: zigzag varint
  - bytes: varint:len + bytes
  - string: varint:len + utf8
  - nested: varint:len + nested payload
```

## Rationale
- **Smaller than protobuf**: No field numbers in wire for known messages (implicit by msg_type)
- **Faster than MessagePack**: No type tags per value; schema known both ends
- **Schema evolution**: Unknown field tags skipped; new fields added at end
- **Zero-copy in WASM**: `postcard` crate supports in-place decode from `&[u8]`
- **Single implementation**: Rust `encode`/`decode`; TS client uses generated code from same source

## Tradeoffs
| Format | Size | Parse Speed | Schema Evolution | WASM Support |
|---|---|---|---|---|
| Custom binary (chosen) | Smallest | Fastest | Manual but simple | Excellent (postcard) |
| Protocol Buffers | Small | Fast | Built-in | Good (protobuf-wasm) |
| MessagePack | Medium | Medium | Implicit | Good |
| JSON | Large | Slow | Implicit | Native |

## Consequences
- `core/src/protocol.rs` is single source of truth
- `build.rs` generates TS types via `wasm-bindgen` + custom codegen
- Version negotiated in `HandshakeInit`/`HandshakeResp`
- Max frame size: 16 KB (fits in single QUIC stream frame)