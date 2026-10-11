---
id: 0045-branch-names
title: Branches are named ^(feat|fix|docs|chore|ci|test|refactor|perf|build|style|revert)/[a-z0-9][a-z0-9._-]*$
status: active
date: 2026-10-11
tags: [practice-packs, git-hooks, guardrail]
track: process
accepted-by: Sergey Strebulaev <s@vivantel.dev>
go-getter:
  generated-by: git-workflow@0.1.1
  pack-answer: branch-pattern
  pack-option: ^(feat|fix|docs|chore|ci|test|refactor|perf|build|style|revert)/[a-z0-9][a-z0-9._-]*$
---

## Decision

A branch name matches `^(feat|fix|docs|chore|ci|test|refactor|perf|build|style|revert)/[a-z0-9][a-z0-9._-]*$`, and the name identifies the change (pack git-workflow@0.1.1).

## Why

A change is one branch and one pull request, so the name is how the change is found again.
