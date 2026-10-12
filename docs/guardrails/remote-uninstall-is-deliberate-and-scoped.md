---
id: remote-uninstall-is-deliberate-and-scoped
title: Remote uninstall is owner-only, confirmed, fresh and scoped
status: active
governed-by: 0072
grounded-in: 0072
derivation-note: Uninstall destroys keys and can destroy the owner's work, so it must be deliberate and limited to what we installed.
tags: [security, deployment, client]
---

# Guardrail: Remote uninstall is owner-only, confirmed, fresh and scoped

## Rule
**MUST** require the owner's connection, the typed server name and a certificate issued within the last hour. **MUST NOT** delete the host user, its home, or installed packages unless the owner ticked that option, and only packages the journal says we installed. **MUST NOT** give a container-mode server access to the Docker socket. **MUST** write an audit entry per step, without content.
