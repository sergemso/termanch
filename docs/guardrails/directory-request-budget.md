---
id: directory-request-budget
title: The directory stays within the free request budget at 10^5 servers
status: active
governed-by: 0060
grounded-in: 0060
derivation-note: The 100k/day Workers limit is the binding free-tier constraint, and 10^5 servers is the committed floor.
tags: [directory, scale, cost]
---

# Guardrail: The directory stays within the free request budget at 10^5 servers

## Rule
**MUST** keep modelled daily Workers requests at 10^5 servers below 60% of the free limit (see fact 0022). **MUST NOT** add a per-server periodic request shorter than the 7-day keepalive, or a Worker request on the connect path that a cached record can serve. Any change that adds directory traffic updates the model in fact 0022 in the same pull request.
