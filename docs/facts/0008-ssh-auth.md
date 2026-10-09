---
id: 0008
title: SSH Authentication Method
status: active
tags: [auth, ssh, security]
date: 2026-10-09
---

# SSH Authentication Method

**Method**: SSH agent forwarding with `authorized_keys` validation

**Flow**:
1. Client connects via WebTransport/WebSocket
2. Server sends `HandshakeResp` with ephemeral Curve25519 public key + challenge (32 random bytes)
3. Client forwards challenge to local SSH agent (`ssh-agent` or `gpg-agent`)
4. SSH agent signs challenge with user's identity key (ed25519/rsa)
5. Client sends `KeyExchange { signature, key_fingerprint }`
6. Server verifies signature against `~/.ssh/authorized_keys`
7. On success: derive session keys via HKDF(shared_secret, "termanch-session")

**Properties**:
- No passwords, no keys stored on server disk beyond `authorized_keys`
- User's existing SSH keys work unchanged
- Agent forwarding means private key never leaves client machine
- Short-lived session keys (rekey every 1GB or 1 hour)

**Rate limiting**: Max 5 handshake attempts per IP per minute.