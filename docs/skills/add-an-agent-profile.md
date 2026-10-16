---
id: add-an-agent-profile
title: Add a T2 screen profile for an agent
status: active
date: 2026-10-16
tags: [agents, client, procedural]
---

# Procedure: Add a T2 screen profile for an agent

Use when a detected agent (see `packages/client/src/lib/agentIcons.ts`) only has the T3 generic view (decision 0103). The profile format is defined in the first profile step of `docs/plans/ux-programme.md`; follow that file's schema.

0. If the agent speaks ACP, first run `probe-an-agent-over-acp` so the profile can lean on structured data where it exists.
1. Run the agent in a throwaway tmux (`tmux -L scratch`), never the owner's sessions. Record screens for idle, working, a permission or choice prompt, a free-text question, and a finished task (`capture-pane -p -t =name:`). Save them under `packages/server/testdata/screens/<agent>-*.txt`.
2. Write the profile data file: how to recognise the agent, its prompt and numbered-option patterns, working and idle markers, the task line, and which keys answer each option.
3. Add tests that run the profile over the recorded screens and assert the parsed state, options and keys. Include a screen where nothing should match.
4. Check that parsed text is sanitised and that a profile cannot send keys beyond the options the screen showed.
5. Update facts 0038 and 0040 with what the agent exposes and the agent version measured.
