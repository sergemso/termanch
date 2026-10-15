---
id: 0085-tabs-speak-for-one-window-and-detach-differs-from-close
title: A tab speaks for one tmux window, Detach differs from Close, and windows come from tmux control mode
status: active
accepted-by: Sergey Strebulaev <s@vivantel.dev>
date: 2026-10-13
track: product
tags: [client, mobile, agents, tmux, protocol]
---

## Decision (draft: needs the owner's acceptance)

- **A tab is the icon and working directory of one window of its session** (the representative window): the agent window with the latest output, else tmux's current window, else the first. Tabs have no rename and no copy-name. Tabs that would read the same add the session name. Labels never change under a finger (0082's frozen order).
- **Detach closes the tab and keeps the session running; Close session ends it** and asks first (guardrail `kill-session-needs-confirmation`). Detached sessions stay in the Sessions sheet and reappear as a tab while their agent needs you.
- **Windows come from tmux control mode** (`tmux -C`, tmux 3.2 or newer), one control client per session, used only as a change signal; the content is read with `list-panes`. Older tmux keeps the periodic scan and the app says why live window updates are off. The state scan (working/idle, prompts) is unchanged.
- **herdr is a session manager, not an agent.** Managers declare what they can do (windows, close, peek, send); the app hides what a manager cannot do.
- **On a phone the Sessions sheet is closed by default** and opened by the top bar's Sessions button (this narrows 0082's "peek, half, full": peek is no longer the resting state).
- A new session starts a known agent (a fixed list the server checks) in a chosen absolute directory; nothing else a client sends is run.

## Why

Parallel agents in one repository look identical by name; the directory and the agent window say what a tab is. Detach and Close are different intents and one button could not carry both safely. Control mode gives window changes without polling; bundling a pinned tmux stays a later option (the minimum version is the cost). A permanent sheet strip took 96 px of a phone screen that the terminal needs.

> Note (2026-10-15): Amended by 0097 (draft): the herdr bullet no longer applies.
