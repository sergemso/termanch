---
id: 0072-remote-uninstall
title: Remove server can uninstall the server in two stages, with host cleanup opt-in
status: active
date: 2026-10-12
track: product
accepted-by: Sergey Strebulaev <s@vivantel.dev>
tags: [deployment, security, client, protocol]
---

## Decision

- **Remove server** in the app offers, besides forgetting the server in this browser, an **Uninstall** that the connected server carries out.
- Stage 1, done by the server: wipe its config and data volume (keys, owner, claim, journal after use), remove its directory record with a message signed by the server key, and revert the journaled host changes it is allowed to (0067).
- Stage 2: in host mode the server also removes its own container and image through `nsenter`, as the last step after replying; in container mode it cannot reach its container, so the app shows one copy-paste command (container, image, `/opt/termenbox`). Container mode never gets Docker access.
- Host cleanup is opt-in checkboxes, all off by default: delete user `termenbox` and its home, uninstall tmux (only if the journal says we installed it), kill running sessions. Nothing holding the owner's work is removed unless ticked.
- Authorization: the owner's connection, the server name typed in the app, and a device certificate issued within the last hour (otherwise sign in again). Root host-mode servers also need the passkey step-up once S.2 exists. Each step is audit-logged without content.
- The certificate payload gains `iat` (additive, still `v: 1`) so a server can check freshness.

## Why

Forgetting a server in the browser leaves its keys, directory record and container behind, and users cannot be expected to clean them by hand. A confirmed, scoped, owner-only uninstall removes that debt while the stage split keeps container mode isolated (0058) and host cleanup cannot destroy repos by accident. See [[remote-uninstall-is-deliberate-and-scoped]], [[0067-change-journal-and-revert]].
