# Desktop review and ticket selection

> **Outcome after the UX integration (2026-10-16).** The roadmap was restructured around the UX programme (`termenbox-roadmap.md`, steps `roadmap/U02.md` to `U16.md`). From this review: R59 and R61 stay as standalone steps (P1, terminal); R36, R39 and R50 take the enriched versions; R55 is folded into U15, R56 and R60 into U07c and U15, R57 and R58 into U04 and U15 (their records are in `roadmap/archive/`); R20 is superseded by the UX design spike (its desktop evidence is not needed because the accepted design covers both widths). The findings and observations below stand as evidence.


Reviewed 2026-10-16 against `87988ac` (server v0.1.20), after discarding local tracked/untracked changes and updating master. Scope: the desktop browser client, not a native desktop app. Compared all 54 R01-R54 ticket sheets and the roadmap index against the client source and existing browser scripts. The GitHub issue tracker was not independently fetched; “existing” below means the checked-out roadmap. Subsequent unmerged remote branches are not treated as shipped behavior.

## Evidence and limits

Source and test-definition review was followed by a headless Chrome component preview on 2026-10-16. Real client components ran with simulated session/transport data; no authenticated server connection, OAuth flow, performance benchmark or minimum-browser-version check ran. The Chrome results below confirm specific UI findings, while the remaining proposals are source-based opportunities. Scores are estimates using the project's WSJF scale. No product code changed.

The desktop is already implemented: `App.svelte` chooses the layout at 720px, `SessionSheet.svelte` docks a 320px sidebar, and the shared terminal supplies tmux windows, reconnect, selection, font controls and transport status. Proposals therefore build on this client. The existing group/sort/filter UI, New window (R52), device share link (R49), UI foundation (R05) and agent status model (R54) should be reused.

| Finding | Source | Consequence |
|---|---|---|
| Sessions changes sheet height; docked mode ignores height and fixes width at 320px | `packages/client/src/App.svelte`, `SessionSheet.svelte` | Desktop sidebar cannot be collapsed/resized through this state |
| Terminal key buttons use pointerdown actions | `packages/client/src/KeyRow.svelte` | Enter/Space activation lacks the action handler |
| A tablist has no roving tab stop or arrow-key navigation | `packages/client/src/TabStrip.svelte` | Keyboard navigation becomes cumbersome with many sessions |
| No action switcher or terminal Find is wired; the tmux alternate screen has no native local scrollback | `App.svelte`, `Terminal.svelte`, `MenuSheet.svelte`, `lib/terminal/touchScroll.ts` | Add targeted navigation; investigate the history source before specifying Find |
| Full key row is rendered independently of pointer capability | `Terminal.svelte`, `KeyRow.svelte` | Offer a compact desktop choice with access to essential actions |
| Link opening is called by the touch tap path | `Terminal.svelte::tapAt/openLinkAt` | Add desktop pointer activation while preserving TUI mouse input |
| UI scripts specify mobile/touch Chromium contexts | `packages/client/e2e/{cards,touch,windows,two-servers}.mjs` | Desktop interaction/browser coverage needs its own contexts |
| Inbox and store tests already exist | `InboxSheet.svelte`, `lib/inbox.ts`, `lib/inbox.test.ts`, `App.svelte` | R13 needs verification/reconciliation before more implementation |

## Desktop browser observations

Chrome **151.0.7922.173**, desktop context (`isMobile: false`, `hasTouch: false`), against the Vite development preview of the same `87988ac` client. The existing `e2e/NavigationProbe.svelte` supplied 12 sessions across three simulated servers. A temporary probe mounted the real `Terminal.svelte` with captured outgoing messages and injected output. These are manual review probes, not committed regression tests or a passing R36 gate. The preview was run in `/tmp` using the locked pnpm dependencies; its HTTP listener bound only to `127.0.0.1`. Long commands ran through the installed go-getter watch CLI.

