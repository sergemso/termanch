---
id: updates-are-verified-and-reversible
title: Native updates are verified, reversible and stoppable
status: active
governed-by: 0076
grounded-in: 0076
derivation-note: An update channel is an attack channel and a failed update must not leave the owner without a server.
tags: [security, build, deployment]
---

# Guardrail: Native updates are verified, reversible and stoppable

## Rule
**MUST** verify the manifest signature and the binary hash before replacing the running binary. **MUST** keep the previous binary and roll back when the health check fails. **MUST** honour a signed `freeze` and **MUST NOT** apply an update the manifest marks as frozen. **MUST NOT** trust the download host.
