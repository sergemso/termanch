# Termanch Roadmap: every open step in one plan, ordered by WSJF and dependencies

Written 2026-10-14 by consolidating plans v1-v10 and session-tabs (now in `docs/plans/archive/`) after checking each step against the code and `git log`. This file alone is enough for a cold session.

## Cold start

Repository: Rust server `packages/server`, shared wire types `packages/core/src/protocol.rs` (mirrored by hand in `packages/client/src/lib/protocol.ts`), Svelte 5 client `packages/client/src` (`npx --yes pnpm@9`), directory Pages Functions `packages/client/functions/api`. Knowledge base in `docs/{facts,decisions,guardrails,skills}`; read `CLAUDE.md` first. One squashed pull request per step from its own branch off master, green CI, merge only on the owner's "merge" (guardrails `changes-land-as-one-squashed-pull-request`, `no-commits-on-the-default-branch`). Constraints: 512 MB RAM, 1 vCPU, no paid services in the required stack, secrets never logged, builds only in CI. The owner tests on an iPhone; emulated Chrome is never claimed as a phone check. Never touch the owner's own `termanch.service` (read its journal only). Pre-push hook: commit subject `type(scope): ...` with a one-word scope. Plans are tracked in GitHub issues (decision 0049); ask before writing to the tracker.

## How to use this plan (cheap to re-enter and update)

1. Read only this file: the Order table below is generated, one line per open step, in the order to work. Take the first `pending` row whose predecessors are done.
2. Open that step's file (`roadmap/Rnn.md`, 5-40 lines: Status, Score, Preds, Lane, Was, then the full instructions). Read nothing else unless the step names it.
3. When the step lands, change its `Status:` line to `done (PR #n)`, then run `python3 docs/plans/roadmap/rank.py`; it rewrites the table. To re-score or add a step, edit or create the file (copy a neighbour for the header) and run the same command.
4. Old step names inside the text (G.4, O.2, U.1) are from the plans in `docs/plans/archive/`; each file's `Was:` line says where it came from.

Scoring (the procedure `docs/skills/prioritise-the-roadmap-by-wsjf.md`): `Score: V= T= R= S=` is value, time criticality, risk or opportunity (1-10) and size (1, 2, 3, 5, 8, 13); WSJF = (V+T+R)/S. A step takes the best score of any chain it unlocks. `Lane: paid` steps come after the free ones (decision 0093); `Pin: after Rnn` keeps a step where the owner put it. The scores are the author's estimates.

Status values: `pending`, `blocked (reason)`, `done (PR #n)`.

## Order

