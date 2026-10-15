---
id: github-token-stays-in-browser
title: The GitHub token never goes to a server
status: active
governed-by: 0062
grounded-in: 0062
derivation-note: A token sent to a server can be replayed against the user's other servers.
tags: [security, auth]
---

# Guardrail: The GitHub token never goes to a server

## Rule
**MUST NOT** send the GitHub access token to `termenbox-server` or write it to a server log. **MUST** authenticate to servers with a device certificate and a challenge signature bound to the `server_id`.
