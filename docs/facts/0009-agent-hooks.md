---
id: 0009
title: Agent Detection and Hooking
status: active
tags: [agents, integration, hooks, pty]
date: 2026-10-09
---

# Agent Detection and Hooking

**Approach**: PTY wrapper + shell config hooks + Unix socket event bus

**Components**:

1. **termanch-agent** (daemon):
   - Owns the PTY (spawns user's shell)
   - Reads PTY output → feeds to SSP buffer
   - Listens on Unix socket (`~/.termanch/agent.sock`) for hook events

2. **Shell hooks** (installed in `~/.bashrc`, `~/.zshrc`, `~/.config/fish/config.fish`):
   - `PROMPT_COMMAND` / `precmd` / `fish_prompt` emit OSC 1337 sequences for prompt markers
   - `preexec` / `preexec_interactive` capture command start
   - Wrapper functions for `codex`, `claude`, `herdr` that notify agent socket on spawn/exit

3. **Agent detection**:
   - Scan `ps` for known agent process names
   - Parse agent-specific env vars (`CODEX_SESSION_ID`, `CLAUDE_SESSION_ID`)
   - Hook stdout/stderr via PTY to capture structured output

4. **Event types** sent over Unix socket:
   - `AgentSpawned { agent, pid, cwd }`
   - `AgentOutput { agent, stream, data }`
   - `AgentCompletion { agent, exit_code }`
   - `AgentConfirmation { agent, prompt, choices }`
   - `GitDiff { files[] }`