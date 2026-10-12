---
id: host-mode-explicit-consent
title: Host mode needs explicit consent and is audited
status: active
governed-by: 0058
grounded-in: 0058
derivation-note: Host mode gives the owner a shell on the VPS, so it must be an informed, owner-only choice.
tags: [security, deployment]
---

# Guardrail: Host mode needs explicit consent and is audited

## Rule
**MUST** default to container mode. **MUST** show a plain warning before the host-mode install command is offered. **MUST** restrict host sessions to the authenticated owner and write an audit entry (without session content) when a host session opens. **MUST NOT** enable host mode through a profile change or update.
