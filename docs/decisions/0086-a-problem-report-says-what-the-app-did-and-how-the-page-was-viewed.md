---
id: 0086-a-problem-report-says-what-the-app-did-and-how-the-page-was-viewed
title: A problem report says what the app did and how the page was viewed
status: draft
date: 2026-10-14
track: product
tags: [client, privacy, mobile, ios]
fitness-functions: [report.test.ts covers steps, scrub and URL length, viewport.test.ts covers the reading]
---

## Decision (draft: needs the owner's acceptance)

Extends 0074.

- The report asks for **Steps to reproduce, Actual result, Expected result**, in the dialog and in the issue template.
- It carries a **trail of the app's own steps** (last 30: tab opened, sheet or menu opened, attached, resized, renderer chosen or lost; each with its age) and the **viewport reading**: zoom scale, offsets, page and scroll position, the focused element, and where each box around the terminal sits. Names, paths, addresses and terminal content are never in it ([[diagnostics-never-include-secrets]]).
- The report is a modal that hides the app, and GitHub then opens over it. A non-modal composer is not built yet.

## Why

Reports from a phone said "errors: none" while the screen was shifted or blank; only the zoom scale, the focus and the rebuild count showed the cause. The trail also writes the steps to reproduce.
