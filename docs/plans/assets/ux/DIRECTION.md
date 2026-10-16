# U.1 design spike: result and decision

**Decision (owner, 2026-10-16): accepted.**
- **Mobile:** the *final mobile design* (last section of this file, prototype `f-final/`, built to `DESIGN-PRINCIPLES.md` and passing `audit.mjs`).
- **Desktop:** option A, the command-centre workspace (agent list, session detail, live terminal; sidebar, main pane, optional right pane, palette), with option B's keyboard answering (1/2/3, J/K) and option C's board as an additional fleet view later.
- **Skins:** themeable through tokens, navy dark as the default (draft decision 0110).
- **Kept from the others:** B's decision-first Home and numbered options; C's fleet state counts and board view; A's session strip and Terminal tab.
- **Screenshots** for the chosen designs: `f-final/screens/` (phone, dark and light, every screen) and `a-command/screens/` (desktop). Screenshots of the superseded options were removed to keep the repository small; the prototype sources remain and run.

Original recommendation text follows.

> **The final mobile design (last section) supersedes rounds 1 and 2 for phones. Desktop recommendations from round 1 stand.**

Date: 2026-10-16 · Status: **accepted by the owner on 2026-10-16** (see the decision above).
Prototypes (static, not wired to a server): https://termenbox.github.io/termenbox/ (sources and screenshots in this directory). Screenshots: `<direction>/screens/<screen>-<phone|desktop>-<dark|light>.png` for home, empty, empty-servers, decision, session-t1, session-t3, terminal, terminal-more, report, palette (desktop). All taken in desktop Chromium at 390 px and 1280 px, so none is an iPhone or Android check (`a-phone-check-names-its-platform`). Android: emulated only.

## What was compared

| Option | One line |
|---|---|
| **A · Command center** | Agent list, session detail and live terminal side by side (desktop); list-first phone with Overview / Transcript / Terminal tabs |
| **B · Decision inbox** | Home is the oldest waiting decision, answered in place; fleet below; terminal secondary |
| **C · Fleet board** | Columns by state (Needs you, Working, Finished, Idle), answer buttons on the card, detail in a drawer |
| **Old three** | One card-list layout in three colour skins (first spike round). Superseded, kept in git history |
| **Owner's reference image** | Style source only: desktop three-pane, dark navy. Not graded as a layout |

Skins are independent of layout (draft decision 0110): navy, graphite and teal, each dark and light, switchable on the landing page. The first-round skins were light by default and followed the OS setting; all skins now default to dark.

## Grades (1 worst, 5 best; the spike's judgement from prototypes, not user tests)

Criteria come from guardrail `ux-acceptance-targets`, decisions 0100-0103 and 0109, and the owner's complaints (small buttons, keyboard jumping, general layout). The keyboard behaviour cannot be graded from a headless-browser prototype, so it is a rule below, not a grade.

### Mobile (390 px)

| Option | Push to sent answer | Every agent's state at a glance | Touch targets, thumb reach | Terminal access | Clutter | **Total /25** |
|---|---|---|---|---|---|---|
| A · Command center | 4 (2 taps: item, option) | 3 (counts on top, list scrolls) | 4 | 5 (Terminal tab on every session, tab strip) | 4 | **20** |
| B · Decision inbox | 5 (1 tap: Home is the decision) | 2 (fleet is below the fold) | 5 (big options) | 4 (switch and "Open terminal") | 3 | **19** |
| C · Fleet board | 3 (1 tap but the card shows no question context, which breaks 0102) | 4 (all states stacked) | 3 (inline buttons wrap and crowd) | 4 (switch in the session) | 3 | **17** |
| Old three | 3 (2 to 3 taps) | 3 | 3 | 1 (no way into the terminal on phone) | 3 | **13** |
| *Recommended hybrid (projected, not prototyped)* | 5 | 4 | 5 | 5 | 4 | **23** |

### Desktop (1280 px)

| Option | Fleet overview | Answer speed | Terminal beside context | Scales to 50 sessions | Fits decision 0101 (sidebar, main, right pane, palette) | Activity and reports | **Total /30** |
|---|---|---|---|---|---|---|---|
| A · Command center | 4 | 3 (click, then answer; no shortcuts shown) | 5 | 4 (list, search, filter) | 5 | 4 | **25** |
| B · Decision inbox | 3 | 5 (stage with 1/2/3 and J/K) | 2 (terminal hidden until opened) | 4 (queue) | 3 (no right pane) | 4 | **21** |
| C · Fleet board | 5 | 4 (on the card or in the drawer) | 4 (drawer, narrow) | 3 (long columns) | 4 | 4 | **24** |
| Old three | 2 | 2 | 1 | 3 | 1 | 3 | **12** |
| *Recommended hybrid (projected, not prototyped)* | 5 | 5 | 5 | 4 | 5 | 4 | **28** |

