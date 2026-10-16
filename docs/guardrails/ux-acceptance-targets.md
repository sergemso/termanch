---
id: ux-acceptance-targets
title: Every UX screen meets the acceptance targets for taps, glanceability, speed and device checks
status: active
governed-by: 0100
grounded-in: [0100, 0102, 0107]
derivation-note: A decision-first, act-in-place product (0100, 0102) is only as good as the number of steps and seconds it costs, so those are fixed and checkable.
tags: [client, mobile, ux]
---

# Guardrail: UX acceptance targets

## Rule
A UX step is not done unless its screens meet all of:
1. **MUST** let the user send an answer from a push in at most 2 taps.
2. **MUST** show every agent's state on one screen with 0 taps after a cold open.
3. **MUST** reach any session's detail from Home in 1 tap.
4. **MUST** reach first usable paint in under 1.5 s on a mid-range phone over 4G (throttled run in CI, plus the owner's phone).
5. **MUST** have a device check per screen (`mobile-ui-device-check`) and keep `ui-never-moves-under-the-finger` and `soft-keyboard-never-hides-input`.

Targets 1-3 are checked by Playwright tap-count tests; 4 by a throttled run; 5 by the owner's checklist, with each platform labelled per `a-phone-check-names-its-platform`.
