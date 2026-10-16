---
id: 0110-skins-are-themeable-through-tokens
title: The UI is skinnable: components are styled only through design tokens, and several skins ship and are user-selectable
status: active
amends: 0107-design-spike-precedes-the-build
date: 2026-10-16
track: product
accepted-by: Sergey Strebulaev <s@vivantel.dev>
tags: [client, design, theming, roadmap]
---

## Decision

- The visual direction chosen in the design spike is one **skin** of a themeable system, not a fixed palette. Every component takes colour, type, radius, spacing, elevation and motion only from design tokens (CSS custom properties); no hard-coded colours in components.
- Several skins ship (at least a dark default and a light one, plus other palettes such as graphite or teal), each with its own dark and light variant where it makes sense. The user chooses in Settings, with "follow the system" as an option and an accent colour override; the choice is stored per device.
- Status is never carried by colour alone (shape or text always accompanies it) so every skin stays accessible; each skin passes a contrast check in CI.
- The layout does not change between skins. A skin changes only tokens.

## Why

The owner wants to restyle the product freely and offer users choice without rebuilding screens. Tokens as the single contract make a skin cheap to add. This refines how step U.2 codifies the chosen direction ([[0107-design-spike-precedes-the-build]]).