<!-- order:start -->
| # | Step | Title | Status | WSJF | Preds |
|---|---|---|---|---|---|
| 1 | [R02](roadmap/R02.md) | Triage bugs #107 (focus lost on tab tap) and #99 (canvas shifts on Sessions tab) | pending | 9.5 | - |
| 2 | [R10](roadmap/R10.md) | Spike: connector payload and abuse review (O.1) | pending | 8.5 | R01 |
| 3 | [R03](roadmap/R03.md) | Real-iPhone checklist and two-real-server e2e (G.10, H.11) | pending | 8.0 | R02 |
| 4 | [R05](roadmap/R05.md) | Tailwind v4 + shadcn-svelte foundation (U.1, 0069) [owner-pinned next] | pending | 1.9 | R03 |
| 5 | [R37](roadmap/R37.md) | Session sharing: decision and threat review (new) | blocked (owner acceptance of draft decision 0094) | 7.0 | R01 |
| 6 | [R08](roadmap/R08.md) | Privacy notice and delete-my-data (S.6) | pending | 6.3 | - |
| 7 | [R20](roadmap/R20.md) | Card design pass: owner picks a variant (K.1) | pending | 6.0 | - |
| 8 | [R22](roadmap/R22.md) | Badge, stats sheet and Say thanks (T.2) | pending | 6.0 | - |
| 9 | [R36](roadmap/R36.md) | WebKit in CI (new) | pending | 6.0 | - |
| 10 | [R07](roadmap/R07.md) | Request-budget alarm (C.5) | pending | 5.0 | R06 |
| 11 | [R32](roadmap/R32.md) | Key rotation and incident runbook (S.8) | pending | 4.3 | - |
| 12 | [R09](roadmap/R09.md) | Directory abuse controls and degraded mode (S.4) | pending | 4.0 | R06 |
| 13 | [R35](roadmap/R35.md) | Make the local e2e throughput step pass on the dev VPS | pending | 4.0 | - |
| 14 | [R26](roadmap/R26.md) | Directory deregistration (D.2) | pending | 3.7 | - |
| 15 | [R34](roadmap/R34.md) | Self-hosted client docs (rest of 5.1) | installer and CI image done (8.5); self-hosted client docs and the size/RSS gates remain (see v2 step 0.2). | 3.5 | - |
| 16 | [R27](roadmap/R27.md) | Remote uninstall on the native host (N.6) | pending | 2.2 | - |
| 17 | [R11](roadmap/R11.md) | Rule engine, connector trait and outbound guard (O.2) | pending | 2.0 | R10 |
| 18 | [R12](roadmap/R12.md) | Web Push and inbox (O.3) | pending | 2.6 | R11 |
| 19 | [R13](roadmap/R13.md) | Inbox view in the sessions UI (K.6) | pending | 4.3 | R12 |
| 20 | [R21](roadmap/R21.md) | Verify the Codex adapter against a real Codex (P.5) | pending | 3.3 | - |
| 21 | [R25](roadmap/R25.md) | Server settings screen: name, mode, re-claim (B.3) | pending | 3.3 | R05 |
| 22 | [R17](roadmap/R17.md) | Signed records on R2 behind the CDN (C.3) | pending | 2.4 | R06, R09 |
| 23 | [R18](roadmap/R18.md) | Owner-keyed server list and settings sync (C.4, 0068) | pending | 1.5 | R01, R06, R17 |
| 24 | [R19](roadmap/R19.md) | Cache event and Claude status-line forwarder (G.8) | pending | 2.6 | - |
| 25 | [R16](roadmap/R16.md) | Rules screen (O.6) | pending | 2.4 | R11, R12, R05 |
| 26 | [R50](roadmap/R50.md) | Release channels and auto-update policies for server and client | pending | 2.4 | - |
| 27 | [R51](roadmap/R51.md) | Cloudflare isolation, usage dashboard and threshold alerts | pending | 2.4 | R07 |
| 28 | [R23](roadmap/R23.md) | Bundle a pinned static tmux (replaces 7.2; needs a decision) | pending | 2.2 | - |
| 29 | [R14](roadmap/R14.md) | Telegram and generic webhook (O.4) | pending | 2.2 | R11 |
| 30 | [R31](roadmap/R31.md) | Passkey step-up for root sessions and device revocation (S.2) | pending | 2.1 | - |
| 31 | [R28](roadmap/R28.md) | Remove server flow in the app (D.4, container parts of D.3) | pending | 2.0 | R26, R27, R05 |
| 32 | [R29](roadmap/R29.md) | Migrate Docker host installs (N.7) | pending | 1.8 | - |
| 33 | [R30](roadmap/R30.md) | Remove the Docker host code (N.8) | pending | 2.0 | R29 |
| 34 | [R38](roadmap/R38.md) | Session sharing links, read-only and read-write (new) | pending | 1.8 | R37 |
| 35 | [R39](roadmap/R39.md) | Image and file upload to a session, with threat review (new) | pending | 1.6 | - |
| 36 | [R15](roadmap/R15.md) | Session and model connectors (O.5) | pending | 1.4 | R10, R11 |
| 37 | [R24](roadmap/R24.md) | Environment profile on the native host (replaces B.4-B.6) | pending | 1.1 | R23 |
| 38 | [R33](roadmap/R33.md) | Managed quick-tunnel fallback for hosts with no UDP port (8.3) | pending | 1.0 | R06 |
| 39 | [R40](roadmap/R40.md) | The free gate check (P.1) | pending | 0.0 | R03, R12, R18 |
| 40 | [R41](roadmap/R41.md) | Entitlement record and Sponsors webhook (P.2) | blocked (R40, the free gate) | 2.6 | R40 |
| 41 | [R46](roadmap/R46.md) | Privacy notice and opt-ins for Pro data (P.7) | blocked (R40, the free gate) | 4.7 | R41, R08 |
| 42 | [R42](roadmap/R42.md) | Pro: managed relay spike (P.3) | blocked (R40, the free gate) | 4.3 | R41 |
| 43 | [R43](roadmap/R43.md) | Pro: encrypted history format and recovery key (P.4) | blocked (R40, the free gate) | 1.4 | R41 |
| 44 | [R47](roadmap/R47.md) | Team: organisation, seats, merchant of record (P.8) | blocked (R40, the free gate) | 0.7 | R40, R41 |
| 45 | [R48](roadmap/R48.md) | Enterprise design note (P.9) | blocked (R40, the free gate) | 1.5 | R47 |
| 46 | [R44](roadmap/R44.md) | Pro: reliable push and inbox retention (P.5) | blocked (R40, the free gate) | 1.2 | R43 |
| 47 | [R45](roadmap/R45.md) | Pro: fleet view and usage reports (P.6) | blocked (R40, the free gate) | 1.2 | R43 |

