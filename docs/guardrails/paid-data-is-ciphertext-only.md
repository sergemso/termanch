---
id: paid-data-is-ciphertext-only
title: Paid-tier data is stored as ciphertext only
status: active
governed-by: 0090
grounded-in: [0090, 0068]
derivation-note: Terminal output can hold secrets; Pro stores history, inbox and usage only client-encrypted, so we never hold readable content.
tags: [tiers, privacy, security]
---

# Guardrail: Paid-tier data is stored as ciphertext only

## Rule
**MUST NOT** store or log terminal output, transcripts, prompts or usage in readable form in any service we run. Control-plane records may hold identity, entitlement, seat and rule-hit metadata, never content. Keys are never sent to us, and a recovery key is shown to the user once. See [[security-secrets-handling]] and [[usage-stays-on-device]].
