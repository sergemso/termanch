---
id: 0075-native-host-mode
title: Native host mode runs the server without Docker, as a systemd service
status: active
date: 2026-10-12
track: product
accepted-by: Sergey Strebulaev <s@vivantel.dev>
tags: [deployment, server, security]
---

## Decision

- Two modes remain: **Isolated container** (Docker, the default) and **This host** (native, no Docker). The privileged-container host mode of 0058 (`--pid=host --privileged`, `nsenter`) is **retired**; its code is removed after a deprecation window and installs are migrated (keys, owner and config kept).
- The native server is one static binary per architecture (x86_64, aarch64): musl, with no OpenSSL (`reqwest` moves to rustls; `str0m` already uses `aws-lc-rs`), so it runs on any Linux with nothing to install.
- It runs as a systemd service as `root` or as the dedicated `termenbox` user (0058 consent rules unchanged: the unprivileged user is pre-selected, root is an explicit choice). Hosts without systemd get a plain message pointing to the Docker install.
- Layout: binary `/usr/local/bin/termenbox-server` (root-owned), state and keys `/var/lib/termenbox` (owned by the run user), unit `termenbox.service`, root helper and journal under a root-only directory. tmux is installed with the host's package manager when missing (journaled).
- Sessions must survive a server restart or update: the unit uses `KillMode=process` and the tmux server starts in its own scope, as already needed for Docker host mode.
- The install command keeps the trailing words `host-user` and `host`; the installer now chooses the native path for them.

## Why

Docker was only ever a means to run the server; for a mode whose point is to reach the host, a privileged container is the wrong tool and needs Docker installed. A native service has less attack surface, starts faster, uses less memory (512 MB budget) and works on hosts where Docker is unwelcome. One static file keeps distribution simple. See [[0058-run-modes]], [[host-mode-explicit-consent]], [[0076-native-releases-and-updater]], [[0077-root-actions-by-request-file]].
