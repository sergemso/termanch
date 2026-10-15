---
id: 0067-change-journal-and-revert
title: Every host change is journaled, previewed and revertible
status: active
date: 2026-10-12
track: product
accepted-by: Sergey Strebulaev <s@vivantel.dev>
tags: [safety, deployment, roadmap]
---

## Decision

- Everything the installer, profile (0059) or updater changes on a machine (packages, users, files, containers) is recorded in a journal in the config dir.
- Installs show a dry-run list before applying; `termenbox-server --revert` undoes journaled changes. We touch nothing outside the journal's scope.
- Server image updates keep the previous image and roll back after a failed health check.
- A short terms page states MIT "as is" and that agents run with the privileges the owner chose.

## Why

Host mode and profile installs can break a user's VPS; a journal and a revert bound the loss we can cause. See [[host-changes-are-journaled]].
