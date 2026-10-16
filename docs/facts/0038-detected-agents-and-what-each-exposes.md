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

Icons read from `packages/client/src/lib/agentIcons.ts` on 2026-10-16: claude, codex, copilot, opencode, kilo, gemini, aider, cursor-agent, amp, goose, qwen. The pane title is not a task source for Claude Code or Codex (fact 0036). Decision 0103 guarantees a T2 or T3 view per agent, so agents with no surface rely on the process scan and the screen.

## Measured 2026-10-16

Method: version from `--version`; hooks, notify and JSON mode from `--help` and `features list`; ACP by sending `initialize` over stdio from a throwaway script with a scratch `HOME` (no login, no owner sessions). Not measured for any agent: which of `plan`, `usage_update`, `session_info_update` and `session/request_permission` it actually sends (needs a logged-in prompt), and the terms on driving it through an adapter (not checked).

| Agent | Version | Hooks | Notify | Log / JSON mode | ACP command | ACP `initialize` capabilities |
|---|---|---|---|---|---|---|
| claude | 2.1.301 | yes (fact 0029) | no | transcript file; `--output-format stream-json` | adapter `@zed-industries/claude-code-acp` 0.16.2 | `loadSession`; fork, list, resume; no `close` |
| codex | 0.162.1 | `hooks` feature, stable | `notify` program (unverified, R21) | `codex exec --json`; app-server | adapter `@zed-industries/codex-acp` 0.16.0 | `loadSession`; list, resume, close |
| copilot | 1.0.98 | not seen in help | not seen | `--output-format json` (JSONL), `--log-dir` | native `copilot --acp` | `loadSession`; list, close; no resume |
| opencode | 2.0.29 | not seen in help | not seen | `run --format json`; `serve` API | native `opencode acp` | `loadSession`; additionalDirectories, close, delete, fork, list, resume |
| kilo | 7.6.2 | not seen in help | not seen | `run --format json`; `serve`, `export` | native `kilo acp` | `loadSession`; close, fork, list, resume |
| gemini | 0.64.0 | `gemini hooks` | not seen | `-o json` or `stream-json` | native `gemini --acp` | `loadSession` only |
| qwen | 0.25.2 | `qwen hooks` | not seen | telemetry outfile only | native `qwen --acp` | `loadSession`; list, resume |
| aider | 0.86.2 | not seen | `--notifications-command` runs a program when it waits for input | `--chat-history-file`, `--input-history-file` | no (not on the official list; no `acp` command) | n/a |
| cursor-agent | 2026.10.16-e3cb207 | not seen in help | not seen | `--print --output-format json` or `stream-json` | native `cursor-agent acp` | `loadSession`; list; no resume or close |
| amp | 0.0.1792179105-gcb8fd7 | plugins API (`amp plugins`, `show-docs`; not examined) | not seen | `amp threads export` (JSON) | no (`--acp` and `acp` rejected) | n/a |
| goose | 1.55.0 | not seen | not seen | `run --output-format json` or `stream-json` | native `goose acp` (and `goose serve` over HTTP/WebSocket) | `loadSession`; list, delete, close; no resume |

All eleven installed on 2026-10-16 (aider, cursor-agent, goose and amp by the owner from their official installers). Auth: the claude and codex adapters reuse the agent's own login (codex-acp also takes `CODEX_API_KEY` or `OPENAI_API_KEY`); opencode, kilo and copilot need their own `login`; gemini needs a Google login, API key or Vertex; qwen needs an OpenAI-style key. Prompt-state screens were not captured: every agent but Claude Code needs a login. Claude's are in `packages/server/testdata/screens/`.

## T2 priority

The owner uses Claude Code most, opencode a little, kilo and Codex rarely (2026-10-16).

1. Claude Code (verified surface, fact 0029), then Codex (verify `notify` and hooks under R21), then opencode.
2. Kilo.
3. The rest by how easily their prompts can be told apart: ACP-native agents first (opencode, kilo, gemini, qwen, copilot), then goose and cursor-agent, then aider and amp (no ACP; aider's notifications command is its only signal).

PR #139 (hook installers for claude, codex, copilot, kilo, opencode) is not in master: master was force-pushed at 2026-10-15T22:23Z (`7f0fd63` to `87988ac`), orphaning its merge commit `cb1098c`. Its source survives at `cb1098c` and `origin/test/agent-status-detection`; its per-agent hook formats were not verified against the agents.
