---
id: 0031
title: Claude Code gives its status line command the prompt cache expiry
status: active
tags: [agents, hooks]
date: 2026-10-13
kind: environmental
governed-by: 0083
last-verified: 2026-10-13
---

# Claude Code gives its status line command the prompt cache expiry

Read from the owner's status line plugin (`~/projects/sergemso/claude-code-status-line/bin/statusline.sh`, lines 175-199), not from a live run: the JSON that Claude Code writes to a `statusLine` command's stdin has a `prompt_cache` object with `ttl`, `warm` (boolean), `expires_at` (unix seconds), `requests` and `hit_ratio` (0 to 1). The plugin shows `expires_at` minus now as the time left and "no cache" when `warm` is false or the time has passed.

It is not in the hook payloads of fact 0029. To re-check: run `claude` with a `statusLine` command that saves its stdin and look for `prompt_cache`.
