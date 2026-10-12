---
id: 0074-problem-reports-via-github-issues
title: Problems are reported by the user through a prefilled GitHub issue
status: active
date: 2026-10-12
track: product
accepted-by: Sergey Strebulaev <s@vivantel.dev>
tags: [client, privacy, repo]
---

## Decision

- A **Report a problem** button (header menu and the failure screen) opens a prefilled new-issue page on the Termanch repository. The user reads, edits and submits it with their own GitHub account.
- The text holds the app version, browser and OS, viewport numbers, connection state and the last few errors kept in memory. A scrubber removes certificates, claim secrets, tokens and addresses before the text is built.
- If the text would exceed the URL limit it is copied to the clipboard and the issue opens with a paste note.
- The repository gets an issue template for it. There is no automatic reporting and no endpoint of ours.

## Why

It costs no infrastructure, sends nothing without a tap and gets reports into the place the work is tracked. An automatic reporter was declined: it needs an endpoint, a retention rule and a notice for a gain the button and the crash screen mostly provide. See [[diagnostics-never-include-secrets]].
