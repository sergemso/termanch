---
id: classify-a-feature-into-a-tier
title: Classify a feature into free, Pro, Team or Enterprise
status: active
date: 2026-10-14
tags: [tiers, procedural]
operationalizes: [free-features-are-never-capped-for-a-tier, paid-data-is-ciphertext-only]
---

# Classify a feature into free, Pro, Team or Enterprise

Ask in order; the first yes decides.

1. Does it run on the user's server, device or our free-tier directory/R2 within fact 0022's limits? **Free.** Stop; never cap it.
2. Does it need bandwidth, storage or delivery we pay for beyond free tiers, for one person? **Pro**, client-encrypted (0090).
3. Does it need central state across accounts: organisation, seats, shared directory, shared history? **Team** (0091).
4. Is it identity federation, central audit retention or support? **Enterprise** (0091). Enforcement stays on the host.
5. Would it need readable content on our side? Redesign it to run on the device or host; do not ship it.

Record the result in fact 0035's table. A change of tier needs a decision.
