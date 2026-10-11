---
id: 0015-procedure-delivery
title: Detailed procedures live in skills loaded on demand
status: active
date: 2026-10-11
tags: [practice-packs, harness, cost]
track: process
accepted-by: Sergey Strebulaev <s@vivantel.dev>
go-getter:
  generated-by: context@0.3.0
  pack-answer: procedures
  pack-option: skills-on-demand
---

## Decision

Put detailed procedures in skills; the always-loaded instruction file only names them. (pack context@0.3.0.)

## Why

Every always-loaded token is paid on every request and every subagent; cached prefixes stay cheap only if stable (facts 0003, 0011).
