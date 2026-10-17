# Design tokens (U02)

The contract between a skin and the components (decisions 0110 and 0112). Source: `packages/client/src/skins.css` (values) and `packages/client/src/app.css` (`@theme`, the utilities). Components live in `packages/client/src/lib/ds/` and read only these tokens; no component names a colour, size or radius directly.

## Skins

`data-skin` on `<html>` picks the palette (`navy` default, `graphite`, `teal`); `data-theme` picks `dark` (default) or `light`. Settings stores both per device; the theme can follow the system. A skin sets every colour below and may set the radii. The layout never changes between skins (DR11).

| Token | Utility | Use |
|---|---|---|
| `--bg`, `--sunken` | `bg-bg`, `bg-sunken` | page, inset wells |
| `--panel`, `--raised` | `bg-panel`, `bg-raised` | cards, controls on a card |
| `--line` | `border-line` | borders |
| `--text`, `--soft`, `--muted` | `text-fg`, `text-soft`, `text-muted` | primary, secondary, tertiary text (all >= 4.5:1 on `--bg` and `--panel`) |
| `--accent`, `--accent-text`, `--on-accent` | `bg-accent`, `text-accent-text`, `text-on-accent` | filled accent, accent as text, text on the fill |
| `--warn`, `--on-warn` | `bg-warn`, `text-on-warn` | needs-you state and the one primary answer |
| `--ok`, `--bad`, `--info` | `text-ok`, `text-bad`, `text-info` | finished, failed, working |
| `--term`, `--term-fg`, `--t-*` | `bg-term`, `text-term-fg` | terminal surface and ANSI accents |
| `--radius`, `--radius-sm` | `rounded-card`, `rounded-control` | cards, controls |

Opacity modifiers work on every colour (`bg-warn/15`). Names used before U02 (`--bg-secondary`, `--fg`, `--border`, `--danger`, ...) are aliases and follow the skin.

## Scales (fixed in `@theme`)

- **Type:** `text-xs` 12, `text-sm` 13, `text-base` 15, `text-input` 16 (inputs, so iOS does not zoom), `text-title` 22. Mono 13 for the terminal. Other sizes do not exist as utilities.
- **Spacing:** a 4 px step (`p-1` = 4, `gap-2` = 8, `p-3` = 12, `p-4` = 16, `p-6` = 24).
- **Targets:** at least 44 x 44 (`size-11`, `min-h-11`), 8 px apart (`gap-2`); the dense key row is the documented exception (U07c).
- **Elevation:** `shadow-sheet` for sheets; cards use a border, not a shadow.
- **Motion:** `--duration-fast` 150, `-base` 200, `-slow` 250 ms, `--ease-out`. All three become 0.01 ms under `prefers-reduced-motion`, so a transition written with them is off automatically.
- **Haptics:** a short tick on a sent answer and a toggled key, a double tick on a failure; never on scroll or selection; off when the OS reduces motion. (Rule only; the Vibration API does not exist on iOS Safari, so it is Android-only until a device check says otherwise.)

## Rules the components keep

State is a word plus a glyph, never colour alone (`states.ts`). A control's text is on the type scale and its name is readable (DR7). Taps on keys, chips, options, tabs and the composer buttons call `preventDefault` on `pointerdown` so the soft keyboard stays as the user left it (K2).

## Checking

`cd packages/client && pnpm e2e:build && node e2e/gallery.mjs` loads `e2e/gallery.html` (every component) in Chrome at 390 px for 3 skins x dark and light and fails on a console error, a target under 44 pt, a gap under 8 pt, text under 4.5:1, an off-scale font size, an unnamed control, horizontal overflow or a missing state word. It writes `gallery-<skin>-<mode>-390.png` to `e2e/dist/gallery-shots/` (`SHOTS=dir` to change). Desktop Chromium only: not an iPhone or Android check.
