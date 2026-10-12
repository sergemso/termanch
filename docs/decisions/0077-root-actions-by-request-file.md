---
id: 0077-root-actions-by-request-file
title: An unprivileged server asks for root actions through a request file, never through sudo
status: active
date: 2026-10-12
track: product
accepted-by: Sergey Strebulaev <s@vivantel.dev>
tags: [security, deployment, protocol]
---

## Decision

- Actions that need root on a native host (update now, uninstall) are requested by the server writing a small request file into a directory only the run user and root can use. A root-owned systemd path unit starts the root helper, which validates the request and acts.
- The helper accepts a fixed list of actions (`update-now`, `uninstall` with its flags), checks the request against the journal's scope (0067) and ignores anything else. It never runs commands taken from the file.
- The server writes a request only after the owner checks of 0072 (owner connection, typed server name, fresh sign-in; passkey step-up for root servers once S.2 exists).
- No sudoers rules, setuid binaries or root sockets are created for the server user.
- The same helper performs the updater's work (0076) and the host cleanup of remote uninstall (0072).

## Why

The dedicated-user install exists so a compromised server cannot do what root can. A file-and-path-unit handshake lets the app trigger the two actions the owner needs without giving the server any way to run arbitrary root commands. See [[unprivileged-server-never-holds-root]], [[remote-uninstall-is-deliberate-and-scoped]].
