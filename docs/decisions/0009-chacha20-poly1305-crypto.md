---
id: 0009
title: ChaCha20-Poly1305 for Packet Encryption
status: active
track: process
tags: [crypto, chacha20, poly1305, encryption]
date: 2026-10-09
accepted-by: architect
---

# Decision: ChaCha20-Poly1305 for Packet Encryption

## Context
Wire protocol packets must be encrypted end-to-end. Requirements:
- Fast on mobile CPUs (arm64, often no AES-NI)
- Resistant to timing side-channels
- Standard, well-audited implementation
- Works in both Rust (server/WASM) and Web Crypto API (client fallback)

## Decision
Use **ChaCha20-Poly1305 (RFC 8439)** with 256-bit keys, 96-bit nonces, 128-bit tags.

## Key Derivation
- ECDH: X25519 (Curve25519) for key exchange
- HKDF-SHA256: `HKDF(salt=session_id, ikm=shared_secret, info="termanch-v1")`
- Output: 32-byte encryption key (split: 32B for ChaCha20, or use XChaCha20 if available)

## Rekey Policy
- Trigger at 1 GB encrypted data OR 1 hour elapsed
- New X25519 exchange initiated by either side
- Overlap window: accept packets with old key for 2 RTT after rekey

## Rationale
| Criterion | ChaCha20-Poly1305 | AES-128-GCM | AES-128-OCB |
|---|---|---|---|
| Mobile CPU (no AES-NI) | Fast (ARX) | Slow (table-based) | Fast but rare |
| Timing side-channels | None (constant-time) | Vulnerable if not HW | None |
| Web Crypto API | Yes (since 2018) | Yes | No |
| Rust crate | `chacha20poly1305` (audited) | `aes-gcm` | `aes-ocb` (less common) |
| Nonce misuse resistance | XChaCha20 variant | No | Yes |

## Tradeoffs
- **ChaCha20-Poly1305**: Best all-rounder for our constraints
- **AES-GCM**: Only better if all targets have AES-NI (not true for mobile)
- **XChaCha20-Poly1305**: Preferred if using `chacha20poly1305` crate's `XChaCha20Poly1305` (192-bit nonce) — eliminates nonce reuse risk at high volume

## Consequences
- `termanch-core` uses `chacha20poly1305` crate with `aead` trait
- Client WASM uses same crate compiled to WASM (or Web Crypto API polyfill)
- Nonce construction: `nonce = frame_counter (8 bytes) || random_salt (4 bytes)`
- Frame counter increments per encrypted frame; wraps at 2^64 (effectively never)