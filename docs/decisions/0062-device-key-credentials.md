---
id: 0062-device-key-credentials
title: Browsers authenticate to servers with a device key and a signed certificate, never the GitHub token
status: active
date: 2026-10-12
track: product
accepted-by: Sergey Strebulaev <s@vivantel.dev>
tags: [security, auth, roadmap]
---

## Decision

- The browser makes a non-extractable ECDSA P-256 keypair (WebCrypto, kept in IndexedDB). P-256 is required because the browser floor (iOS Safari 16, Chrome 100) lacks Ed25519.
- After GitHub login, the hosted function signs a **device certificate** for (GitHub id, device public key, expiry of 7 days, `kid`) with its Ed25519 key, held as a Pages secret. The GitHub token is used once for that exchange and stays in the browser.
- To connect, the browser signs the server's challenge, which includes the `server_id`, and sends the certificate. The server verifies the certificate against the function's public key(s) and the signature against the device key, then applies the owner check (0053).
- Servers accept several function public keys (`kid`) so the signing key can rotate; rotation and leak response are a documented procedure.
- Owners can revoke a device through an authenticated message; the server keeps the revocation list locally.
- Cost: one Worker request per device per week, none on the connect path. Safari storage eviction costs one re-login; the installed PWA reduces it.

## Why

Today the raw GitHub token goes to every server, so one rogue or compromised server can replay it on the user's others, which in host mode (0058) means root elsewhere. A device key cannot be replayed by a server, and the challenge binds each signature to one server. Replaces the token handoff of 0053; see [[github-token-stays-in-browser]].
