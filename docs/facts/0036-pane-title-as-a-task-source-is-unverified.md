---
id: 0036
title: The task name without a hook would come from tmux's pane title, which does not track the task
status: active
tags: [agents, server]
date: 2026-10-15
kind: environmental
governed-by: 0095
last-verified: 2026-10-15
---

# The task name without a hook would come from tmux's pane title, which does not track the task

Decision 0095 reads `#{pane_title}` (added to the existing `list-panes` format) as the task title for panes with no hook. Whether Claude Code and Codex write their current task there, in which form (spinner glyph, prefix), and how often it changes has **not been measured**. Plan step A.1 measures it in a throwaway tmux; until then treat the source as best effort. A hook gives the title from the prompt (fact 0029: `UserPromptSubmit`), which is untrusted agent text.

**Measured on 2026-10-15 (plan A.1)**, tmux 3.6, samples in `packages/server/testdata/titles/README.md`. A pane that prints `ESC ] 0 ; text BEL` shows that text in `#{pane_title}`, so the read path works. Claude Code 2.1.300 writes `✳ Claude Code` when idle and, after the first prompt, a short model-written summary of it (`✳ Touch made-by-a1.txt file`); it then stays that for later prompts and does not show working, idle or a spinner. Codex 0.162.1 writes the directory name and never changes it. So the pane title is at best a per-session topic from Claude Code, not the current task, and the server does not use it as a task source (plan A.3 takes the task from `UserPromptSubmit` and the plan). A Claude Code permission prompt was not sampled (auto mode).
