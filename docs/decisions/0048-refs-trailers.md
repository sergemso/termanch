---
id: 0048-refs-trailers
title: Refs trailers are encouraged
status: active
date: 2026-10-11
tags: [practice-packs, git-hooks, guardrail]
track: process
accepted-by: Sergey Strebulaev <s@vivantel.dev>
go-getter:
  generated-by: git-workflow@0.1.1
  pack-answer: refs
  pack-option: encouraged
---

## Decision

Commits link the decisions, facts and guardrails they implement with `Refs:` trailers, proposed by the attribute skill and listed in the pull request; nothing fails a commit without one (pack git-workflow@0.1.1).

## Why

A `Refs:` trailer links a commit to the decision, fact or guardrail it implements, so the reason for a change can be found from the code.
