---
id: 0053-single-owner-servers
title: A server belongs to one GitHub user
status: active
date: 2026-10-11
tags: [security, auth, roadmap]
track: product
accepted-by: Sergey Strebulaev <s@vivantel.dev>
---

## Decision

Registering a server binds it to the registering GitHub user id; every later connection from another user is rejected and logged (no secrets, per audit-logging-no-secrets). Transport security is Cloudflare TLS; app-layer end-to-end encryption is deferred (0051).

## Why

Without an owner check any GitHub user with a valid token could attach to a shell on the VPS.