| Observation | Result | Ticket implication |
|---|---|---|
| Click Sessions at 721, 1024 and 1440px | Sidebar stayed visible at 320px in all three cases; no horizontal page overflow | Confirms R55's missing desktop toggle; no claim that the current layout overflows |
| Focus first of 12 tabs, press ArrowRight | Focus stayed on `alpha/session-1`; all 12 tabs remained normal tab stops | Confirms R57 |
| Focus Ctrl key button, press Enter then Space | Pressed state stayed false; pointer click changed it to true | Confirms R56 for sticky modifiers |
| Focus Control C in the real terminal, press Enter and Space | No input messages; pointer click emitted one `\u0003` byte | Confirms R56 for actual terminal input |
| Plain click and Ctrl+click on a printed HTTP(S) link | No window opened; source confirms touch-only opening path | Supports R61; a future test should derive link cell coordinates from xterm rather than this fixed-position review click |
| Close Menu with Escape | Dialog closed | Existing behavior to preserve |
| Resize terminal from 1440x900 to 1024x768 | Same xterm instance retained; outgoing resize was 126 columns x 45 rows | Existing behavior to preserve; message captured by the simulated transport, not validated by a remote PTY |
| Inspect terminal key row at 1024x768 | Row height 41px | Concrete input to R60's compact-mode proposal |

There were **no page errors in the completed Chrome preview**. Firefox and WebKit did not launch: the lockfile's Playwright expects Firefox build 1555 and WebKit 2370, but this machine has builds 1538 and 2336. Those engines are **unverified**, and installed Chrome does not establish Safari, Edge, current-2 or Safari 16 support.

Evidence: [navigation/sidebar screenshot, 1440px](assets/desktop-review/chromium-desktop-1440.png), [real terminal screenshot, 1024px](assets/desktop-review/chromium-terminal-1024.png), [captured observations and engine availability](assets/desktop-review/results.json). The navigation screenshot's terminal area is the existing fixture placeholder; the second screenshot mounts real xterm. Fixture text is synthetic.

## Candidate comparison and selected version

Criteria: **1** entirely new; **2** complete duplicate; **3** partial duplicate whose proposed scope/acceptance is better; **4** partial duplicate with additional information. “Better” means it preserves useful existing requirements and adds observable desktop outcomes and checks. Candidate IDs are review references, not a second implementation backlog.

| Candidate | Proposal | Criterion | Existing overlap | Selected version and reason |
|---|---|---|---|---|
| D01 | Collapse/resize/persist desktop sidebar | 1 | R05 provides components; R02 concerns phone focus, neither specifies sidebar behavior | New [R55](roadmap/archive/R55.md); bounded desktop behavior with resize/focus checks |
| D02 | Keyboard activation of terminal toolbars | 1 | R05 establishes UI primitives, not this event-handling fix | New [R56](roadmap/archive/R56.md); fix concrete pointer-only actions first |
| D03 | Accessible session tab navigation and actions | 1 | R02 restores focus after phone dropdowns; it does not supply a tab keyboard model | New [R57](roadmap/archive/R57.md); preserve R02's owner-iPhone closure gate |
| D04 | Searchable session/action switcher and shortcut help | 1 | Existing session filters search the sidebar; no app action/shortcut ticket | New [R58](roadmap/archive/R58.md); reuse actions and respect terminal/browser keys |
| D05 | Investigate search over tmux history and local terminal text | 1 | R43 stores encrypted cloud history; no existing ticket determines a free terminal-history search path | New research [R59](roadmap/R59.md); compare bounded history retrieval, tmux search and current-screen Find before scheduling implementation |
| D06 | Compact desktop terminal controls | 1 | R53 covers voice input; R05 covers UI foundations | New [R60](roadmap/archive/R60.md); keep dictation and other essentials accessible |
| D07 | Pointer activation of terminal web links | 1 | Touch link behavior exists; no R01-R54 ticket covers desktop activation | New [R61](roadmap/R61.md); reuse recognizer and test mouse-reporting conflicts |
| D08 | Desktop keyboard/mouse/browser regression matrix | 3 | R36 adds WebKit to mobile Chromium scripts; R03 is a real-iPhone gate | Replace [R36](roadmap/R36.md) description with expanded matrix; preserve mobile WebKit, resource gates and real-device limits |
| D09 | Responsive card design with desktop evidence | 3 | R20 asks for three card variants only at 390px | Expand [R20](roadmap/archive/R20.md); keep owner choice and phone evidence, add desktop widths and current statuses |
| D10 | Desktop drop/clipboard upload | 4 | R39 already owns file/image upload and its threat review | Enrich [R39](roadmap/R39.md) with desktop entry paths, destination binding and failure cases; retain existing server safeguards |
| D11 | Safe client updates across desktop tabs/windows | 4 | R50 already owns update channels and next-launch client updates | Enrich [R50](roadmap/R50.md) with multi-tab activation/reload tests; retain release policy and decision requirements |
| D12 | Sync saved servers and preferences from phone to desktop | 2 | R18 is the same encrypted server/settings sync; R49 supplies an interim single-server share link | Keep [R18](roadmap/R18.md); no new ticket. Its draft decision and predecessors still apply |
| D13 | Inbox with unread count and open-session action | 2 | R13 already specifies this; R12/R54 and current inbox code overlap implementation | Keep [R13](roadmap/archive/R13.md) as the verification owner, inspect remaining gaps before closing; no new build ticket |

