---
id: 0002
title: Client Framework Choice
status: active
tags: [client, framework, svelte]
date: 2026-10-09
---

# Client Framework Choice

The browser client uses **Svelte 5** (with runes) as the UI framework.

Rationale:
- Smaller bundle size (~1.5KB gzipped for runtime) vs React (~40KB)
- No virtual DOM overhead — critical for mobile battery life
- Native reactivity simplifies WASM integration
- Better compile-time optimization for WASM interop
- Svelte 5 runes provide fine-grained reactivity without stores boilerplate

WASM bundle target: < 2 MB gzipped total (including xterm.js + WASM core).