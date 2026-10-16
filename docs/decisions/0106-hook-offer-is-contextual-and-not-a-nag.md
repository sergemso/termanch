---
id: 0106-hook-offer-is-contextual-and-not-a-nag
title: Hooks are offered once, inline, in context, and never nagged
status: active
date: 2026-10-16
track: product
accepted-by: Sergey Strebulaev <s@vivantel.dev>
amends: [0079]
tags: [agents, hooks, client, roadmap]
---

## Decision

- Consent stays explicit and per agent (0079). The "Connect" action becomes a button: when the server first detects an agent with a verified hook surface, Home shows one inline card ("Get live task and one-tap answers for Claude Code") with a plain preview of the exact change (wrapped settings per `user-settings-are-wrapped-not-replaced`, journaled and revertible) and **Enable / Not now / Never**.
- **Not a nag:** the offer is an inline card, never a modal or a toast. "Not now" re-offers only after a trigger: the user answered a prompt in the terminal by hand, or 14 days passed. "Never" is permanent for that agent on that server and is reversible in Settings. The product works at T2 or T3 without hooks (0103).
- Settings always shows the current hook state per agent, with enable and remove.

## Why

The rich view and decision context need hooks; hunting through settings contradicts "users do not search for anything"; enabling by default would reverse 0079 and edit the user's agent config unasked. A contextual single offer with a firm anti-nag rule keeps consent and removes the hunt. The owner noted a recurring offer could become annoying, hence the trigger rule. Amends [[0079-agent-hooks-are-opt-in]] (its "Connect is a command" divergence is closed by the button).
