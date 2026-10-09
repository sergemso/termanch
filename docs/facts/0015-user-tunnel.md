---
id: 0015
title: User-Managed Cloudflare Tunnel
status: active
tags: [deployment, networking]
date: 2026-10-09
---

# Fact: User-Managed Cloudflare Tunnel

Users deploy `cloudflared` alongside `termanch-server` in Docker Compose.

## Options (User Chooses)

### Option A: trycloudflare (Zero Config, Ephemeral)
```yaml
cloudflared:
  image: cloudflare/cloudflared
  command: tunnel --no-autoupdate --url http://termanch-server:8080
```
- No Cloudflare account needed
- URL changes on container restart
- Good for testing

### Option B: Named Tunnel (Persistent, Custom Domain)
```yaml
cloudflared:
  image: cloudflare/cloudflared
  command: tunnel --no-autoupdate run --token ${CLOUDFLARE_TUNNEL_TOKEN}
```
- Requires user's Cloudflare account (free)
- Persistent URL: `https://termanch.userdomain.com`
- User creates tunnel in their dashboard, pastes token in `.env`

## Termanch Does NOT
- Create tunnels for users
- Host tunnels in Termanch account
- Know user VPS IPs
- Manage tunnel lifecycle

## Client Behavior
- Accepts any `wss://` URL returned by server at registration
- No tunnel-specific logic
- Works with both trycloudflare and named tunnels