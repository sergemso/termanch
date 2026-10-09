---
id: 0012
title: vte Crate for Terminal Emulation in WASM
status: active
track: process
tags: [terminal, vte, wasm, emulation]
date: 2026-10-09
accepted-by: architect
---

# Decision: vte Crate for Terminal Emulation in WASM Core

## Context
The WASM core must parse ANSI/VT100/TUI escape sequences from PTY output and convert to buffer mutations. Requirements:
- Correct handling of obscure sequences (DEC private modes, SGR stacks, DCS, OSC)
- Zero-copy parsing for WASM performance
- Small WASM binary size (< 500KB for parser)
- Battle-tested (used in production terminals)

## Decision
Use **`vte` crate** (same parser as Alacritty, WezTerm, Contour).

## Integration
- WASM core implements `vte::Perform` trait
- Parser feeds `Perform` methods: `print`, `execute`, `hook`, `put`, `osc_dispatch`, etc.
- Each `Perform` call mutates the Rope buffer directly (no intermediate representation)
- Parser runs in Web Worker; only `Perform` actions cross thread boundary

## Rationale
| Parser | WASM Size | Correctness | Maintenance | Users |
|---|---|---|---|---|
| vte (chosen) | ~50KB | Excellent | Active (Alacritty team) | Alacritty, WezTerm, Contour |
| termwiz | ~150KB | Excellent | Active (WezTerm) | WezTerm only |
| Custom | ~20KB | Risky (edge cases) | Own burden | None |
| mosh port | Unknown | Mosh-compatible | High effort | Mosh |

## Tradeoffs
- **vte**: Best balance of size, correctness, maintenance
- **termwiz**: Includes GPU renderer we don't need; 3x size
- **Custom**: Too risky for terminal compatibility (vim, htop, fzf break easily)
- **Mosh port**: Mosh's terminal emulation is tightly coupled to its protocol

## Consequences
- `termanch-core` depends on `vte` with `default-features = false`, `features = ["perform"]`
- WASM target: `wasm32-unknown-unknown` with `panic = "abort"`
- `wasm-pack build --target web` produces ~800KB WASM (including Rope + CRDT + crypto)
- Parser tested against `vte` test suite + `termbench` escape sequence corpus