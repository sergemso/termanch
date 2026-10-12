---
id: 0059-environment-profile-and-bundled-tools
title: The environment profile lives on the server and bundled tools update themselves
status: active
date: 2026-10-12
track: product
accepted-by: Sergey Strebulaev <s@vivantel.dev>
tags: [deployment, sessions, agents, roadmap]
---

## Decision

- The profile (tmux, herdr, zellij, claude, codex, extras) is `env.json` in the server's config dir. Only the authenticated owner changes it, from the app (`set_env`); the server applies it idempotently at start and on change, and streams progress.
- herdr ships in the image. A daily in-container updater downloads new release binaries into the persistent volume (checksum when published, previous version kept for rollback); CI also rebuilds the image weekly and on upstream releases.
- Updates are opt-in in host mode and signed/verified everywhere (0063); every host change is journaled (0067).
- In host mode the profile installs through the host package manager only for ticked components.

## Why

The profile must follow the owner across devices and survive browser changes, so it is server state. Daily pulls cost one GitHub API call per server; weekly rebuilds keep fresh installs current without in-container logic for the base. herdr's fit with the command backend is open (issue #22); its verdict gates this work.
