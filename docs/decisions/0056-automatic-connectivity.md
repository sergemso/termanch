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

> Update: the transport default (quick tunnel) is superseded by 0057 (WebRTC direct). The directory, the signed record (now IP, UDP port, fingerprint) and onboarding flows A and B stay.

## Decision

Regular users have no domain and no Cloudflare account, so connectivity is automatic and user-owned:

- The server starts its own Cloudflare quick tunnel (`cloudflared`, no account) and reads the URL from it. Quick-tunnel URLs change on restart, so the URL is never typed or printed.
- A small **directory** (Cloudflare Pages Functions + D1, free tier; deployed with the client in either hosting mode) maps a server id to its current URL. It stores only the server's public key, URL and a signature. It never sees terminal traffic and cannot redirect clients: records are signed by the server key, which the client pins at registration and checks on every lookup.
- Add Server is one step for the user: the client shows a single command containing a one-time secret; pasting it on the VPS installs and starts everything. The server proves it knows the secret (HMAC; the directory sees only a hash), the client pins its key, and GitHub-owner binding (0053) completes on first connect. The user never handles a URL or token.
- Two onboarding flows are adopted (FACT-0019):
  - **A, paste**: Add Server shows one command with a copy button; the secret is inside it.
  - **B, scan**: the same installer, when attached to an interactive terminal, also draws a QR with the claim secret; the client scans it with the live camera or from a screenshot picked in the gallery. Secrets expire (15 minutes) and work once.
  - Not adopted: pairing codes typed by hand, and provider flows (cloud-init, DigitalOcean OAuth, token paste), which stay recorded in FACT-0019 for a later decision.
- Stable named tunnels on the user's own domain, third-level domains under our zone, and a traffic relay are not the default. A "Connect Cloudflare" flow for stable tunnels is optional and depends on research (plan 8.1).

Supersedes the "no control plane" part of 0013: the directory is a metadata-only control plane, accepted for full automation.

## Verified constraints (FACT-0018)

- Quick tunnels are documented as testing/development with no uptime guarantee, so the tunnel provider stays pluggable (`TERMENBOX_TUNNEL=off` plus an own URL, named tunnels) and the risk is accepted knowingly.
- Idle WebSockets die at about 125 s; heartbeats under 100 s are mandatory (server 20 s, client 15 s).
- The server reads its URL from `cloudflared --metrics` (`/quicktunnel`), not from logs.
- The free request budget (100k/day) bounds the hosted directory to about 10^4 users unless polling is cheap; plan 8.2 and 8.4 poll with backoff.
- Cloudflare OAuth has Tunnel Write and DNS Write scopes, but a public hostname needs a zone the user owns, so "Connect Cloudflare" helps only users with a domain.

## Why

Third-level domains do not fit the free tier at 10^4-10^5 users (200-1,000 DNS records per zone, 50 certificates per week). User-owned tunnels cost nothing at any scale. A signed directory removes the print-a-link and type-a-URL steps without trusting the directory.
