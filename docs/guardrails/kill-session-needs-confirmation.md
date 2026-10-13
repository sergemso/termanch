---
id: kill-session-needs-confirmation
title: Killing a session needs confirmation
status: active
governed-by: 0082
grounded-in: [0082]
derivation-note: Killing ends a running agent and cannot be undone, and phone taps are imprecise.
tags: [client, protocol]
---

# Guardrail: Killing a session needs confirmation

## Rule
**MUST** ask for confirmation before sending `close_session`, from the sidebar and the long-press menu alike. **MUST NOT** put a kill action on a tab.
