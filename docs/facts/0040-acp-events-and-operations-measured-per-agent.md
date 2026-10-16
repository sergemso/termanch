---
id: 0040
title: What each ACP agent really sends and accepts, measured for the tiered session view
status: active
tags: [agents, protocol, client]
date: 2026-10-16
kind: environmental
governed-by: 0103
last-verified: 2026-10-16
---

# What each ACP agent really sends and accepts, measured for the tiered session view

Extends fact 0038 (which agents have ACP and their `initialize` capabilities). Measured 2026-10-16 with `scripts/acp-probe.mjs` over stdio, a throwaway working dir and a scratch tmux only. Condensed wire captures (every request, response and non-chunk update; chunk updates cut to 3 per kind) are in `packages/server/testdata/acp/<agent>/<scenario>.jsonl`; `scripts/acp-condense.mjs` makes them from a probe run. Models: Nemotron 3.5 Super over the NVIDIA OpenAI-compatible API for opencode, kilo, qwen and goose; Haiku 5.5 / Sonnet 5.5 for claude; the owner's Copilot login for copilot.

## Versions and the adapter packages

| Agent | Measured with | Verdict |
|---|---|---|
| claude | `@agentclientprotocol/claude-agent-acp` 0.93.0 (agent SDK 0.2.x inside) | measured. `@zed-industries/claude-code-acp` 0.16.2 is deprecated (renamed) and **failed at `session/new`** when started inside a Claude Code session ("cannot be launched inside another Claude Code session"); unset `CLAUDECODE` in the child env. |
| codex | `@agentclientprotocol/codex-acp` 2.2.2 (bundles its own `codex`) | `initialize` and `session/new` work with the ChatGPT login, so the old blocker (`@zed-industries/codex-acp` 0.16.0 failing on every model) is fixed by the rename. Prompts: see Codex section. |
| opencode | 2.0.31 | measured |
| kilo | 7.6.2 | measured (config via `KILO_CONFIG_CONTENT`, not `OPENCODE_CONFIG_CONTENT`) |
| qwen | 0.25.2 | measured |
| goose | 1.55.0 | measured |
| copilot | 1.0.98 | measured (owner's login) |
| gemini | 0.64.0 | **unmeasured live**: `session/new` fails `-32000 "Gemini API key is missing or not configured."`; needs a Google login or `GEMINI_API_KEY`/Vertex. Source-derived facts below. |
| cursor-agent | 2026.10.16 | **unmeasured live**: `session/new` fails `-32000 "Authentication required"` until the owner runs `agent login`, then `authenticate` with methodId `cursor_login`. Source-derived facts below. |
| aider, amp | | no ACP (fact 0038) |

## `plan` and todos

| Agent | Result |
|---|---|
| claude | No todo tool in this build's ACP session: `TodoWrite` is not found by `ToolSearch`, and the model's tool list has no Task or TodoWrite tool. No `plan` update. The adapter source emits `plan` for `TodoWrite`, so it appears if a Claude Code build offers that tool. `ExitPlanMode` is the plan surface (see permissions). |
| opencode | No `plan` (the ACP code has no such update kind). Tool list has no todo tool by default (`edit, glob, grep, question, read, shell, skill, subagent, webfetch, websearch, write`). |
| kilo | **Todos arrive as a tool call, not `plan`**: `tool_call` title `todowrite`, kind `other`, then `tool_call_update` with `rawInput.todos` = `[{content, status, priority}]`, a full list each time; the completed update's title is `"3 todos"` and its text content is the same list as JSON. |
| qwen | No `plan` live. `todo_write` is a deferred tool that `ToolSearch` did not find in ACP mode ("Not found: todo_write"). The source has `plan` only in the transcript-replay path (`entries[{content, priority:"medium", status}]`, `_meta.qwenTodo`), so `session/load` may replay it. |
| goose | No todo tool by default (tools: `analyze, apps__*, delegate, edit, extensionmanager__*, load, load_skill, read_image, shell, tree, write`). No `plan`. |
| copilot | **The only agent that sent `plan`, and it was always `{"entries": []}`** (after a SQL tool call that inserted todos, and after plan mode). Todos live in a SQL `todos` table written by a `kind: other` tool call whose `rawInput.query` is SQL text. Plan mode saves `plan.md` and the answer says so. Entries are not usable; parse nothing from `plan`. |
| gemini | Source: no `plan` update; modes `default, autoEdit, yolo, plan`. Unmeasured live. |
| cursor-agent | Source: sends `plan` (`entries`), plus extension requests `cursor/update_todos`, `cursor/create_plan`, `cursor/task`, and `subagent_spawned` / `subagent_state_update` updates. Unmeasured live. |
| codex | See Codex section. |

Gap: no agent was seen sending a non-empty `plan`. Plan progress for T1 comes from hooks/transcript (Claude Code) or, for kilo, from `todowrite` tool calls.

## Token usage and context

`usage_update` is a `session/update`: `{used, size, cost?}`. `size` is the context window of the current model; `used` is tokens currently in context, so **percentage = used / size** for every agent that sends it.

| Agent | `usage_update` | Per-prompt `usage` in the `session/prompt` response |
|---|---|---|
| claude | `{used, size: 1000000, _meta: {"_claude/model"}}` after every model step; the last one of a turn adds `cost: {amount, currency: "USD"}`; some carry `_meta["_claude/rateLimit"]` = `{status, rateLimitType: "five_hour", resetsAt, unifiedWindows: {five_hour, seven_day: {utilization, resetsAt}}}` (**subscription limit utilisation**) | `{inputTokens, outputTokens, cachedReadTokens, cachedWriteTokens, totalTokens}`, `_meta.quota.model_usage[]`. Zero for slash commands (`/compact`, `/clear`, `/context`). |
| opencode | `{used, size: 200000, cost: {amount: 0, currency}}` once per turn (at the end) | `{inputTokens, outputTokens, totalTokens, thoughtTokens, cachedReadTokens}`; `totalTokens` includes the cache. Also returned for `cancelled`. |
| kilo | `{used, size: 131072, cost}`; `used: 0` for a failed prompt | same shape; zeros after a cancel |
| qwen | `{used, size: 1000000}` (no cost), before each model call | **none** in the response; usage is in an empty `agent_message_chunk` with `_meta.usage` `{inputTokens, outputTokens, totalTokens, thoughtTokens, cachedReadTokens}` and `_meta.durationMs` |
| goose | `{used, size: 128000}` at turn start and end | `{totalTokens, inputTokens, outputTokens}` |
| copilot | `{used, size: 272000}` several times per turn | `{inputTokens, outputTokens, totalTokens, thoughtTokens, cachedReadTokens, cachedWriteTokens}` |
| gemini | Source: sends `usage_update`. Unmeasured live. | |
| cursor-agent | No `usage_update` in the source. Unmeasured live. | |

## Resets and lifecycle

| Aspect | claude | opencode | kilo | qwen | goose | copilot |
|---|---|---|---|---|---|---|
| `/compact` | prompt `/compact` returns `end_turn` with zero usage; the summary comes back as a `user_message_chunk` ("This session is being continued...") on a later load | `/compact` is in `available_commands`; sends `session_info_update` with `_meta["opencode/compaction"] {status: started/completed, reason}`. With client capability `session.compaction` it sends `compaction_update {compactionId, status}` and `compaction_summary_chunk` instead | `end_turn`, no event | `end_turn`, no event | `end_turn`; context falls (278 tokens after) | not tried |
| `/clear` | accepted, `end_turn`, zero usage; title becomes `/clear`; the id does not change | not offered | n/a | accepted, `end_turn` | n/a | n/a |
| `session/load` | replays history as `user_message_chunk`, `agent_message_chunk`, `tool_call(_update)` | replays user messages and compaction markers (older turns are compacted) | replays user messages and tool calls (a pending `question` shows as a pending tool call titled "Question dismissed") | accepted | replays | replays as whole messages; error `-32602 "already loaded"` if the session is live in that process |
| `session/resume` | returns state, **no replay** | no replay | no replay | no replay | **`-32601 Method not found`** (not advertised) | not advertised |
| `session/close` | `{}` | `{}` | `{}` | **`-32601`** | `{}` and the session is gone: later prompts fail `-32002 "Session not found"` | `{}`; later prompts `-32602 "Session not found"` |
| `session/list` | `{sessions[{sessionId,cwd,title,updatedAt}]}` newest first | same, plus `nextCursor` (non-null even for one result) | same | same plus `_meta` | same plus `_meta{messageCount,...}` | same |
| `session/fork` | new `sessionId` | advertised | advertised | no | no | no |

- **Cancel** (`session/cancel` notification): every measured agent answers the pending `session/prompt` with `stopReason: "cancelled"` (claude, opencode, kilo, qwen, goose, copilot did so when a tool or request was pending; copilot's command had already finished). The same session accepts the next prompt. An unanswered permission or question request is dropped by the cancel.
- **`stopReason` seen**: `end_turn`, `cancelled`. Not seen: `max_tokens`, `refusal`. A refused permission ends the turn as `cancelled` in opencode and in claude's `ExitPlanMode` reject, but as `end_turn` in goose, copilot, qwen and in claude's `Write` reject (the agent then says it was declined).
- **Prompt errors** are JSON-RPC errors on the `session/prompt` id: kilo `-32603 "You need to sign in to use this model."`; codex `-32603` with `data.codexErrorInfo: "usageLimitExceeded"` and a message containing the reset time.
- **Crash**: `SIGKILL` of the adapter during a pending permission leaves the `session/prompt` unanswered (the transport just closes); in-flight turn and pending request are lost. A fresh process plus `initialize` plus `session/load` restored the session in opencode and claude (state is on disk), and a following prompt worked.
- **`session_info_update`**: `{title, updatedAt}` after the first turn in claude, copilot and goose (goose adds `_meta.messageCount`); in opencode and qwen it carries only `_meta`.
- Agents that send unrequested extension traffic that a client must tolerate: claude `_auth/status_update` (request with an `authStatus` payload), qwen `qwen/notify/session/mode-update` and `craft/drainMidTurnQueue`.

## Permissions and questions

`session/request_permission` params: `{sessionId, toolCall: {toolCallId, title, kind, status, rawInput, locations, content?}, options: [{optionId, name, kind}]}`. Reply `{outcome: {outcome: "selected", optionId}}` (or `{outcome: {outcome: "cancelled"}}`).

| Agent | Option ids (kind) | Notes |
|---|---|---|
| claude | `allow-once` (allow_once), `allow-with-updates` "allow all edits this session" (allow_always), `reject` (reject_once) | `toolCall.content` has a `{type:"diff", path, oldText, newText}`. No `reject_always`. Mode `default` asks for Write and Bash. |
| claude `ExitPlanMode` | `exit-plan-default`, `exit-plan-clear-auto`, `exit-plan-auto`, `exit-plan-bypass` (allow_*), `reject` | `toolCall.kind: "switch_mode"`, title "Approve Plan", the plan is `rawInput.plan` and `content[0].content.text` (Markdown). |
| opencode | `once` (allow_once), `always` (allow_always), `reject` (reject_once) | Asks only when config sets `permission.bash/edit: ask`; by default nothing asks. `toolCall` has `name`, `rawInput.command`. |
| kilo | same as opencode | same |
| qwen | `proceed_always` "Allow All Edits", `proceed_once`, `cancel` (reject_once) | Edits have a diff in `content`. In `default` mode a shell command `ls` did not ask. |
| qwen plan | `restore_previous`, `proceed_always`, `proceed_once`, `cancel` | `kind: "switch_mode"`, `rawInput.plan`, `_meta.toolName: "exit_plan_mode"`. |
| goose | `allow_always`, `allow_once`, `reject_once`, `reject_always` (**the only one with `reject_always`**) | Only in mode `approve` or `smart_approve`; default mode `auto` never asks. `toolCall.kind: "other"`. |
| copilot | `allow_once`, `allow_always`, `reject_once` | `rawInput` = `{fileName, diff, ...}` for edits; safe shell commands (`ls`) did not ask. |
| gemini | Source: `proceed_once`, `proceed_always`, `proceed_always_and_save`, `proceed_always_server`, `proceed_always_tool` (allow_*), `cancel` (reject_once) | unmeasured live |
| cursor-agent | Source: `allow-once`, `allow-always`, `reject-once` | unmeasured live |

**No answer ever**: the prompt blocks without timeout (opencode, kilo, qwen, goose, claude waited 30 s or more) until `session/cancel` or the process dies.

**Free-text and multiple-choice questions**, per agent:

| Agent | Mechanism |
|---|---|
| opencode | Tool `question`. Without client capability `elicitation.form` the tool fails at once (`tool_call_update` failed: "The question couldn't be shown to the user in this client...") and the model carries on. With `clientCapabilities.elicitation = {form: {}}` it sends the request **`elicitation/create`** `{mode: "form", sessionId, toolCallId, message, requestedSchema: {properties: {q0: {type:"string", oneOf:[{const,title,description}]}, q0_custom: {type:"string"}}}}`. Reply `{action: "accept", content: {q0: "Blue"}}`; the tool result is `User has answered...="Blue"`. Unanswered: blocks until cancel; the tool call then fails. |
| kilo | Tool `question`: only a `tool_call` (kind `other`, `rawInput.questions[{question, header, options[{label, description}]}]`). **No request is sent; the turn hangs for 180 s+ with nothing to answer** (elicitation not honoured). A screen/TUI answer is the only path. |
| qwen | `session/request_permission` with `toolCall.kind: "think"`, `_meta.qwenInteractionKind: "user_question"`, `_meta.qwenQuestions` (= `rawInput.questions`), options `proceed_once` "Submit" / `cancel`. **Answers go in a top-level `answers` map next to `outcome`**: `{outcome: {outcome:"selected", optionId:"proceed_once"}, answers: {"0": "blue"}}` made the model answer "chose blue". |
| claude | `AskUserQuestion` is not in the ACP session's tool list in this build; no question surface seen. |
| goose | No question tool. |
| copilot | Asked "Red or blue?" as plain `agent_message_chunk` text; no request. |
| cursor-agent | Source: extension request `cursor/ask_question`; if the client answers `-32601` it falls back to one `session/request_permission` per single-choice question with options `{optionId: <option id>, kind: allow_once}` plus `__ask_question_skip__`. Multi-select and free text are not offered in the fallback. |
| gemini, codex | gemini unmeasured; codex see below. |

## Modes and configuration

Modes are the prompting policy. All of these reported them in `session/new` as `configOptions` with `category: "mode"` (and `modes` for claude, qwen, goose, copilot, codex):

| Agent | Mode ids (default first) |
|---|---|
| claude | `default` (Manual), `acceptEdits`, `plan`, `auto`, `bypassPermissions` |
| codex | `agent` (Auto review, default), `read-only`, `workspace-write`, `agent-full-access`; plus `collaboration_mode` `default`/`plan` |
| opencode, kilo | `build` (default), `plan` |
| qwen | `auto` (default), `plan`, `default`, `auto-edit`, `yolo` |
| goose | `auto` (default; never asks), `approve`, `smart_approve`, `chat` |
| copilot | URIs `https://agentclientprotocol.com/protocol/session-modes#agent` / `#plan` / `#autopilot`, plus config `allow_all` on/off |
| gemini | source: `default`, `autoEdit`, `yolo`, `plan` |

- `session/set_mode {sessionId, modeId}` works in claude, opencode, qwen, goose, copilot and answers `{}`; goose, copilot and qwen announce it back (`current_mode_update` for goose and copilot; `config_option_update` for claude and for qwen's `config` form). Unknown id: opencode, qwen, goose `-32602`; claude `-32603 "Invalid Mode"`.
- `session/set_config_option {sessionId, configId, value}` returns the full `configOptions`; unknown id or value `-32602` (opencode, kilo) or `-32603` (claude). Config ids seen: `mode`, `model`, `effort`/`reasoning_effort`, `fast-mode`, `allow_all`, `provider` (goose).
- `session/set_model` exists only in qwen (`-32602` for an unknown model) and is `-32601` in opencode; use `set_config_option` with `configId: "model"` elsewhere.
- Entering plan mode in claude switched the model from haiku to sonnet (`config_option_update` showed `model: sonnet`): re-read `configOptions` after a mode change.
- Unknown methods answer `-32601` (opencode `"Method not found": session/bogus`).

## Operations contract: client capabilities

- We advertised `fs.readTextFile/writeTextFile` and `terminal` to claude and opencode: **neither ever called `fs/*` or `terminal/*`**. The agents run their own tools, so terminal output reaches us only as `tool_call_update.content` / `rawOutput`. Do not rely on being asked for them. Not tried for the others.
- Capabilities that change behaviour: opencode honours `elicitation.form`, `session.compaction`, `session.configOptions`, `session.notices`; others ignored what we sent.
- `authenticate`: opencode `opencode-login` (terminal `opencode auth login`), qwen `openai` (reads `OPENAI_API_KEY`), goose `goose-provider`, copilot `copilot-login` (terminal `copilot login`), cursor `cursor_login`, gemini `oauth-personal` / `gemini-api-key` / `vertex-ai`, codex `api-key` / `chat-gpt`, claude none (the adapter reuses the Claude Code login and has `auth.logout`). All the ones tried returned `{}` on success, or failed at `session/new` or the prompt.

## Terms of use for the adapters (secondary sources only)

Web search 2026-10-16 found no statement about ACP adapters themselves. For Claude: reports and the Agent SDK docs say third-party products may not offer claude.ai login or subscription limits unless approved (a rule dated 2026-02-20), and the claude adapter wraps the Agent SDK. For Codex: OpenAI reportedly allows ChatGPT sign-in in third-party tools and has named launch partners; not confirmed from OpenAI's own text. Neither was read from the primary terms: ask the owner to confirm before Termenbox ships a flow that drives a subscription login through an adapter.

## Implementer contract (what to code against)

| Need | Source of truth | Fallback |
|---|---|---|
| Status working/idle | open `session/prompt` request (working until its response) | process scan, screen |
| Last message / timeline | `agent_message_chunk`, `tool_call`, `tool_call_update` (merge by `toolCallId`; first `tool_call` often has empty `rawInput`, the input arrives in a later update) | screen tail |
| Plan progress | kilo `todowrite` tool calls; claude hooks/transcript | none from `plan` (empty or absent everywhere measured) |
| Context % | `usage_update.used / size` (all measured agents except cursor-agent; gemini unmeasured) | none |
| Spend | claude/opencode/kilo `usage_update.cost`; per-turn `usage` | none for qwen, goose, copilot |
| Rate-limit headroom | claude only: `_meta["_claude/rateLimit"].unifiedWindows` | none |
| Title | `session_info_update.title` (claude, copilot, goose) or `session/list` | pane title |
| Decision card | `session/request_permission` (options map directly) and `ExitPlanMode`/`exit_plan_mode` with `kind: "switch_mode"` and the plan text | screen parse |
| Free-text question | opencode `elicitation/create`, qwen permission + `answers`, cursor `cursor/ask_question` | kilo, claude, copilot, goose: screen only |
| Interrupt | `session/cancel` | Ctrl-C into the PTY |
| Compaction / reset | opencode `compaction_update`; others none | screen |
| Resume after crash | new process, `initialize`, `session/load` (replays) or `session/resume` where advertised (no replay; goose has no resume) | n/a |

Gaps that remain for the screen/process scan: kilo questions, claude and copilot questions, compaction in every agent but opencode, plan progress for everything but kilo, and every cell marked unmeasured (gemini and cursor-agent need a login; codex see below).

## Codex

(filled in after the usage-limit window; see below)
