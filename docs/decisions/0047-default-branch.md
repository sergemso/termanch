---
id: 0047-default-branch
title: The default branch takes no direct work
status: active
date: 2026-10-11
tags: [practice-packs, git-hooks, guardrail]
track: process
accepted-by: Sergey Strebulaev <s@vivantel.dev>
go-getter:
  generated-by: git-workflow@0.1.1
  pack-answer: default-branch
  pack-option: protect
---

## Decision

A git hook and CI refuse a commit or push while the default branch is checked out, and agents are told the same (pack git-workflow@0.1.1).

## Why

Every change goes through a branch and a pull request, so review and CI see it before the default branch does.
