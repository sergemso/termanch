---
id: 0064-directory-abuse-controls
title: The directory resists abuse and clients keep working when it is exhausted
status: active
date: 2026-10-12
track: product
accepted-by: Sergey Strebulaev <s@vivantel.dev>
tags: [directory, security, scale, roadmap]
---

## Decision

- A Cloudflare rate-limiting rule caps announce requests per IP.
- A new `server_id` must attach a small hashcash proof bound to the id and a day stamp; the cost is trivial for one server and large for mass registration. Existing per-source new-id limits stay.
- **Degraded mode:** the client keeps the last signed record per server and connects without the directory when it answers 429/5xx or times out; the static client keeps loading from Pages. Fresh installs cannot register while the directory is down, and say so.
- Usage alarm at 60% of the Workers limit (plan C.5); listing of the R2 bucket stays disabled.

## Why

Anyone can POST announces, and each costs a Worker request; 10^5 a day takes login, exchange and lookups down together (0060, fact 0022). See [[directory-request-budget]].
