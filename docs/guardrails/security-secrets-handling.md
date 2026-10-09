---
id: security-secrets-handling
title: Secrets Handling (Memory Only, No Logs)
status: active
governed-by: 0006,0009
grounded-in: 0008,0011
derivation-note: SSH auth decision + ChaCha20 crypto decision + MIT license = strict secrets hygiene
tags: [security, secrets, audit]
---

# Guardrail: Secrets Handling (Memory Only, No Logs)

## Rule
**MUST** keep all secrets (SSH private keys, session keys, challenge nonces, push subscription keys) in memory only. **MUST NOT** write secrets to disk, logs, shell history, or environment variables.

## Specific Requirements

### Server (`termanch-server`, `termanch-agent`)
- Session keys: Derived in memory via HKDF; never persisted
- SSH agent challenge: Generated per-connection; discarded after verify
- `authorized_keys` reading: Open file, parse, close immediately; no caching of private keys
- Logs: Structured JSON with `key_fingerprint` only; **NEVER** log challenges, signatures, session keys, nonces
- Core dumps: Disable via `ulimit -c 0` in systemd unit

### Client (WASM + JS)
- Session keys: Stored in WASM linear memory (not `localStorage`/`IndexedDB`)
- Crypto operations: Use Web Crypto API `CryptoKey` with `extractable: false`
- IndexedDB checkpoint: **Encrypt** session state with session key before storage
- Service worker: No access to secrets (separate origin if needed)

### Hook (`termanch-hook`)
- Reads user's `~/.ssh/authorized_keys` only; never writes
- Unix socket `~/.termanch/agent.sock`: `chmod 600`, uid check on connect
- No secrets in hook binary or config

## File Permissions
| Path | Mode | Owner |
|---|---|---|
| `~/.ssh/authorized_keys` | 600 | user |
| `~/.termanch/agent.sock` | 600 | user |
| `~/.termanch/sessions/` | 700 | user |
| Server TLS cert/key | 600 | user |

## Rate Limiting
- WebTransport connections: 10 concurrent per IP
- Handshake attempts: 5/minute per IP
- Agent socket connections: 1 per session (enforced by session ID)

## Enforcement
- CI: `grep -r "private_key\|session_key\|nonce\|challenge" --include="*.rs" --include="*.ts" | grep -v "test\|example" | grep -v "// " → fail`
- `cargo audit` + `pnpm audit` in CI
- `trivy` scan on Docker image
- Runtime: `seccomp` profile blocking `open`/`write` on sensitive paths (future)