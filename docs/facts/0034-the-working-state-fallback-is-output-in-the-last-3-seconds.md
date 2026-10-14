---
id: 0034
title: Without a hook, "working" means the pane printed something in the last 3 seconds
status: active
tags: [agents, server]
date: 2026-10-14
kind: environmental
governed-by: TBD
last-verified: 2026-10-14
---

# Without a hook, "working" means the pane printed something in the last 3 seconds

`adapters::scan_state` uses tmux's `window_activity`. An agent's redraw after a resize or the echo of a key counts, so a waiting agent shows "working" for about 3 seconds after the user touches it. A bare resize does not (checked with tmux). Hook events override it.
