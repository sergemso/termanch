---
id: 0018
title: Quick Tunnel, Directory Budget and Cloudflare OAuth Limits
status: active
tags: [networking, cloudflare, limits, tunnels]
date: 2026-10-11
---

# Quick Tunnel, Directory Budget and Cloudflare OAuth Limits

Verified 2026-10-11 (plan step 8.1). "Tested" means run here against real Cloudflare with `cloudflared` 2026.10.0.

## Quick tunnels (trycloudflare)

- Docs: no uptime guarantee; up to 200 in-flight requests per tunnel (more get HTTP 429); no Server-Sent Events; the URL changes on every new tunnel; meant for testing and development, with a named tunnel recommended for production ([docs](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/)). The page says nothing on WebSockets or terms of service.
- Tested: WebSockets work through a quick tunnel, including echo of messages.
- Tested: a WebSocket with no frames in either direction was dropped (code 1006) at about 125 s. One where the server sent a WebSocket ping every 20 s survived the full 240 s test. Heartbeats shorter than 100 s are therefore required; the server pings every 20 s and the client every 15 s (plan 2.2).
- Tested: with `cloudflared tunnel --metrics 127.0.0.1:PORT --url ...`, `GET /quicktunnel` returns `{"hostname":"<name>.trycloudflare.com"}` and `GET /ready` returns `{"status":200,"readyConnections":N,...}`. The server can read its URL and health from there.
- Consequence: quick tunnels are not a production-grade, Cloudflare-endorsed path. The design must keep the tunnel pluggable (own URL, named tunnel) and treat a Cloudflare policy or availability change as a risk.

## Free-tier budget for the directory

- Workers Free (shared by Pages Functions): 100,000 requests per day, 10 ms CPU per request, 50 subrequests per request; static assets are free and unlimited ([limits](https://developers.cloudflare.com/workers/platform/limits/), [Pages pricing](https://developers.cloudflare.com/pages/functions/pricing/)).
- D1 Free: 5 million rows read and 100,000 rows written per day, 500 MB per database, 5 GB total, 10 databases ([pricing](https://developers.cloudflare.com/d1/platform/pricing/), [limits](https://developers.cloudflare.com/d1/platform/limits/)).
- Request volume is the constraint, not D1. Per user: one OAuth exchange per login, one announce per tunnel restart, one lookup per failed reconnect, and onboarding polling (30 requests at one per 2 s over a minute). At 10^4 users this fits; at 10^5 the daily 100k requests is tight. Mitigate with long-polling or backoff on `pending`, no polling in steady state, and a paid Workers plan or per-deployment quota (self-hosted mode has its own account) when the hosted client outgrows it.

## Cloudflare OAuth

- Scopes exist for tunnels and DNS: "Cloudflare Tunnel Write", "Cloudflare Tunnel Read", "DNS Write", "DNS Read", "Cloudflare One Connector: cloudflared Write" (read from `GET /client/v4/oauth/scopes`, 395 scopes in total).
- Public clients (browser, CLI) use PKCE S256 and no client secret; confidential clients may keep a secret. Public visibility requires a TXT record proving domain ownership, which Cloudflare polls for up to two days. Private clients work only for members of the creating account ([docs](https://developers.cloudflare.com/fundamentals/oauth/create-an-oauth-client/index.md)).
- Endpoints: `https://dash.cloudflare.com/oauth2/auth`, `/oauth2/token`, `/oauth2/revoke` ([docs](https://developers.cloudflare.com/fundamentals/oauth/integrate-with-cloudflare/index.md)).
- Not found: token and refresh lifetimes; whether a named tunnel's public hostname can exist without a zone in the user's account. Without a zone, a named tunnel has no public hostname, so a "Connect Cloudflare" flow helps only users who own a domain on Cloudflare.
- Not tested: Cloudflare Tunnel limits on the number of tunnels per free account.
