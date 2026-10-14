---
id: 0087-the-terminal-is-built-once-and-never-answers-the-page
title: The terminal is built once per connection, takes input at 16px and answers no colour queries
status: draft
date: 2026-10-14
track: product
tags: [client, ios, rendering, terminal, mobile]
governed-facts: [0032, 0033]
fitness-functions: [e2e - the same xterm element survives a hub update, e2e - the terminal input is at least 16px, the page scale is 1 and no box around it is scrolled after connecting, inputGuards.test.ts - colour queries get no answer]
---

## Decision (draft: needs the owner's acceptance)

- **A component is keyed on a number, never an object** (`identityOf`). The terminal is created once per connection; hub updates (agent states, session lists, windows) never rebuild it.
- **The terminal's hidden input is 16px or more**, so iOS never zooms the page into it.
- **xterm answers no colour query** (OSC 4, 10, 11, 12 with `?`); an answer that slips through is dropped before it is sent.
- **The renderer is a per-device setting**: WebGL by default, Plain (DOM) when the screen flickers or goes blank. Applies at the next session.

## Why

Issue 105 showed the terminal rebuilt seven times in eight seconds: blank screen on idle, flicker, duplicated text. Issue 99's "shifted screen" fitted iOS zoom. The leaked `4;150;rgb:...` text was an unanswered palette query reaching the shell.
