---
id: 0035-verification-typecheck-command
title: The verification typecheck command is "cargo check"
status: active
date: 2026-10-11
tags: [practice-packs, verification, harness]
track: process
accepted-by: Sergey Strebulaev <s@vivantel.dev>
go-getter:
  verify-typecheck-command: cargo check
  generated-by: verification-gate@0.3.0
  pack-answer: typecheck-command
  pack-option: cargo check
---

## Decision

Verification runs `cargo check` for the typecheck check; an empty command skips it (pack verification-gate@0.3.0).

## Why

The command is project-specific, so it is recorded as an answer rather than guessed at run time.