4 step(s) done (their files stay in `roadmap/`; `grep -l '^Status: done' roadmap/R*.md`).
<!-- order:end -->

## Paid tiers (decisions 0089-0093, fact 0035)

| Tier | Contents | Source |
|---|---|---|
| Free | Sessions, agents, tabs, notifications, Web Push, settings and server-list sync (0068), read-only and read-write session sharing, several users per server, isolated per-user environments (need host mode, 0065). No artificial caps | 0089 |
| Pro | Managed relay, cloud session history, reliable push with inbox, fleet view and usage reports. All client-encrypted, recovery key | 0090 |
| Team | Organisation, seats and invoices, shared directory and groups, shared inbox and history, provisioning of isolated environments across servers | 0091 |
| Enterprise | SSO/SAML, central audit retention and export, support. RBAC and DLP enforced on the host, metadata-only reporting. Not scheduled until a customer exists | 0091 |

Billing: GitHub Sponsors webhook sets an entitlement on the GitHub id; a merchant of record arrives with Team (0092).

Never build into a paid tier what `docs/skills/classify-a-feature-into-a-tier.md` puts in free. R40-R48 are the paid lane (`Lane: paid`).

## Already done (do not redo)

Verified against the code and `git log` on 2026-10-14: browser-capability facts, green baseline, single-owner binding, reconnect and replay, signed directory, one-command installer, WebRTC direct (server and client), mobile terminal UX (#46), installable PWA (#51), browser e2e and resource gates (#44), session list and templates (session-tabs H.10), herdr and backend verdict (fact 0029, #82), run modes, device-key credentials (#55), web baseline CSP (#41), signed releases, root helper and updater (#74, #77), change journal (#73), static musl binary (#72), agent events and adapters (v6 P.1-P.6 except Codex), session cards, answers and replies (v8 K.2-K.5), navigation G.1-G.5, session tabs H.1-H.10, swipe typing fixes, remote uninstall stage 1 (D.1), usage meter (T.1), problem reports (R.1), connection manager, AppShell and viewport fix.

## Backlog (unscored, no step yet)

- Connect Cloudflare for stable tunnels (was v1 8.6, #29): for owners with their own domain; needs a go/no-go decision. R33 covers hosts with no UDP port without an account.
- Own server-native multiplexer backend (was v1 7.2, #23): only if tmux limits bite; `SessionBackend` (0054) allows it later.
- Model connector (v7 question 3): deferred.
- tmux windows bundling beyond the static binary, ACP (0079 says out of scope).

