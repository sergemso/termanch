---
id: 0006
title: SSH Agent Forwarding for Authentication
status: active
track: product
tags: [auth, ssh, security, keys]
date: 2026-10-09
accepted-by: architect
---

# Decision: SSH Agent Forwarding with authorized_keys Validation

## Context
Authentication must:
- Use user's existing SSH keys (no new key management)
- Never transmit private keys to server
- Work with standard SSH agent (`ssh-agent`, `gpg-agent`, 1Password, etc.)
- Resist replay and MITM attacks

## Decision
**Challenge-response via SSH agent forwarding**:

1. Server generates ephemeral X25519 keypair + 32-byte challenge
2. Client receives challenge, forwards to local SSH agent via `ssh-add -L` style RPC (WebExtension native messaging or local proxy)
3. SSH agent signs challenge with user's identity key (ed25519 preferred)
4. Client sends signature + key fingerprint to server
5. Server verifies signature against `~/.ssh/authorized_keys`
6. On success: HKDF derives session keys from ECDH shared secret

**Key properties**:
- Private key never leaves client machine (stays in agent)
- Server only stores `authorized_keys` (standard SSH practice)
- Short-lived session keys (rekey at 1GB / 1 hour)
- No passwords, no TOTP, no WebAuthn in MVP (can be added later)

## Rationale
- **Leverages existing infrastructure**: Developers already have SSH keys + agents
- **Zero trust**: Server never sees private key material
- **Standard**: Mirrors SSH protocol's `publickey` auth method
- **Extensible**: Can add hardware key (YubiKey) support via agent

## Tradeoffs
| Aspect | SSH Agent Forwarding | WebAuthn/Passkeys | Token/JWT |
|---|---|---|---|
| Setup friction | Zero (existing keys) | Medium (enrollment) | Low |
| Private key exposure | None | None (secure enclave) | N/A |
| Mobile support | Requires agent app | Native | Native |
| Server complexity | Low (authorized_keys) | Medium (credential store) | Low |

## Consequences
- Client needs SSH agent access: desktop = native messaging; mobile = SSH agent app (e.g., Prompt, Blink) or local proxy
- Server runs `sshd`-style validation logic (can reuse `ssh-keygen -lf` parsing)
- Rate limit: 5 handshake attempts/IP/minute
- Audit log: record key fingerprint + IP on auth success/failure (no challenge/sig logged)