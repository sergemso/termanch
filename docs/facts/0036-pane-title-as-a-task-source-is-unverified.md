---
id: 0036
title: The task name without a hook would come from tmux's pane title, which is not yet measured
status: active
tags: [agents, server]
date: 2026-10-15
kind: environmental
governed-by: 0095
last-verified: never
---

# The task name without a hook would come from tmux's pane title, which is not yet measured

Decision 0095 reads `#{pane_title}` (added to the existing `list-panes` format) as the task title for panes with no hook. Whether Claude Code and Codex write their current task there, in which form (spinner glyph, prefix), and how often it changes has **not been measured**. Plan step A.1 measures it in a throwaway tmux; until then treat the source as best effort. A hook gives the title from the prompt (fact 0029: `UserPromptSubmit`), which is untrusted agent text.
