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

**Partly measured on 2026-10-15 (plan A.1):** on tmux 3.6 a pane that prints `ESC ] 0 ; text BEL` shows that text in `#{pane_title}` of `list-panes -a`, so the read path works. What Claude Code and Codex actually write could not be measured: the `claude` binary on the build host is not installed (its postinstall did not run) and `codex` is absent. So `last-verified` stays `never`, no samples are stored under `testdata/titles/`, and the server does not use the pane title as a task source (plan A.3 takes the task from `UserPromptSubmit` and the plan only). Re-run the measurement on a host where the tools work before adding that source.
