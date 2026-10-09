---
id: 0006
title: Wire Protocol Packet Format
status: active
tags: [protocol, wire-format, protobuf, serialization]
date: 2026-10-09
---

# Wire Protocol Packet Format

**Format**: Binary, length-prefixed frames with varint-encoded field tags (protobuf-like but custom)

**Frame structure**:
```
[varint:total_length][varint:message_type][payload...]
```

**Message types** (varint):
- 0x01: HandshakeInit (client → server)
- 0x02: HandshakeResp (server → client)
- 0x03: KeyExchange (both)
- 0x04: EncryptedFrame (both)
- 0x05: Ping/Pong
- 0x10: SyncRequest
- 0x11: SyncResponse
- 0x12: Intent (keystroke, resize, paste)
- 0x13: DeltaFrame
- 0x14: FullState
- 0x20: AgentEvent
- 0x21: Notification
- 0xFF: Error/Close

**EncryptedFrame payload**: `[nonce:12][ciphertext...][tag:16]` (ChaCha20-Poly1305)

**Schema evolution**: Unknown message types ignored; unknown fields in known types skipped. Version negotiated in handshake.