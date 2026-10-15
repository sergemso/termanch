---
id: 0097-herdr-is-removed
title: herdr is removed as a session manager and as a status source
status: active
date: 2026-10-15
track: product
accepted-by: Sergey Strebulaev <s@vivantel.dev>
tags: [agents, sessions, architecture, roadmap]
---

## Decision

- The owner does not use herdr. The server drops the herdr status poller, `HerdrBackend` and `TERMENBOX_BACKEND=herdr` (`auto` offers tmux only). The client drops the herdr icon and its manager-specific menu entries.
- The `command` backend of 0054 stays as the generic way to plug in another session manager; it just no longer names herdr.
- The agent list becomes Claude Code and Codex. Docs, README and tags stop naming herdr; the herdr rows leave facts 0029 and 0009 as history is in git.
- This amends 0054 (herdr as the example backend) and 0085 (the "herdr is a session manager" bullet); R24's herdr install entry goes with it.

## Why

A source nobody uses costs a poller, a backend, tests and docs, and it kept the status model from having one rule for every pane (hook, screen, scan). Removing it is cheap to reverse because the generic backend stays. Part of [[0095-agent-status-is-activity-plus-attention]]; amends [[0054-session-backends]] and [[0085-tabs-speak-for-one-window-and-detach-differs-from-close]].
