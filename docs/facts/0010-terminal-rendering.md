---
id: 0010
title: Terminal Rendering Approach
status: active
tags: [client, rendering, xterm, webgl]
date: 2026-10-09
---

# Terminal Rendering Approach

**Library**: xterm.js v5+ with `@xterm/addon-webgl`

**Why xterm.js WebGL**:
- Mature ANSI/VT100/TUI parser (handles edge cases other renderers miss)
- WebGL addon uses GPU texture atlas for glyph rendering — 60fps scroll on mobile
- Addon system supports custom extensions (ligatures, images, hyperlinks)
- Actively maintained; used by VS Code, GitHub Codespaces, GitPod

**Mobile optimizations**:
- `drawBoldTextInBrightColors: true` for OLED contrast
- `letterSpacing: 0, lineHeight: 1.2` tuned for mobile fonts
- Viewport-only rendering (virtual scroll) — DOM nodes only for visible lines
- Touch gesture handlers: swipe scroll, pinch zoom (font size), long-press select

**WASM integration**: xterm.js runs in main thread; WASM core in Web Worker. Communication via `postMessage` with `Transferable` ArrayBuffers for zero-copy delta frames.