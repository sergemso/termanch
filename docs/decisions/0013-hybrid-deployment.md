---
id: 0013
title: User Self-Hosted Server with Hosted Client
status: active
track: product
accepted-by: architect
date: 2026-10-09
---

# Decision: Hybrid Deployment — User-Hosted Server, Termanch-Hosted Client

## Context
Termanch must be self-hostable with zero subscriptions. Users deploy the server to their own VPS. Termanch hosts the client at `app.termanch.dev`.

## Decision
- **Client**: Hosted by Termanch on Cloudflare Pages (our account, free tier)
- **Server**: Deployed by user to their own VPS via Docker Compose
- **Tunnel**: User manages their own Cloudflare Tunnel (free: trycloudflare or named tunnel on their account)
- **Auth**: GitHub OAuth via Termanch's OAuth app (our app, free)
- **Registration**: QR code + HMAC token — no control plane, no Termanch backend tracking user servers

## Rationale
- **Zero cost to Termanch**: Cloudflare Pages free tier hosts client; no per-user infrastructure
- **Zero cost to user**: Only their VPS ($5/mo). Cloudflare Tunnel free tier. GitHub OAuth free.
- **Privacy**: User data never touches Termanch infrastructure
- **No vendor lock-in**: User owns their server, can migrate anytime
- **Scales infinitely**: No control plane bottleneck

## Consequences
- No central server registry — client discovers servers via QR registration flow
- No per-server monitoring/management from Termanch
- User responsible for VPS security, updates, backups
- Termanch only hosts static client assets + OAuth app