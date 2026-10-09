---
id: 0008
title: xterm.js with WebGL Addon for Terminal Rendering
status: active
track: product
tags: [client, rendering, xterm, webgl]
date: 2026-10-09
accepted-by: architect
---

# Decision: xterm.js with WebGL Addon for Terminal Rendering

## Context
Terminal rendering must:
- Handle high-throughput output (10k+ lines/sec) at 60fps on mobile
- Correctly render ANSI/VT100/TUI escape sequences (vim, htop, fzf)
- Support ligatures, emoji, variable-width fonts
- Minimize battery drain on mobile

## Decision
Use **xterm.js v5+ with `@xterm/addon-webgl`** as the terminal renderer.

## Rationale
- **Proven**: Used by VS Code, GitHub Codespaces, GitPod, Theia — millions of users
- **WebGL acceleration**: GPU texture atlas for glyphs — 60fps scroll on 5-year-old phones
- **Complete ANSI parser**: Handles edge cases (DEC private modes, SGR stacks, DCS) that custom renderers miss
- **Addon system**: Extensible for images (image addon), hyperlinks, ligatures
- **Mobile tested**: Touch scrolling, selection, viewport management built-in

## Configuration for Mobile
```typescript
const term = new Terminal({
  rendererType: 'webgl',
  drawBoldTextInBrightColors: true,  // OLED contrast
  letterSpacing: 0,
  lineHeight: 1.2,
  fontFamily: '"JetBrains Mono", "SF Mono", monospace',
  fontSize: 14,
  scrollback: 10000,
  allowTransparency: true,
  cursorBlink: true,
});
```

## WASM Integration
- xterm.js runs in main thread
- WASM core (`termanch-core`) runs in dedicated Web Worker
- Communication: `postMessage` with `Transferable` ArrayBuffers
- Delta frames: `{ version, ops: Uint32Array }` — zero-copy

## Tradeoffs
| Renderer | Perf | ANSI Compat | Bundle | Mobile Battery |
|---|---|---|---|---|
| xterm.js WebGL (chosen) | Excellent | Excellent | ~200KB | Good (GPU) |
| xterm.js DOM | Good | Excellent | ~200KB | Medium (DOM) |
| Custom WebGL | Excellent | Hard (edge cases) | ~50KB | Good |
| Canvas 2D | Good | Medium | ~30KB | Medium |

## Consequences
- Client dependency: `xterm@5`, `@xterm/addon-webgl@5`, `@xterm/addon-fit`
- WebGL context loss handling (restore on `webglcontextrestored`)
- Touch gestures: custom handlers for pinch-zoom (font size), swipe-scroll, long-press select
- Virtual scroll: only visible rows in DOM (xterm.js handles this internally with `viewport` addon)