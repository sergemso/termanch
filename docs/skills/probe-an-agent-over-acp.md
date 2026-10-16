---
id: probe-an-agent-over-acp
title: Measure what an agent sends and accepts over ACP
status: active
date: 2026-10-16
tags: [agents, protocol, procedural]
---

# Procedure: Measure what an agent sends and accepts over ACP

Use when an agent is added, an agent or adapter version changes, or an adapter package is renamed. Results live in fact 0040 (contracts) and fact 0038 (capabilities); fixtures in `packages/server/testdata/acp/<agent>/`. Do this before writing a screen profile (`add-an-agent-profile`).

1. **Cheap pass first.** Run `initialize` only and diff the capabilities against fact 0038. Grep the agent's installed bundle for `sessionUpdate:"..."`, `session/...` and `optionId` literals: it shows what it can emit and which extension methods it has (`elicitation/create`, `cursor/ask_question`) before any token is spent.
2. **Set up safely.** Throwaway working dir, `tmux -L scratch` only, never the owner's sessions. Install npm agents and adapters onto `/home/ubuntu/data` (the `/tmp` quota fills). Source `.env` with `set -a; . ./.env; set +a`; never print, log or commit a key (`security-secrets-handling`). Probe env: unset `CLAUDECODE`; opencode and kilo need `permission: {bash: ask, edit: ask}` in their config JSON or they never ask (opencode reads `OPENCODE_CONFIG_CONTENT`, kilo `KILO_CONFIG_CONTENT`). Use a model that calls tools reliably, or a todo/question tool may never fire.
3. **Run the scenarios** with `scripts/acp-probe.mjs --agent <a> --steps '...'`: init and auth; new; a multi-step prompt that asks for a todo tool; a shell command with `--perm reject`, then `--perm none` plus `cancel`; a question prompt, with and without `--caps '{"elicitation":{"form":{}}}'`; `/compact`; `list`, `uselatest`, `load`, `resume`, `fork`, `close` (also in a fresh process); `mode:` and `config:` with a valid and a bogus id; `kill`, `restart`, `load`; `--fs --terminal`. Keep prompts short.
4. **Read the wire, not the summary.** Look for `plan` entries, `usage_update` fields, `session_info_update`, `request_permission` options and kinds, which request carries a question, the `stopReason` after reject and cancel, and what blocks forever.
5. **Commit fixtures.** `node scripts/acp-condense.mjs <wire.jsonl> packages/server/testdata/acp/<agent>/<scenario>.jsonl`. Check for secrets and account details (the probe redacts env secrets, emails and UUIDs; look anyway).
6. **Record.** Update the agent's cells in fact 0040 and the version and `last-verified` date. A cell not measured names its blocker (login, usage limit, no tool offered). Re-read each fact claim against the capture it cites.
7. **Terms.** Note any adapter terms-of-use limit from primary text; secondary reports go in marked as such.
