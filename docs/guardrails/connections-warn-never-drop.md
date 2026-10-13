---
id: connections-warn-never-drop
title: Connections are limited by warning, never by dropping
status: active
governed-by: 0082
grounded-in: [0082]
derivation-note: Servers now connect automatically (0082), so the soft limit of 6 must still warn and never drop.
tags: [client, mobile, performance]
---

# Guardrail: Connections are limited by warning, never by dropping

## Rule
**MUST NOT** disconnect a server without the owner's action. **MUST** show the connected count and a Manage connections action once more than 6 servers are connected, at app start and when a server is added or connected. **MUST** send background heartbeats only while the page is visible.
