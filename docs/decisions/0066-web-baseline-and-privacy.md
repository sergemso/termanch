---
id: 0066-web-baseline-and-privacy
title: The hosted client ships a strict CSP, a disclosure policy, a privacy notice and data deletion
status: active
date: 2026-10-12
track: product
accepted-by: Sergey Strebulaev <s@vivantel.dev>
tags: [security, privacy, web, roadmap]
---

## Decision

- Pages `_headers`: `default-src 'self'`, no inline script, `frame-ancestors 'none'`, `connect-src` limited to the origin and the CDN domain, plus HSTS, nosniff and a strict referrer policy. No third-party scripts; dependencies pinned by lockfile.
- `SECURITY.md`: private reporting through GitHub security advisories, 90-day disclosure window.
- A plain privacy notice: we store the GitHub id, the owner's server list, and server IP, port and fingerprint; records of servers idle 30 days are deleted.
- An authenticated delete-my-data action removes the owner list and the records of that owner's servers.

## Why

An XSS in the client could steal the device key's use and the session; personal data (GitHub id, IPs) needs a stated retention and a way out. See fact 0023.
