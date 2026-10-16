---
id: 0104-decision-cards-carry-context-and-escalate
title: Decision cards carry context, and unanswered decisions escalate by a ladder with a deep-link push
status: active
date: 2026-10-16
track: product
accepted-by: Sergey Strebulaev <s@vivantel.dev>
tags: [agents, notifications, client, roadmap]
---

## Decision

- A **decision card** shows: what is being asked in plain terms (command, file or diff summary), the task it belongs to, how long it has waited, the agent's own options as large buttons, and a free-text reply (0102). With T1 data the context comes from hook payloads; at T2 or T3 it is the parsed prompt. Agent text is rendered as untrusted text.
- Standing rules ("always allow this kind of thing") and batch approve are **not** part of this decision; they overlap the rules engine (R11, R16) and need their own threat review.
- **Escalation ladder** on a rising edge of `needs_input` (extends 0095): push says only "session X needs you" (`notifications-carry-no-agent-text`) and deep-links onto that card, scrolled to the choices, behind the app's unlock if one is set. If unanswered, re-notify after a user-set wait (default 10 minutes), then at growing intervals, with quiet hours and per-agent mute. Answering anywhere on any device ends the ladder.
- No lock-screen Approve/Deny actions: approving blind from a notification is the mistake this design avoids.
- The ladder runs on the server's push path (A.6 of the status redesign); where push is not installed the in-app inbox, banner and tab-title count carry it.

## Why

A decision-first home (0100) fails if a missed push leaves an agent blocked unnoticed, and a quick answer is only safe when the user can see what they are approving. Context needs T1 data, so [[0106-hook-offer-is-contextual-and-not-a-nag]] matters. Builds on [[0095-agent-status-is-activity-plus-attention]]; guardrail [[notifications-carry-no-agent-text]] stands.
