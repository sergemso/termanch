---
id: unprivileged-server-never-holds-root
title: An unprivileged server never holds a way to run root commands
status: active
governed-by: 0077
grounded-in: 0075
derivation-note: The dedicated user is chosen to limit a compromise; any sudo, setuid or root socket handed to it would undo that.
tags: [security, deployment]
---

# Guardrail: An unprivileged server never holds a way to run root commands

## Rule
**MUST NOT** create sudoers entries, setuid files or root-reachable sockets for the server's run user. **MUST** route root actions through the request-file handshake with a fixed action list. **MUST NOT** let the helper execute any command or path taken from a request.
