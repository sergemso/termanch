---
id: 0071-context-aware-key-row
title: The key row adapts to the detected multiplexer, with a sticky Prefix key
status: active
date: 2026-10-12
track: product
accepted-by: Sergey Strebulaev <s@vivantel.dev>
tags: [client, terminal, mobile, protocol]
---

## Decision

- The key row is data-driven by profile (shell, tmux, herdr), chosen from the multiplexer the server reports in `auth_ok`.
- tmux and herdr profiles add a **Prefix** key that works like the sticky Ctrl: tap it and the next key gets the prefix prepended. A second control opens a menu of common combos (next/previous window, new window, split, detach, copy mode).
- The server reads the real prefix (`tmux show -g prefix`, through the host-mode runner so it is the host user's tmux) and sends it with the multiplexer name. herdr's prefix follows the B.1 verdict (issue #22).
- User-editable macros are out of scope until settings sync exists (0068).

## Why

tmux's prefix is configurable, so a hardcoded Ctrl-b is wrong for some owners, and a phone has no easy chord entry; a sticky key plus a combo menu removes the awkward two-hand sequence. Related: [[0058-run-modes]].
