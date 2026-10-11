---
id: 0033-verification-test-command
title: The verification test command is "cargo test"
status: active
date: 2026-10-11
tags: [practice-packs, verification, harness]
track: process
accepted-by: Sergey Strebulaev <s@vivantel.dev>
go-getter:
  verify-test-command: cargo test
  generated-by: verification-gate@0.3.0
  pack-answer: test-command
  pack-option: cargo test
---

## Decision

Verification runs `cargo test` for the test check; an empty command skips it (pack verification-gate@0.3.0).

## Why

The command is project-specific, so it is recorded as an answer rather than guessed at run time.
