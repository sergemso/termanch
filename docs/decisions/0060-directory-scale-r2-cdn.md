---
id: 0060-directory-scale-r2-cdn
title: The directory serves at least 10^5 servers on free tiers, with public records on R2 behind the CDN
status: active
date: 2026-10-12
track: product
accepted-by: Sergey Strebulaev <s@vivantel.dev>
tags: [directory, scale, networking, roadmap]
---

## Decision

- 10^5 users with one server each is the **floor**, not a ceiling; the design must keep marginal growth off the 100k requests/day Workers limit.
- Signed records are public objects in an R2 bucket on a custom domain with a Cache Rule (about 1 h edge TTL). Lookups hit the CDN, not a Worker. A failed connect retries with `?v=<seq>` to bypass a stale copy; signatures make stale records harmless.
- Workers handle only announces (R2 write), OAuth and the owner's server list.
- Servers announce on change (IP, port, fingerprint, claim) plus a 7-day keepalive. "Online" is learned from the connection attempt, not from the directory.
- The owner's list (server ids and names, no secrets) is keyed by GitHub id, returned in the OAuth exchange response and cached 1 h in the browser.
- A spike verifies R2 free limits and CDN caching on the custom domain before migration; D1 stays until it passes.

## Why

Today's 12 h keepalive alone costs about 2·10^5 requests/day at 10^5 servers, over the limit. Public signed objects are cacheable and verified client-side, so the CDN can absorb reads for free. Builds on 0056 and 0057; see [[0022]] and [[directory-request-budget]].
