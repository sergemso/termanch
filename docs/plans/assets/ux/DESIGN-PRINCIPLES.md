# Mobile design principles for termenbox (U.1 spec)

Written 2026-10-16 so the final mobile design is derived from established guidance, not taste, and so every rule can be checked by `audit.mjs` in this directory or on a real iPhone. Applies to phone first; desktop follows in U.4.

## Sources

- Apple HIG, default control size 44 x 44 pt (as reported by [Deque](https://dequeuniversity.com/rules/attest-ios/1.0/touch-target-size) and [Evinced](https://knowledge.evinced.com/mobile-validations/tappable-area); Apple's own page was not fetched, treat as secondary).
- WCAG 2.2 [SC 2.5.8 Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html): 24 x 24 CSS px, or spacing so a 24 px circle on each target overlaps no other target. SC 2.5.5 (Enhanced) is the stricter 44 px level.
- WCAG 1.4.3 contrast: 4.5:1 for text, 3:1 for large text; 1.4.11: 3:1 for UI component boundaries and states that carry meaning.
- One-handed use is common: Hoober's 2013 study, 49% of 780 observed touches ([summary](https://garciamedia.com/?p=7518)). Hoober later said the thumb-zone diagrams were misread as rigid rules and that people touch and view the centre of the screen most ([Addy Osmani](https://addyosmani.com/blog/touch-friendly-design/), [Monterail](https://www.monterail.com/blog/thumb-friendly-navigation-word-oriented-design)). So: reachability is a bias toward the lower and central screen, not a law.
- iOS Safari keyboard problems in web apps: fixed bars shifting when the keyboard opens, `visualViewport.offsetTop` not resetting after it closes (iOS 26 reports: [thread 800154](https://developer.apple.com/forums/thread/800154), [thread 824765](https://developer.apple.com/forums/thread/824765), [WebKit bug 167710](https://bugs.webkit.org/show_bug.cgi?id=167710)), and an installed PWA's viewport shrinking after the first keyboard open ([write-up](https://dev.to/cederhook/fixing-the-ios-standalone-pwa-keyboard-bug-that-shrinks-your-viewport-for-good-63d), one developer's account). Not verified on our devices.
- Established laws used as design constraints: Fitts (big, near targets for frequent actions), Hick (few choices at a time, the rest behind progressive disclosure), Gestalt proximity and common region (group by container), Nielsen heuristics (visibility of system status, recognition over recall, consistency with platform conventions, error prevention).

## Rules, each with how it is checked

### Targets and spacing
- **R1** Every tappable control is at least 44 x 44 pt. *Audit: bounding boxes.*
- **R2** At least 8 pt between adjacent tappable controls. *Audit: pairwise gaps.*
- **R3** One primary action per screen state, visually dominant (filled); everything else tonal or text. *Review.*
- **R4** At most 7 controls in any row, except the terminal key row (see the exception below). Rarely used keys live in the More sheet (Hick). *Audit: count per row.*

- **Exception: the terminal key row (owner decision, 2026-10-16).** The default row stays today's 16-key row from `KeyRow.svelte` (`/ ^C ⎋ ↵ ⌃ ⌥ ⇧ ⇥ Fn ↑ ↓ ⌨ 🎤 EN A− A+`), because a six-key row does not match how the owner works. Keys are at least 44 pt tall; their width is shared across the row (about 21 pt on a 390 pt phone) with 2 pt gaps, below R1 and R2 on purpose. The system keyboard's own keys are also under 44 pt wide, but this is narrower, so it is a known usability cost, mitigated by making the row configurable (below) and by the 44 pt height. To be revisited after the real-device pass; `audit.mjs` checks the height and exempts only `.f-keys.dense`.
- **Key row configuration.** Which keys show, in what order, is a per-device user setting in Settings, with presets (today's row, a minimal 6-key row, custom) and a reset. The default is today's row. Same layout on iPhone and Android; no key row on desktop (physical keyboard), a shortcut hint line instead.

### Hierarchy and type
- **R5** A type scale of at most six sizes: 12, 13, 15, 17, 22 (+ 13 mono for the terminal). Inputs are 16 so iOS does not zoom. *Audit: distinct sizes, input size.*
- **R6** A 4 pt spacing scale (4, 8, 12, 16, 24). Related items are grouped in one container; unrelated items are separated by 16 or more (proximity, common region). *Review.*
- **R7** Labels are words. Glyph-only controls are limited to platform conventions (arrows, more, mic, send, back) and have accessible names. *Audit: aria-label or text.*

### Colour and state
- **R8** Text contrast at least 4.5:1 (3:1 for 22 px or larger) in every skin, dark and light. *Audit: computed.*
- **R9** State is never colour alone: text label plus a shape (dot, icon). *Audit: each state chip has text.*
- **R10** A latched control (a sticky Ctrl) looks different from an unlatched one without a sublabel. *Review.*
- **R11** Skins change tokens only; layout identical (decision 0110). *Audit: same boxes across skins.*

### Layout and motion
- **R12** Chrome (everything but the content) is at most 20% of the screen height with the keyboard closed. With the keyboard open the terminal gets at least 50% of the area above the keyboard. *Audit: measured.*
- **R13** Primary actions and the input sit in the lower two thirds; navigation is a bottom tab bar of four. *Audit: positions.*
- **R14** Motion 150 to 250 ms, ease-out, and none under `prefers-reduced-motion`. *Review.*
- **R15** No horizontal page scroll; safe-area insets respected. *Audit: overflow.*

### The terminal and the keyboard (engineering, from reading the client and the iOS reports; hypotheses until confirmed on a device)
- **K1** Never call `focus()` on the terminal as a side effect of closing a sheet, menu or dialog. Today `Terminal.svelte` does so at lines 259, 572, 617 and 618, which can raise the keyboard unasked.
- **K2** Tapping the terminal, a key, a chip, an option, a tab or a button never changes the keyboard state: pointerdown with preventDefault (already used by `KeyRow.svelte`), and the terminal's hidden textarea uses `inputmode="none"` unless the user turns raw typing on.
- **K3** The line input is the only default text focus. Raw typing into the terminal is an explicit toggle in More.
- **K4** One source of truth for height: `visualViewport.height`, applied only when the keyboard state changes (open, closed) and after the animation settles (about 250 ms), not on every `scroll` and `resize` event during the animation. The page itself never scrolls (`position: fixed; inset: 0; overflow: hidden`), and `visualViewport.offsetTop` is reset to 0 after the keyboard closes. Today `AppShell.svelte` re-measures on every `resize` and `scroll` event and moves the shell by `box.top`.
- **K5** The installed-PWA viewport shrink is tested separately on a real iPhone (installed PWA, open and close the keyboard five times, compare `innerHeight` with the first reading using the existing `?debug` overlay).
- **K6** Platform label on every result: iPhone Safari, iPhone installed PWA, Android emulated only.

## Derived design decisions

1. **Home shows fleet state without scrolling or tapping**: four equal tiles with counts (needs you, working, failed, finished), not a sideways-scrolling chip row (hidden content breaks visibility of status).
2. **Home's hero is the oldest waiting decision** with one filled primary option and the others tonal (R3), followed by the rest of the queue.
3. **A session has two views, Decision and Terminal**, in a segmented control directly under a session strip of avatars with state rings. Chrome stays under 20% (R12).
4. **The input dock is one surface with three rows at most**: the decision line when something needs the user, the line input with dictation and send, and the key row (today's 16-key row by default, configurable; see the exception above). Send on an empty line is Enter.
5. **Everything else is one tap away in the More sheet**, grouped: agent actions, navigation, control keys, symbols, function keys, tmux, tools (paste, copy, select, text size, raw typing).
6. **Skins are tokens**, switchable in Settings (draft decision 0110).
