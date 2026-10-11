---
id: 0034-verification-lint-command
title: The verification lint command is "cargo clippy"
status: active
date: 2026-10-11
tags: [practice-packs, verification, harness]
track: process
accepted-by: Sergey Strebulaev <s@vivantel.dev>
go-getter:
  verify-lint-command: cargo clippy
  generated-by: verification-gate@0.3.0
  pack-answer: lint-command
  pack-option: cargo clippy
---

## Decision

Verification runs `cargo clippy` for the lint check; an empty command skips it (pack verification-gate@0.3.0).

## Why

The command is project-specific, so it is recorded as an answer rather than guessed at run time.
