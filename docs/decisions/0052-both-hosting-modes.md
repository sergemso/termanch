---
id: 0052-both-hosting-modes
title: Hosted client and self-hosted client are both supported
status: active
date: 2026-10-11
tags: [deployment, roadmap]
track: product
accepted-by: Sergey Strebulaev <s@vivantel.dev>
---

## Decision

Two client modes: a Termenbox-hosted client at app.termenbox.dev with Termenbox's OAuth app (quick start, two clicks), and a self-hosted client on the user's own Cloudflare Pages, domain and OAuth app (README, BOOTSTRAP, Terraform). The server is always user-hosted. The `bootstrap-simplicity` two-click bound applies to the hosted mode only.

## Why

The hosted mode serves the no-friction goal; the self-host mode serves privacy and "no subscriptions". Docs must label which mode each instruction belongs to.
