---
id: 0035
title: Which tier features need infrastructure beyond free tiers
status: active
tags: [tiers, scale, cloudflare, capacity]
date: 2026-10-14
---

# Which tier features need infrastructure beyond free tiers

Limits are those of fact 0022 (fetched 2026-10-12). Costs of the paid alternatives are not researched.

| Feature | Why it exceeds free tiers | Tier |
|---|---|---|
| Server list and settings sync | One small encrypted R2 object per user; fits R2's 10 GB and the Workers budget (0022) | free (0068) |
| Session sharing, shared servers, isolated environments | Run on the user's server; the directory only brokers identity | free |
| Managed relay | Carries terminal traffic: bandwidth and a long-lived connection per session; Workers cannot hold it within the 10 ms CPU limit. Fact 0025 compared relay options | Pro |
| Cloud session history | Transcripts grow without bound; R2's 10 GB is shared by all users | Pro |
| Reliable push and inbox | Retention plus delivery independent of the server; Web Push itself is free | Pro |
| Fleet view and reports | Reads many servers' data and keeps it centrally, encrypted | Pro |
| Organisation, seats, SSO, audit retention | Central state across accounts, and a vendor for billing | Team / Enterprise |

Not verified: the price of a relay at 10^4 users, and R2's payment-method requirement (0022, 0024).
