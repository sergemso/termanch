---
id: 0056-automatic-connectivity
title: Servers reach the client automatically through a signed directory and quick tunnels
status: active
date: 2026-10-11
tags: [deployment, networking, security, roadmap]
track: product
accepted-by: Sergey Strebulaev <s@vivantel.dev>
supersedes: [0013]
---

## Decision

Regular users have no domain and no Cloudflare account, so connectivity is automatic and user-owned:

- The server starts its own Cloudflare quick tunnel (`cloudflared`, no account) and reads the URL from it. Quick-tunnel URLs change on restart, so the URL is never typed or printed.
- A small **directory** (Cloudflare Pages Functions + D1, free tier; deployed with the client in either hosting mode) maps a server id to its current URL. It stores only the server's public key, URL and a signature. It never sees terminal traffic and cannot redirect clients: records are signed by the server key, which the client pins at registration and checks on every lookup.
- Add Server is one step for the user: the client shows a single command containing a one-time secret; pasting it on the VPS installs and starts everything. The server proves it knows the secret (HMAC; the directory sees only a hash), the client pins its key, and GitHub-owner binding (0053) completes on first connect. The user never handles a URL or token.
- Stable named tunnels on the user's own domain, third-level domains under our zone, and a traffic relay are not the default. A "Connect Cloudflare" flow for stable tunnels is optional and depends on research (plan 8.1).

Supersedes the "no control plane" part of 0013: the directory is a metadata-only control plane, accepted for full automation.

## Why

Third-level domains do not fit the free tier at 10^4-10^5 users (200-1,000 DNS records per zone, 50 certificates per week). User-owned tunnels cost nothing at any scale. A signed directory removes the print-a-link and type-a-URL steps without trusting the directory.