Selected result: **7 new sheets, 2 stronger existing descriptions, 2 existing sheets enriched, 2 duplicates rejected**. The original roadmap has 45 open and 9 done steps; this adds seven open steps. R13 remains pending until its behavior is verified.

## Recommended sequence

Start with R56/R57 keyboard fixes, then R55's sidebar and R61's desktop links; each feature PR adds its own desktop regression to the existing Chromium CI job. R36 independently broadens the matrix to Firefox/WebKit and reuses those scenarios. R59 first researches real tmux history and produces a recommendation; schedule a Find implementation only after its data source and scope are established. R58 depends on R57 and R60 on R56. R20 still needs the owner's design selection; R39 and R50 keep their original larger feature scope. This sequence is a desktop workstream recommendation: the generated main roadmap still orders all work by WSJF/dependencies, and R02/R03 retain their real-iPhone blocks.

Each selected ticket uses the existing header, Score/Preds/Lane/Was, description and Done-when format. The detailed acceptance criteria live in those sheets; there is no duplicate proposal sheet to implement separately. Re-scored R20 (size 1 to 2) and R36 (size 3 to 5) account for their expanded evidence/automation scope. R59 is re-scored as research (V=7, T=3, R=5, S=3) because it resolves the history-source uncertainty rather than delivering a production search UI.

## Review findings resolved

- **P1, R59 history source:** replaced the local-scrollback implementation promise with a real-tmux research step. The outcome is a measured comparison, a recommendation and implementation acceptance criteria. Its evidence must include a token that left the viewport and behavior after reattach; no local-only query guarantee is made until a search path is chosen.
- **P2, desktop verification ordering:** R55-R58 and R60-R61 now own their Chromium desktop regression and CI registration in the same feature PR. R59 owns its real-tmux experiment. R36 owns the expanded browser matrix and reuses available scenarios, so the earlier feature tickets have an executable completion gate without an undeclared dependency on R36.

## Roadmap housekeeping discovered

- R13 is pending although `InboxSheet.svelte` and inbox store tests exist. Check open-session and read semantics in the browser before recording completion; do not implement another inbox.
- R34 has two `Status:` lines; `rank.py` reads the later prose line as the status. Preserve its substantive work, but consolidate metadata in a separate cleanup.
- R12/R54 and R49 still use branch/PR-pending wording for work now present in this checkout. Reconcile merge evidence before replacing it with PR references.
- R36's former 215 KB limit was stale; the selected ticket follows the current bundle-check script as the source of truth.
- The roadmap index says tracker writes require asking, while decision 0050 allows the go-getter write route. This review changes repository documentation only; no GitHub tickets were created or closed.

Documentation validation passed for the 61 sheet headers and predecessor references, metadata/scores on changed sheets, local review/index links, acyclic dependencies and the 13 comparison classifications. The index was regenerated with `python3 docs/plans/roadmap/rank.py`, and `git diff --check` passed. Chrome component observations above are supporting evidence; the automated product checks required by the implementation tickets remain future gates.
