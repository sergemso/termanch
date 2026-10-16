---
id: 0109-state-first-and-the-terminal-is-first-class
title: The product aims for users never needing the terminal, and the terminal is still a first-class, super-convenient surface
status: draft
supersedes: 0102-act-in-place-the-terminal-is-the-expert-path
date: 2026-10-16
track: product
tags: [client, mobile, agents, terminal, roadmap]
---

## Decision (draft: needs the owner's acceptance)

- **State first.** The structured views (Home queue, decision card, session view) are built so a user can learn what every agent is doing and answer it without opening the terminal. Needing the terminal to understand state or to complete a common task is a product gap to close. This is the direction of effort, not a reason to deprioritise the terminal.
- **Terminal first-class.** Whoever does want the terminal gets a surface that is as convenient as a native one, on phone and desktop: one tap from every session (never more than one), always keeping its place when switching away and back, a key row (Esc, Tab, Ctrl, arrows, and the common chords) that never hides the input (`soft-keyboard-never-hides-input`), selection and copy that work, scrollback and search, paste and dictation into the prompt, and fast switching between sessions. On desktop it is a persistent pane beside the session (0101), not a modal.
- Both halves are acceptance-checked per screen: a device check for the structured view, and a terminal convenience checklist (`mobile-ui-device-check`).
- The earlier rule that free-text replies use a composer with the system keyboard's dictation, with no audio leaving the device, is unchanged.

## Why

The owner's goal is a product where state is so complete that opening the terminal is rarely necessary, yet the terminal is the product's core capability and must never feel like a fallback. Calling it "the expert path" (0102) pushed designs to hide it. Content for the structured view stays in [[0103-session-view-uses-capability-tiers-and-agent-profiles]]; layout in [[0101-navigation-bottom-bar-on-phone-workspace-on-desktop]].
