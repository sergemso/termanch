---
id: user-settings-are-wrapped-not-replaced
title: Termanch adds to a user's agent settings and never replaces what is there
status: active
governed-by: 0083
grounded-in: [0083]
derivation-note: Given that Connect edits another program's settings (0079, 0083), the user's own entries must keep working and come back unchanged.
tags: [hooks, security]
---

# Guardrail: User settings are wrapped, not replaced

## Rule
**MUST** keep every existing hook and `statusLine` command working: add our entries beside them, wrap an existing `statusLine` command and pass its output through unchanged. **MUST** show the exact change before writing, keep a backup, and restore the original bytes on Disconnect when nothing else changed. **MUST NOT** forward more than the fields it is documented to forward.
