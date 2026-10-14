---
id: 0092-billing-starts-with-github-sponsors
title: Billing starts with GitHub Sponsors; a merchant of record arrives with Team
status: active
date: 2026-10-14
track: product
accepted-by: Sergey Strebulaev <s@vivantel.dev>
tags: [billing, tiers, auth]
---

## Decision

- Pro is sold through GitHub Sponsors tiers. A sponsorship webhook sets the entitlement on the sponsor's GitHub id in the directory (0053 binds servers to that id). Entitlements are small records in the existing directory store (0022).
- A merchant of record (Paddle or Lemon Squeezy) is added only when Team needs seats and invoices. The entitlement record is the same either way, so only the source of the webhook changes.
- We never handle card data.

## Why

Users already sign in with GitHub, so Sponsors needs no new account and fits 0073's existing Sponsors link. Seat billing, tax and invoices are the point where Sponsors stops being enough. This is the cheapest start; the cost is a later migration of the billing source.
