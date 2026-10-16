---
id: 0108-verification-machine-profile
title: Verification checks run only in CI (ci-only machine profile)
status: active
date: 2026-10-16
tags: [practice-packs, verification, harness, ci]
track: process
accepted-by: Sergey Strebulaev <s@vivantel.dev>
go-getter:
  verify-profile: ci-only
  verify-where:
    format: ci
    lint: ci
    typecheck: ci
    static-analysis: ci
    build: ci
    test: ci
    unit: ci
    integration: ci
    e2e: ci
    coverage: ci
  generated-by: verification-gate@0.4.0
  pack-answer: machine-profile
  pack-option: ci-only
---

## Decision

No check runs locally; every check runs in CI. Guardrail checks still run locally. `go-getter verify` and the stop gate run only `local` and `both` checks; `ci` and `both` checks belong to CI (pack verification-gate@0.4.0).

## Why

Thin machines should not run builds, full suites or analyzers locally, yet the quality bar must still hold (decision 0071).
