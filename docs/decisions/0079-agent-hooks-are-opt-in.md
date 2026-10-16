---
id: 0079-agent-hooks-are-opt-in
title: Agent hooks are installed only on the owner's explicit request, and the layer works without them
status: active
accepted-by: Sergey Strebulaev <s@vivantel.dev>
date: 2026-10-13
track: product
tags: [agents, hooks, security, roadmap]
---

## Decision (draft: needs the owner's acceptance)

- The agent event layer (plan `termenbox-v6-agent-events.md`) works with no configuration, from the process scan and screen heuristics of 0061. Hooks only raise precision.
- Installing a hook into a tool's settings in the user's home (for example Claude Code's `settings.json`) is an explicit "Connect <tool>" action. It previews the exact change, backs the file up, journals it (guardrail `host-changes-are-journaled`) and can be removed from the app. An update never edits those files.
- A hook script never blocks or fails the agent: it has a short timeout, writes to the server's local socket, and exits 0 when the server is down.
- Hooks are not offered in container mode unless the sessions' home belongs to Termenbox.
- ACP (a tool run as a managed child process, not a TUI) is out of scope for this layer; it would be a separate session backend under 0054 with its own decision.

## Amended 2026-10-16

"Connect" becomes a contextual one-tap offer with an anti-nag rule: see [[0106-hook-offer-is-contextual-and-not-a-nag]].

## Why

Editing another program's settings is a change on the owner's machine they did not ask for unless they ask. The scan floor keeps cards useful for everyone, and fail-open hooks mean a Termenbox outage never stalls an agent mid-task.

## Where the first implementation differs (2026-10-13, for the owner to accept or correct)

- "Connect" is a command (`--connect-claude --yes`), not a button in the client.
- The change is recorded in the user's own `claude-hooks.json` beside a backup, not in the root-only journal of 0067, which the user the hooks belong to cannot write.
- The command does not refuse container mode; sessions created by Termenbox carry the event variables, but the settings file edited is the invoking user's.
