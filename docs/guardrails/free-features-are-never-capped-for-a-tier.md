---
id: free-features-are-never-capped-for-a-tier
title: A free feature is never removed or capped to create a paid tier
status: active
governed-by: 0089
grounded-in: [0089, 0035]
derivation-note: Tiers sell only what costs us to run (0089), so shipped free behaviour must not be limited to make room for one.
tags: [tiers, product]
---

# Guardrail: A free feature is never removed or capped to create a paid tier

## Rule
**MUST NOT** remove, degrade or add an artificial limit (seat, session, time or device count) to a feature that is free, in order to sell it. A feature moves to a paid tier only if it needs paid infrastructure or central coordination (fact 0035). Classify new features with `classify-a-feature-into-a-tier`.
