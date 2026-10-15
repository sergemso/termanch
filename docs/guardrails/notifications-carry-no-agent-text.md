---
id: notifications-carry-no-agent-text
title: A notification or push payload never carries anything the agent wrote
status: active
governed-by: 0095
grounded-in: [0023, 0066]
derivation-note: Given that push payloads pass through the browser vendor's service and may be cached or indexed (0095), and that task titles, prompts and messages are untrusted agent text that may hold secrets, the payload may name only the session and the kind of attention.
tags: [notifications, privacy, security]
---

# Guardrail: Notifications carry no agent text

## Rule
**MUST NOT** put task titles, prompts, tool arguments, messages or terminal text in a Web Push payload, a badge, or the audit log. **MAY** carry the session's display name, the Attention kind and a time.

## Check
A unit test builds a payload from an event whose title and prompt hold a marker string and asserts the marker is absent from the payload bytes.
