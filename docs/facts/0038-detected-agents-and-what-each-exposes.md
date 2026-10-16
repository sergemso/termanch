---
id: 0038
title: The client has icons for 11 agents, but only Claude Code has a verified event surface
status: active
tags: [agents, hooks, client]
date: 2026-10-16
kind: environmental
governed-by: 0103
last-verified: 2026-10-16
---

# The client has icons for 11 agents, but only Claude Code has a verified event surface

Read from `packages/client/src/lib/agentIcons.ts` on 2026-10-16: claude, codex, copilot, opencode, kilo, gemini, aider, cursor-agent, amp, goose, qwen. Fact 0029 measured hooks only for Claude Code (2.1.296); Codex's `notify` program is documented but unverified (R21); the other nine have not been looked at. The pane title is not a task source for Claude Code or Codex (fact 0036). So for nine of eleven agents the only data today is the process scan and the screen, which is why decision 0103 guarantees a T2 or T3 view per agent. Not measured: which of the nine expose hooks, logs or a JSON mode.
