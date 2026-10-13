---
id: soft-keyboard-never-hides-input
title: The soft keyboard never hides the key row or terminal input
status: active
governed-by: 0082
grounded-in: 0026
derivation-note: The owner sees the iPhone keyboard cover the key row; a terminal without Ctrl, Esc and arrows is unusable on a phone.
tags: [client, mobile, ios]
---

# Guardrail: The soft keyboard never hides the key row or terminal input

## Rule
**MUST** keep the key row and the cursor line visible while the soft keyboard is open on iOS Safari 16+ and Chrome Android 100+. **MUST** size the app only through `AppShell`. **MUST** cover a viewport shrink in the browser e2e and re-check on an iPhone after any layout change.
