---
id: 0089-paid-tiers-sell-only-what-costs-us-to-run
title: Paid tiers sell only what costs us to run; the free product is never capped
status: active
date: 2026-10-14
track: product
accepted-by: Sergey Strebulaev <s@vivantel.dev>
tags: [tiers, billing, roadmap]
---

## Decision

- A feature may sit behind a paid tier only if running it needs infrastructure we pay for beyond free tiers (relay bandwidth, storage past R2's free quota, delivery and retention services) or central coordination across accounts.
- Everything that runs on the user's own server, device or our free-tier directory stays free: sessions, agents, tabs, notifications, settings and server-list sync (0068), session sharing (read-only and read-write), several users on one server, and isolated per-user environments.
- No artificial limits (one collaborator, a session cap, a time cap) are used to create a paid tier.

## Why

The first goal is free users' session management and agent operations at the largest scale free tiers allow. A cost-based line is easy to defend, matches MIT (0011) and the self-hosted promise, and keeps `no-paid-services` true: paid services are optional, never required. Isolated environments need root on the host, so they depend on host mode (0065), not on a tier. See [[free-features-are-never-capped-for-a-tier]].
