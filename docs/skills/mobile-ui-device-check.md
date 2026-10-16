---
id: mobile-ui-device-check
title: Check navigation, sheets and input on a real iPhone
status: active
date: 2026-10-13
tags: [client, mobile, ios, procedural]
---

# Procedure: Check a layout or input change on a real iPhone

Use after any change to `AppShell`, the key row, the sidebar or the top bar. CI cannot open a soft keyboard.

1. Open the preview or hosted client with `?debug` on the iPhone (Safari and the installed PWA): the overlay prints `innerHeight`, `visualViewport.height`, `offsetTop` and `--app-height`.
2. Tap the terminal so the keyboard opens. Confirm the key row and the cursor line stay visible; screenshot with the overlay.
3. Rotate, dismiss the keyboard, reopen it, and switch tabs with the keyboard open.
4. Scroll the session tabs horizontally, including a long name and sessions on different servers. Confirm the active tab stays visible after rotation and nothing reorders under a finger.
5. Drag the sessions sheet through peek, half and full. Check sticky presets, per-server Retry, and quick reply with the keyboard open; the input must stay above it. Choose a view, reload, and confirm the choice remains.
6. Long-press a tab: its action menu opens without switching sessions. Copy name is available after G.4; Rename and confirmed Kill are checked after G.9.
7. Open Servers, Pause and Resume one server, and foreground the app after leaving it in the background. Other servers must remain connected, and an active session must reattach on resume.
8. Repeat steps 1-7 on a real Android phone in Chrome and the installed PWA, and add: the install prompt, the system back gesture (it must go back in the app, not leave it), Web Push on a needs-you edge, and the keyboard's dictation into the composer.
9. Count taps for the flows in `ux-acceptance-targets` (push to answer, Home to a session) and note the numbers.
10. Report Safari and installed-PWA screenshots in the PR. Label Chrome-only phone checks as emulated, per `a-phone-check-names-its-platform`; they do not verify native iPhone or Android keyboard, safe areas or gesture behaviour.
