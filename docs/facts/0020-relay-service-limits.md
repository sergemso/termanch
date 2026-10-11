---
id: 0020
title: Free Relay Service Limits for Terminal Traffic
status: active
tags: [networking, limits, relay]
date: 2026-10-11
---

# Free Relay Service Limits for Terminal Traffic

Researched 2026-10-11. Model: a relay carries every terminal byte; 10 messages/s average while a session is active, 1 active hour per user per day = 36,000 messages per user per day. Halve or double the rate and the results scale linearly.

| Service | Free limits | Concurrent sessions | Daily active users |
|---|---|---|---|
| Ably | 6M messages/month, 500 msg/s, 200 connections, 200 channels ([source](https://ably.com/docs/platform/pricing/free)) | about 100 | about 5 (about 3 if each delivery counts as a message; unverified) |
| Pusher Sandbox | 200k messages/day, 100 connections ([source](https://www.pusher.com/channels/pricing)) | about 50 | about 5 |
| PubNub | 200 MAU, 1M transactions/month | not stated | about 1 |
| Supabase Realtime | about 200 concurrent clients; message limits differ by source ([source](https://supabase.com/docs/guides/realtime/limits)) | about 100 | not computable |
| Cloudflare Durable Objects | 100k requests/day with incoming WebSocket messages billed 20:1, 13,000 GB-s/day ([source](https://developers.cloudflare.com/durable-objects/platform/pricing)) | duration-bound | about 28 (assumes 128 MB per object) |

Relays also see plaintext and cannot serve as the directory (a persistent subscriber per client exceeds connection caps). Direct transport has no per-message cost (DECISION-0057).