## Recommendation

**Mobile: B's decision-first Home, A's session sheet, C's state counts.**
- Home shows one state strip (C's counts: needs you, working, failed, finished), then the oldest waiting decision with large options and a text and dictation field, then the rest of the queue, then the fleet. Push to answer is one tap.
- Every session opens as A's sheet: header, a session tab strip, and a switch between the structured view and the terminal. The terminal is always one tap away and keeps its place.
- The terminal uses the redesigned input (action chips for the detected agent, a "send a line" prompt with dictation, 48 px keys with word labels, an arrow pad, a More sheet), with the decision docked above it when something needs the user.

**Desktop: A's three-pane workspace, B's keyboard answering, C's board as a second fleet view.**
- Agent list, session detail, live terminal; answer a decision with 1/2/3 and move with J/K; palette on Ctrl/Cmd+K.
- A "Board" view of the fleet (C's columns) as an alternative to the list, later.

**Skin:** navy dark as the default (the owner's reference palette), with graphite and teal shipped; all through tokens (0110).

**Remove from the prototypes before they become designs.** A and the shared components borrow content from the owner's reference image (current task with a step checklist, runtime and uptime row, recent-activity timeline, Live/Scrollback header). The reference was for styling only. Session views show only what our decisions define: header, decision area, tier-appropriate content (T0 or T1 timeline, T2 or T3 cleaned tail), composer, tier label.

## Acceptance rules from the owner's complaints (for U.2, U.4, U.6, U.7b, U.8)

1. **Targets:** no tappable control under 44 x 44 pt, including chips, tabs, pills and keys. Tested by a Playwright bounding-box check.
2. **Keyboard stays put (iPhone):** the soft keyboard opens and closes only by the user's explicit action and stays as the user left it per session; tapping a key, chip, option, tab or the terminal never opens, closes or re-focuses it (pointerdown with preventDefault, as `KeyRow.svelte` does today). The composer or line input is the only text focus; raw terminal typing is an explicit toggle, so tapping the terminal to scroll or select does not raise the keyboard. The footer (peek, chips, input, keys) is docked to the visual viewport (`visualViewport` events, since iOS Safari ignores `interactive-widget`) and the content above scrolls; no layout jump when the keyboard appears. Verified on a real iPhone, labelled by platform; a desktop run proves nothing here.
3. **Vertical budget:** on a 390 x 844 phone with the keyboard open (291 pt tall) the terminal keeps at least 50% of the area above the keyboard; the tab strip and switch collapse, the chips are hidden, and the decision peek stays one line. Measured by `measure.mjs` in this directory (round 2: 56% to 58%).
4. **Terminal:** one tap from every session, keeps place when switching, never replaced by a modal (draft decision 0109).
5. **Layout:** the structure of a screen does not change between skins.

## What to keep from each option

- **A:** the desktop workspace, the Terminal tab and session tab strip on phone, status chips and avatars.
- **B:** decision-first Home, big numbered options, the pager ("1 of 5"), keyboard answering, "Skip to next".
- **C:** state counts and grouping, the board as a view, inline "Approve" on low-risk cards only after the question is visible.

## Not done by the spike

- No real-device check on any phone. The keyboard, safe-area, install and haptic behaviour are unverified.
- Swipe on the arrow pad, long-press select and two-finger scrollback are not drawn.
- Settings is a stub; nothing is wired to a server; first-paint time is not measured.

---

# Round 2: mobile directions including the terminal

Prototypes: https://termenbox.github.io/termenbox/ (section "Mobile, round 2"). Screens per direction: home, decision, terminal, terminal with the iOS keyboard open (an illustration, not the real keyboard), More keys, fleet, empty. Dark and light, any skin. Measured with `measure.mjs` in desktop Chromium at 390 x 844: not an iPhone check, Android emulated only.

| | **M1 · Decision first** | **M2 · Terminal first** | **M3 · Split view** |
|---|---|---|---|
| Idea | Home is the oldest waiting decision; sessions have Decision / Terminal switch | App opens in the terminal of the session that needs you; a strip of all sessions across the top; decision docked above the input | List home; a session is structured above and terminal below, with Details / Split / Terminal snap points |
| Push to sent answer | **5**: 1 tap on Home | **4**: 1 tap on the docked line (first option, question truncated), 2 taps with full context | **4**: 2 taps (item, option) |
| Every agent's state at a glance | **3**: counts, queue; all sessions 1 tap away | **4**: avatar strip with state rings, scrolls sideways; fleet pull-down 1 tap | **3**: counts, list scrolls |
| Terminal access | **4**: switch in every session and "Open terminal" | **5**: it is the main screen | **4**: snap tab |
| Terminal space (measured) | **4**: 50% closed, 56% of visible area with keyboard | **5**: 57% closed, 56% with keyboard | **3**: 21% in Split, 59% in Terminal, 58% with keyboard |
| Clutter | **3**: long Home, big card | **3**: heavy bottom stack (peek, chips, line, keys) | **4** |
| Fit with decisions 0100 and 0109 | **5**: matches decision-first Home | **3**: Home is not a decision board; terminal is first-class | **4** |
| **Total /30** | **24** | **24** | **22** |

Measured, all three: no tap target under 44 x 44 pt after the fix (two 40 px buttons in M1 became 44 px); no horizontal overflow; the terminal keeps 56% to 58% of the area above the keyboard.

**Recommendation: M1, with M2's session strip.**
- It matches the goal you set: the product chases state so users need not open the terminal (Home is the decision, one tap to answer), while the terminal stays one tap away on every session and is fully usable.
- Replace M1's name-tab strip on the session sheet with M2's avatar strip with state rings: it shows every agent's state on the terminal screen itself, and the fleet sheet pulls down from it.
- Keep M2's rule that the terminal is never behind a modal, and M3's snap idea only as a later option for tablets.
- If your real habit is to live in the terminal and glance at state, M2 is the alternative; it scores equal here, but it reverses decision 0100 (Home is a decision board), so choosing it means amending that decision.

Still not verified, because a headless browser cannot: the real iPhone keyboard (opening, closing, `visualViewport` resizing), safe areas, installed-PWA behaviour, haptics, swipe on the arrow pad, long-press select, scrollback gestures.

---

# Final mobile design (built to the spec, audited)

Prototype: https://termenbox.github.io/termenbox/f-final/ · Spec: `DESIGN-PRINCIPLES.md` · Check: `node audit.mjs f-final` (CHROME_PATH set).

This replaces taste-driven iteration with a written spec derived from Apple's 44 pt control size, WCAG 2.2 (target size, contrast), the Hoober one-handed-use findings (with his own caveat that the thumb zone is a bias, not a law), iOS Safari keyboard reports, and the usual laws (Fitts, Hick, proximity, Nielsen). One design was then built to it, and an audit checks it.

**Structure.** Four bottom tabs (Inbox, Sessions, Activity, Settings). Inbox: four fleet-state tiles with counts (no sideways scrolling), the oldest waiting decision as the hero with one filled primary option and a free-text and dictation field, then the next in the queue. A session has Decision and Terminal views under a strip of avatars with state rings. The terminal's input is one surface: a "Needs you" row with a one-tap primary answer, a line input with dictation and send (send on an empty line is Enter), and six large keys (esc, tab, ctrl, up, down, more). Everything else is in the More sheet (agent actions, navigation, control keys, symbols, function keys, tmux, tools).

**Audit result (all 9 screens x 3 skins x 2 modes): PASS.** Targets at least 44 pt and 8 pt apart (4 pt inside segmented controls and inside a single field), at most 7 controls per row, type scale 12/13/15/16/22, text contrast at least 4.5:1 (derived tokens, including a terminal palette and an `--accent-text` token), no horizontal overflow, chrome 20% of the height with the keyboard closed, the terminal 303 px (55%) of the area above the keyboard when it is open, and identical layout across skins. The audit found and drove 7 fixes before this passed (muted and accent text on dark navy, avatar letters, amber on light, terminal colours, teal accent fill, chrome height, report type sizes).

**The keyboard.** Cannot be shown by a headless browser. The spec gives rules K1 to K6, including two concrete suspects found in the current client: `Terminal.svelte` calls `focus()` after closing the paste, select and menu sheets (lines 259, 572, 617, 618), and `AppShell.svelte` re-measures and moves the shell on every `visualViewport` resize and scroll event. Both are hypotheses until confirmed on an iPhone with the existing `?debug` overlay.

**Not verified:** any real device (iPhone Safari, installed PWA, Android); haptics; first-paint time; swipe on the key row; long-press select. In light mode amber becomes a dark amber to pass contrast, which looks heavier than in dark: review on a real screen.

**Pick.** Accepted by the owner on 2026-10-16, together with the round 1 desktop direction.
