---
id: 0011
title: Packet Encryption Cipher
status: active
tags: [crypto, chacha20, poly1305, encryption]
date: 2026-10-09
---

# Packet Encryption Cipher

**Algorithm**: ChaCha20-Poly1305 (RFC 8439)

**Why ChaCha20-Poly1305 over AES-GCM**:
- Fast on mobile CPUs without AES-NI (arm64, older x86)
- No timing side-channels (constant-time implementation trivial)
- 256-bit key, 96-bit nonce, 128-bit tag
- Widely supported in Rust (`chacha20poly1305` crate) and Web Crypto API
- XChaCha20-Poly1305 (extended nonce) available if needed for high-volume streams

**Key derivation**:
- ECDH on Curve25519 (X25519) for key exchange
- HKDF-SHA256 with salt = session_id, info = "termanch-v1"
- Output: 32-byte encryption key + 32-byte authentication key (for HMAC if needed)

**Rekey**: Triggered at 1GB encrypted or 1 hour elapsed. New ECDH exchange, seamless key rotation (overlap window for in-flight packets).