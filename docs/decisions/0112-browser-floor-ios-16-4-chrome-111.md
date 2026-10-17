---
id: 0112-browser-floor-ios-16-4-chrome-111
title: The minimum browsers are iOS Safari 16.4 and Chrome Android 111
status: active
amends: 0069-ui-foundation-tailwind-shadcn
date: 2026-10-17
track: product
accepted-by: Sergey Strebulaev <s@vivantel.dev>
tags: [client, browser-support, design, roadmap]
---

## Decision

- The minimum supported browsers are iOS Safari 16.4 (was 16) and Chrome Android 111 (was 100). Desktop Safari moves to 16.4 too; Chrome, Firefox and Edge stay at current minus 2.
- The client keeps Tailwind v4 and shadcn-svelte/bits-ui ([[0069-ui-foundation-tailwind-shadcn]]) and the token skins ([[0110-skins-are-themeable-through-tokens]]).

## Why

Tailwind v4 targets Safari 16.4, Chrome 111 and Firefox 128 (it uses `@property`, `color-mix()` and cascade layers). Holding the old floor would have meant replacing the styling layer in the UI rewrite. iOS 16.4 is also where Web Push for installed web apps starts (FACT-0016), which the product already needs. Cost: devices on iOS 16.0 to 16.3 and Chrome 100 to 110 are no longer supported.
