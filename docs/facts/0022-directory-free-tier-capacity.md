---
id: 0022
title: Directory free-tier capacity
status: active
tags: [directory, scale, cloudflare]
date: 2026-10-12
---

# Directory free-tier capacity

Limits as recalled on 2026-10-12, **not re-verified** (the spike in 0060 must confirm): Workers/Pages Functions 100k requests/day; D1 5M reads/day, 100k writes/day, 5 GB; R2 10 GB, 1M class A and 10M class B operations/month, free egress; static assets and CDN-cached public objects do not count as Functions requests.

Current behaviour (`directory.rs`): a claimed server announces every 12 h, an unclaimed one every 5 min. That is 2 requests/day/server, so 10^5 servers cost 2·10^5/day, over the limit; the binding limit is Workers requests (about 10^4 servers with the other traffic).

Target (0060): announce on change plus a 7-day keepalive is about 1.4·10^4/day at 10^5 servers; with 20% daily actives opening the app twice, about 4·10^4; total about 5.5·10^4/day (55% of the limit). D1 writes stay below 2·10^4/day and storage near 50 MB.
