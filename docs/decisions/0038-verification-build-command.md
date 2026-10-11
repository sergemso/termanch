---
id: 0038-verification-build-command
title: The verification build command is "cargo build"
status: active
date: 2026-10-11
tags: [practice-packs, verification, harness]
track: process
accepted-by: Sergey Strebulaev <s@vivantel.dev>
go-getter:
  verify-build-command: cargo build
  generated-by: verification-gate@0.3.0
  pack-answer: build-command
  pack-option: cargo build
---

## Decision

Verification runs `cargo build` for the build check, where the machine profile places it; an empty command skips it (pack verification-gate@0.3.0).

## Why

The command is project-specific, so it is recorded as an answer rather than guessed at run time.
