---
id: 0033
title: Svelte 5 in legacy mode rebuilds a key block whose key is an object
status: active
tags: [client]
date: 2026-10-14
kind: environmental
governed-by: 0087
last-verified: 2026-10-14
---

# Svelte 5 in legacy mode rebuilds a key block whose key is an object

`svelte/src/internal/client/dom/blocks/key.js` replaces an object key with a fresh `{}` on each evaluation when not in runes mode. `App.svelte` is legacy, and `{#key connection}` re-ran on every hub update. A number (`identityOf`) is stable.
