---
id: 0045
title: A dialog's input takes focus a moment after the dialog is visible, so typing straight away loses the first letters
status: active
tags: [client]
date: 2026-10-17
kind: environmental
governed-by: 0101
last-verified: 2026-10-17
---

# A dialog's input takes focus a moment after the dialog is visible

bits-ui moves focus into a dialog from its focus trap, after the box is visible. The command palette's browser test typed `pause alpha` right after the box appeared and lost the first letters on a slow runner (desktop e2e failed twice on master). The palette now focuses its input itself in `onOpenAutoFocus`, and tests wait for `document.activeElement` to be the input before typing; "visible" is not "focused".
