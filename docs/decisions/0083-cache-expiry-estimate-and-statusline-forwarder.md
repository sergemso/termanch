---
id: 0083-cache-expiry-estimate-and-statusline-forwarder
title: Prompt-cache expiry is an estimate, made exact by a wrapped status line forwarder
status: active
date: 2026-10-13
track: product
accepted-by: Sergey Strebulaev <s@vivantel.dev>
tags: [agents, hooks, privacy]
---

## Decision

- **Estimate always:** cache time left is the TTL minus the time since the agent's last response. The TTL is a setting, 5 minutes by default, 1 hour as the other choice. The interface says "about" while it is an estimate.
- **Exact when connected:** Connect (0079) also installs a Termenbox forwarder as Claude Code's `statusLine` command, the same mechanism Claude Code uses for status lines (fact 0031). It forwards only `prompt_cache` (expiry, TTL, warm, hit ratio) as a new `cache` event over the local socket, with a 2 s cap, never failing, then runs the user's original `statusLine` command with the same input and prints its output unchanged. Model, cost, paths and everything else in that JSON are not forwarded. Exact data replaces the estimate and the "about" goes away.
- **Reversible and shown first:** the preview shows both commands before anything is written; Disconnect restores the original setting byte for byte under the same backup and journal rule as the hooks. See [[user-settings-are-wrapped-not-replaced]].
- **Keep warm is a deliberate tap.** The cache-expiring nudge offers it; nothing is ever sent automatically.

## Why

The cache decides what resuming an idle agent costs, so "which idle agent loses its cache first" is worth sorting by. Claude Code publishes the exact expiry only to the status line command, which the owner already uses for their own, so wrapping it gives exactness without taking it away. Without the hook the estimate still works for any agent. Builds on [[0079-agent-hooks-are-opt-in]] (draft: its consent also covers this second setting).
