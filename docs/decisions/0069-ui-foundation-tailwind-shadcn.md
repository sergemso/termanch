---
id: 0069-ui-foundation-tailwind-shadcn
title: The client UI is built with Tailwind v4 and shadcn-svelte
status: active
date: 2026-10-12
track: process
accepted-by: Sergey Strebulaev <s@vivantel.dev>
tags: [client, build, mobile]
---

## Decision

- The client uses Tailwind CSS v4 (build-time, no runtime) and shadcn-svelte components (bits-ui headless primitives) copied into `packages/client/src/lib/ui/`.
- Existing CSS variables become design tokens; inline `style` strings and the global `button` rules are removed as screens are converted.
- Sidebar, Tabs, Context Menu, Sheet and Dialog come from shadcn-svelte instead of hand-written code.
- Conversion is incremental: `Toast` and `AddServerModal` first, then each screen as its plan step touches it.

## Why

Layout bugs are fixed one inline style at a time today; every new control (collapsible sidebar, tabs, long-press menu) would repeat hand-built focus, touch and accessibility work. Copied components add no runtime dependency on a kit and stay within the bundle gate if measured. Checks before relying on it: bundle stays under 2 MB, the CSP in `_headers` still holds, bits-ui long-press works on iOS. See [[0070-session-navigation-and-connections]].
