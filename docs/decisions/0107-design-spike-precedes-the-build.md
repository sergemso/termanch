---
id: 0107-design-spike-precedes-the-build
title: A design spike picks the visual direction before screens are built; Android is first-class and honestly labelled
status: active
date: 2026-10-16
track: product
accepted-by: Sergey Strebulaev <s@vivantel.dev>
tags: [client, mobile, design, roadmap]
---

## Decision

- Before the UX screens are built, a **design spike** produces 2-3 full-fidelity directions for Home, a decision card, the session view and one report, at 390 px and desktop, in light and dark, as clickable prototypes that open on the owner's iPhone. The owner picks one. It replaces the card-variant pass R20.
- The chosen direction is then codified as design tokens, motion and haptics rules and a small component set on top of Tailwind v4 and shadcn-svelte (0069), and every later screen is built from it.
- **Android is first-class** in design and build: same components, its own checklist item per screen (install prompt, back gesture, Web Push, native dictation). Until someone runs a screen on a real Android phone it is labelled "Android: emulated only"; an emulator is never reported as a phone check (`a-phone-check-names-its-platform`). A real-device pass on iPhone and Android is a gate before the free gate (R40) closes.

## Why

The goal is a supreme, consistent UI; choosing the direction once avoids rebuilding screens, and a spike is cheap next to that. The support floor already includes Chrome Android 100+ (`minimum-browser-support`) but nothing verifies it (fact 0039); honest labels fix that without blocking every step on hardware. Acceptance targets: [[ux-acceptance-targets]]. Builds on [[0069-ui-foundation-tailwind-shadcn]].
