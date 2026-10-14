---
id: 0093-paid-tiers-are-built-after-the-free-gate
title: Paid tiers are designed now and built only after the free gate
status: active
date: 2026-10-14
track: process
accepted-by: Sergey Strebulaev <s@vivantel.dev>
tags: [tiers, roadmap]
---

## Decision

Tier design is recorded now (0089-0092, `docs/plans/termanch-roadmap.md`, steps R40-R48). No paid feature is built until the free gate passes: decision 0068 is accepted and shipped, the free Web Push and inbox path works, and the iPhone checks of the session-tabs work pass. Pro then starts with whichever of relay or history has real user demand. Enterprise starts only with a customer.

## Why

The first goal is free users, and one person's effort should not split away from the free baseline. Recording the design now keeps today's architecture (0068, 0061, 0067) compatible with the paid tiers.
