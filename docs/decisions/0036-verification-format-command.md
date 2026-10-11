---
id: 0036-verification-format-command
title: The verification format command is "cargo fmt --check"
status: active
date: 2026-10-11
tags: [practice-packs, verification, harness]
track: process
accepted-by: Sergey Strebulaev <s@vivantel.dev>
go-getter:
  verify-format-command: cargo fmt --check
  generated-by: verification-gate@0.3.0
  pack-answer: format-command
  pack-option: cargo fmt --check
---

## Decision

Verification runs `cargo fmt --check` for the format check, where the machine profile places it; an empty command skips it (pack verification-gate@0.3.0).

## Why

The command is project-specific, so it is recorded as an answer rather than guessed at run time.
