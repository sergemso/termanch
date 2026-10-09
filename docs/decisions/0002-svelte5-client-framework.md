---
id: 0002
title: Svelte 5 for Client Framework
status: active
track: product
tags: [client, framework, svelte, wasm]
date: 2026-10-09
accepted-by: architect
---

# Decision: Svelte 5 (Runes) for Client Framework

## Context
The browser client must:
- Load fast on mobile (3G/4G, cold start < 3s)
- Run smoothly at 60fps during high-throughput terminal output
- Integrate tightly with WASM core (zero-copy ArrayBuffer passing)
- Stay under 2 MB gzipped total bundle (WASM + JS + xterm.js)

## Decision
Use **Svelte 5 with runes** as the UI framework.

## Rationale
- **Bundle size**: Svelte runtime ~1.5KB gzipped vs React ~40KB + React DOM ~120KB
- **No virtual DOM**: Direct DOM updates = less GC pressure = better mobile battery life
- **Compile-time reactivity**: Runes (`$state`, `$derived`, `$effect`) compile to fine-grained subscriptions without runtime overhead
- **WASM interop**: Svelte's `bind:` and `use:` directives map cleanly to WASM exports; no `useRef`/`useEffect` boilerplate
- **TypeScript**: First-class TS support with `svelte-check`

## Tradeoffs
| Aspect | Svelte 5 | React 18 | Preact | Vanilla TS |
|---|---|---|---|---|
| Bundle (runtime) | 1.5KB | 160KB | 3KB | 0KB |
| Ecosystem | Growing | Massive | React-compat | None |
| Hiring pool | Smaller | Large | Medium | N/A |
| WASM integration | Excellent | Good (refs) | Good | Manual |
| Learning curve | Low (HTML-like) | Medium | Low | High (DIY) |

## Consequences
- Client package uses `pnpm` with `svelte@5`, `vite`, `typescript`
- WASM core exposes `TerminalCore` class via `wasm-bindgen`; Svelte components import directly
- No Redux/Zustand needed — Svelte stores + runes suffice for state
- Team must know Svelte or be willing to learn (low barrier)