---
id: 0100-home-is-a-decision-first-board
title: Home is a decision-first board: what needs the user first, the fleet below
status: active
date: 2026-10-16
track: product
accepted-by: Sergey Strebulaev <s@vivantel.dev>
supersedes: [0088]
tags: [client, mobile, agents, roadmap]
---

## Decision

- The app opens on **Home**, on phone and desktop. Home has two parts: a **Needs you** queue (every open Attention item of kind `needs_input`, then `failed`, then `finished_unseen`, oldest wait first, across all servers) and a calm **fleet summary** below it (working, idle, done, per server and agent).
- Each queue item is a decision card (0104): answerable in place. Opening a session is a second step for the user who wants it, never the way to answer.
- With nothing to decide, Home shows the fleet and a **Continue** card for the session last used (the behaviour 0088 had, no longer the whole start screen).
- The queue obeys `ui-never-moves-under-the-finger`: items are inserted or reordered only when no touch is down and 2 s after a scroll.

## Why

The product's goal is zero-friction management and observation: the user should not have to know where to look. "Resume the last terminal" (0088) answers "where was I", not "what needs me", and forces find-the-session-then-act. Attention items already exist as server-owned state (0095), so Home needs no new data. Navigation in [[0101-navigation-bottom-bar-on-phone-workspace-on-desktop]]; cards in [[0104-decision-cards-carry-context-and-escalate]]; supersedes [[0088-the-start-screen-resumes-the-last-session]].
