---
id: mobile-ui-device-check
title: Check a layout or input change on a real iPhone
status: active
tags: [client, mobile, ios, procedural]
---

# Procedure: Check a layout or input change on a real iPhone

Use after any change to `AppShell`, the key row, the sidebar or the top bar. CI cannot open a soft keyboard.

1. Open the preview or hosted client with `?debug` on the iPhone (Safari and the installed PWA): the overlay prints `innerHeight`, `visualViewport.height`, `offsetTop` and `--app-height`.
2. Tap the terminal so the keyboard opens. Confirm the key row and the cursor line stay visible; screenshot with the overlay.
3. Rotate, dismiss the keyboard, reopen it, and switch tabs with the keyboard open.
4. Open and close the sidebar on the phone (overlay about 70% width, tap outside closes).
5. Long-press a tab: the menu opens and Kill asks for confirmation.
6. Report the screenshots in the PR; the owner marks the step done.
