---
id: 0037-verification-static-analysis-command
title: The verification static-analysis command is ""
status: active
date: 2026-10-11
tags: [practice-packs, verification, harness]
track: process
accepted-by: Sergey Strebulaev <s@vivantel.dev>
go-getter:
  verify-static-analysis-command: ""
  generated-by: verification-gate@0.3.0
  pack-answer: static-analysis-command
  pack-option: ""
---

## Decision

Verification runs `` for the static-analysis check, where the machine profile places it; an empty command skips it (pack verification-gate@0.3.0).

## Why

The command is project-specific, so it is recorded as an answer rather than guessed at run time.
