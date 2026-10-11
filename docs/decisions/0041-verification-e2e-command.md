---
id: 0041-verification-e2e-command
title: The verification e2e command is ""
status: active
date: 2026-10-11
tags: [practice-packs, verification, harness]
track: process
accepted-by: Sergey Strebulaev <s@vivantel.dev>
go-getter:
  verify-e2e-command: ""
  generated-by: verification-gate@0.3.0
  pack-answer: e2e-command
  pack-option: ""
---

## Decision

Verification runs `` for the e2e check, where the machine profile places it; an empty command skips it (pack verification-gate@0.3.0).

## Why

The command is project-specific, so it is recorded as an answer rather than guessed at run time.
