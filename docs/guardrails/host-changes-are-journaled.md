---
id: host-changes-are-journaled
title: Host changes are journaled and revertible
status: active
governed-by: 0067
grounded-in: 0067
derivation-note: Changes to a user's machine must be bounded and undoable.
tags: [safety, deployment]
---

# Guardrail: Host changes are journaled and revertible

## Rule
**MUST** record every package, user, file or container change made on the host in the journal before applying it. **MUST** offer a dry-run before installs. **MUST NOT** change the host outside the journal's scope.
