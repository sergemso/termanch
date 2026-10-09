---
id: 0007
title: PTY Wrapper with Shell Hooks for Agent Integration
status: active
track: product
tags: [agents, integration, pty, hooks]
date: 2026-10-09
accepted-by: architect
---

# Decision: PTY Wrapper with Shell Config Hooks for Agent Detection

## Context
Termanch must integrate with AI coding agents (Codex, Claude Code, Herdr) to provide:
- Chat View: agent events as cards (not raw TUI)
- Diff Viewer: intercept git changes
- Live Activity: notifications on agent completion/confirmation
- Auto-detect running agents

## Decision
**Three-component architecture**:

1. **termanch-agent** (Rust daemon):
   - Owns the PTY (spawns user's `$SHELL`)
   - Reads PTY output → feeds SSP buffer
   - Listens on Unix socket `~/.termanch/agent.sock` for structured events

2. **Shell hooks** (installed by `termanch-hook install`):
   - Bash: `PROMPT_COMMAND` + `preexec` (via `bash-preexec.sh`)
   - Zsh: `precmd` + `preexec`
   - Fish: `fish_prompt` + `fish_preexec`
   - Emit OSC 1337 sequences for prompt markers (start/end/command)
   - Wrapper functions for `codex`, `claude`, `herdr` that notify agent socket

3. **Agent detection**:
   - `ps` scan for known process names + env vars (`CODEX_SESSION_ID`, etc.)
   - PTY output parsing for agent-specific ANSI sequences
   - Hook events correlated with PTY output to attribute output to agents

**Event types** over Unix socket:
- `AgentSpawned { agent, pid, cwd, session_id }`
- `AgentOutput { agent, stream, data, ansi }`
- `AgentConfirmation { agent, prompt, choices, callback_id }`
- `AgentCompletion { agent, exit_code }`
- `GitDiff { files: [{ path, added, removed }] }`

## Rationale
- **PTY ownership** gives full output capture (no log tailing race conditions)
- **Shell hooks** are portable, no LD_PRELOAD/ptrace needed
- **Unix socket** is lightweight, no network stack, filesystem permissions for auth
- **OSC 1337** is standard (supported by iTerm2, WezTerm, mintty) — degrades gracefully

## Tradeoffs
| Approach | Pros | Cons |
|---|---|---|
| PTY wrapper + hooks (chosen) | Full capture, portable, structured events | Requires shell config install |
| Process scan + log tail | No install needed | Races, misses output, no structure |
| LD_PRELOAD | Comprehensive | Linux-only, complex, security risk |
| Agent-specific APIs | Clean | Vendor lock-in, not all have APIs |

## Consequences
- `termanch-hook` CLI handles install/uninstall per shell
- Hooks detect shell type automatically
- Agent socket protected by `chmod 600` + uid check
- WASM client subscribes to agent events via server WebSocket stream
- Chat View renders `AgentConfirmation` as interactive cards