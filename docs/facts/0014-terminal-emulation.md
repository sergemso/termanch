---
id: 0014
title: Terminal Emulation Library
status: active
tags: [terminal, vte, wasm, emulation]
date: 2026-10-09
---

# Terminal Emulation Library

**Library**: `vte` crate (used by Alacritty, WezTerm, Contour)

**Why vte**:
- Battle-tested: handles obscure VT100/ANSI/DEC sequences correctly
- Zero-copy parser design — efficient in WASM
- No allocation in hot path (uses `Perform` trait callbacks)
- Supports all features needed: SGR, cursor, scroll regions, DEC private modes, OSC, DCS
- ~50KB WASM size (with `std` feature off)

**Integration**: WASM core implements `vte::Perform` to feed parsed actions into Rope buffer. Parser runs in Web Worker; only actions (not raw bytes) cross thread boundary.

**Alternative considered**: `termwiz` (WezTerm's) — richer but 3x WASM size, includes GPU renderer we don't need.