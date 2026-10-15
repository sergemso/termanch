> Archived 2026-10-14. Every open step was moved into `docs/plans/termenbox-roadmap.md` (see the `[>]` markers); this file is history.

# Termenbox Plan: environment, app/session/agent UX, directory scale

Companion to `termenbox-v1.md`, which still owns #15, #16, #20, #23, #26 and #29; its steps 3.1, 3.2, 4.1, 6.1 and 7.1 moved here (A.1, A.2, B.7, 0.2, B.1). Archive v1 when #15 and #16 close. Decisions: 0058 run modes, 0059 environment profile, 0060 directory scale, 0061 agent state and push; guardrails `host-mode-explicit-consent`, `directory-request-budget`; fact 0022. Order, by decision: mobile UX + PWA first, then environment, then directory scale. A fresh session needs only this file, those artifacts and the repo.

Repo facts for a cold start: Rust server `packages/server` (tmux/PTY via `SessionBackend`, WebRTC in `rtc.rs`, directory announcer in `directory.rs`), Svelte 5 client `packages/client` (`src/App.svelte`, `AddServerModal.svelte`, `ServerList.svelte`, `lib/`), Cloudflare Pages Functions in `packages/client/functions/api/{oauth,directory}`, installer `packages/client/public/install.sh`, image `docker/Dockerfile`. Use `npx --yes pnpm@9`. Hosted client https://app.termenbox.dev. Land every step as one squashed PR with green CI.

## Phase 0: finish v1

### 0.1 Close the real end-to-end check (#15, #16) — [x]
Class: debug · Needs: none · Check: `gh issue view 15 --json state -q .state | grep -q CLOSED && gh issue view 16 --json state -q .state | grep -q CLOSED`
Context: Login works (fixed in #37). Server added and connected; typing and the drop/restore test are not yet confirmed by the owner. Server list identity fix is PR #38.
Do: 1. Merge #38. 2. With the owner, type in a terminal, drop the network for 10 s, confirm re-attach with screen replay. 3. Fix findings, close #15 and #16.
Done-when: both issues closed with the evidence in a comment.

### 0.2 Browser end-to-end test and resource gates in CI (#21) — [x]
Class: implement · Needs: 0.1 · Check: `gh workflow list | grep -qi e2e`
Context: Harness is not in the repo; build a vite bundle of Connection+waitForServer, run Chromium (`playwright-core`, update the lockfile with `npx pnpm@9`) with `--disable-web-security` against the real binary with `TERMENBOX_DEV_INFO=on` and `TERMENBOX_GITHUB_API` pointing at a stand-in. Gates: server RSS under 512 MB under load, image size reported and capped.
Do: add the e2e job and gates to `.github/workflows`; keep it under the free CI minutes.
Done-when: CI runs the test on a PR and fails when RSS or image size exceed the limits.

## Phase A: mobile UX and PWA

### A.1 Mobile terminal UX (#17) — [x] done (PR #46)
Class: implement · Needs: 0.1 · Check: `cd packages/client && npx --yes pnpm@9 build && npx --yes pnpm@9 test`
Context: Mobile is the product's core promise. Today the client is desktop-oriented.
Do: 1. Key row (Esc, Tab sticky Ctrl, Alt, arrows, `| ~ /`, paste) and a visualViewport-aware layout. 2. Touch scroll, pinch font size, long-press select, two-finger paste. 3. Responsive server list and Add Server modal; status bar with transport (direct/WebSocket) and RTT. 4. Record real-device results (iOS Safari 16+, Chrome Android 100+).
Done-when: on a phone, `ls`, Esc/Ctrl combos and scrolling work; results recorded in `docs/facts`.

### A.2 Installable PWA (#18) — [x] done (PR #51)
Class: implement · Needs: A.1, S.5 · Check: `ls packages/client/dist/manifest.webmanifest`
Context: iOS Web Push requires an installed PWA (0061). `packages/client/public/manifest.json` exists; there is no service worker.
Do: 1. Manifest, icons, service worker caching static assets only (no tokens in Cache/IndexedDB). 2. On visibilitychange/online, trigger reconnect. 3. Install prompt.
Done-when: installable on Android and iOS; cold start from cache shows the shell offline.

### A.3 Session list and templates — [x] done: session-tabs H.10
Class: implement · Needs: A.1 · Check: `cd packages/client && npx --yes pnpm@9 test`
Context: Sessions are listed by name only. `new_session` takes a name (`App.svelte`).
Do: 1. Session cards with backend, cwd, running command, last activity. 2. New-session templates (Shell, Claude Code, Codex, herdr, custom command) and directory picker from the server's recent repos. 3. Rename, kill with confirm, duplicate; swipe actions on mobile. 4. Session switcher as bottom sheet on phones. Protocol additions go through `packages/core` and the server `connection.rs`.
Done-when: a user can start Claude Code in a chosen directory from a phone in under 5 taps.

## Phase B: environment and agents

### B.1 herdr and backend CLI verdict (#22) — [x] done: fact 0029, PR #82
Class: explore · Needs: 0.1 · Check: `test -s docs/facts/0017-backend-clis.md`
Context: See v1 step 7.1. herdr 0.9.x ships release binaries `herdr-linux-{x86_64,aarch64}`.
Do: as v1 7.1. Note whether herdr fits the command backend or needs an adapter on its socket API.
Done-when: each tool has a verdict and a tested snippet or a written reason.

### B.2 Run modes on the server and installer (0058) — [x] (host-user path verified by unit tests only; the dedicated user was not created on the dev VPS)
Class: implement · Needs: 0.1, S.1 · Check: `cargo test -p termenbox-server`
Context: Container mode is today's behaviour. Host mode runs the container with `--pid=host --privileged` and prefixes session commands with `nsenter -t 1 -m -u -i -n -p`; owner picks root or a dedicated `termenbox` user at install. Guardrail `host-mode-explicit-consent` applies.
Do: 1. `TERMENBOX_RUN=container|host` plus `TERMENBOX_RUN_USER`, with the dedicated user pre-selected and root an explicit choice; startup self-check with a clear error. 2. `install.sh` accepts `host` and `host-user`, creates the user, passes flags. 3. Audit entry when a host session opens; mode in the server info message. 4. Test on a second container on a free port, leaving the running one alone.
Done-when: host mode shows the host's `/etc/hostname` and processes; container mode does not; tests pass.

### B.3 Add Server mode choice and server settings — [>] moved to docs/plans/termenbox-roadmap.md as R25
Class: implement · Needs: B.2, A.1 · Check: `cd packages/client && npx --yes pnpm@9 test`
Context: `AddServerModal.svelte` builds the command through `lib/onboard.ts installCommand`. Do this after step U.1 of docs/plans/termenbox-v3-ui.md (the UI foundation) so the screen is written once. Host mode is native since decision 0075 (no Docker); the install words `host` and `host-user` are unchanged.
Do: mode radio with the host warning, root/user choice, mode badge on server card and session header, a Server settings screen (name, mode, remove, re-claim).
Done-when: the generated command and QR carry the choice; badge visible.

### B.4 Environment profile on the server (0059) — [x] retired: replaced by roadmap R24 (native host)
Class: implement · Needs: B.2, B.1, S.7 · Check: `cargo test -p termenbox-server`
Context: Profile lives in `$TERMENBOX_CONFIG_DIR/env.json`, owner-only edits.
Do: 1. `env.json` schema (tmux, herdr, zellij, claude, codex, extras). 2. `termenbox-server --ensure-env`, idempotent, run at start and on `set_env`; container installs into the volume, host installs via detected package manager (apt first) for ticked components only. 3. Stream progress; audit-log without output.
Done-when: ticking a component installs it; re-running changes nothing; unticked ones are untouched.

### B.5 Environment checkboxes in the app — [x] retired: replaced by roadmap R24
Class: implement · Needs: B.4, B.3 · Check: `cd packages/client && npx --yes pnpm@9 test`
Do: checkboxes in Add Server and Server settings, progress view, defaults tmux and herdr on.
Done-when: a profile change from a phone is applied on the server and shown after reload.

### B.6 Bundle herdr and keep it updated (0059) — [x] retired: replaced by roadmap R24 and R23
Class: implement · Needs: B.1, S.3 · Check: `grep -q herdr docker/Dockerfile && test -f .github/workflows/image-refresh.yaml`
Do: 1. Dockerfile fetches the release binary per arch. 2. `termenbox-updater` (daily, GitHub releases, checksum when published, keep previous, rollback on failed health check). 3. Scheduled and release-triggered image rebuild. 4. Image size within the #21 gate.
Done-when: a container started from an old image updates herdr within 24 h; rollback tested.

### B.7 Agent state detection (#19, 0061) — [x] done: v6 P.1-P.6
Class: implement · Needs: B.1, 0.1 · Check: `cargo test -p termenbox-server`
Do: process-tree scan per pane for claude/codex/herdr; states idle/working/needs input/done/error; adapters for herdr status and Claude/Codex hooks; documented heuristic; audit without output; protocol message to clients.
Done-when: running `claude` or `codex` in a pane shows state changes within 5 s.

### B.8 Agent UI, inbox and Web Push — [>] moved to docs/plans/termenbox-roadmap.md as R12 and R13 (cards, banner and tab badge are done)
Class: implement · Needs: B.7, A.2, A.3 · Check: `cd packages/client && npx --yes pnpm@9 test`
Do: state chips, "needs you" inbox, tab badge, quick-answer buttons for y/n and numbered choices, installed-PWA Web Push (VAPID, no terminal text in the payload) with in-app fallback.
Done-when: with the PWA closed, a needs-input event reaches the phone.

## Phase S: security (decisions 0062–0067, fact 0023)

### S.1 Device-key credentials (0062) — [x] (code; needs the `CERT_SIGNING_KEY` Pages secret before deploy; device list for revoke UI is S.2)
Class: implement · Needs: 0.1 · Check: `cargo test -p termenbox-server && cd packages/client && npx --yes pnpm@9 test`
Context: Today `App.svelte` passes `githubToken` to `Connection` (`token: () => githubToken!`) and `packages/server/src/auth.rs` `identify()` asks GitHub who owns it, so every server sees a replayable token. Guardrail `github-token-stays-in-browser`. `packages/client/functions/api/oauth/exchange.ts` already holds `GITHUB_CLIENT_SECRET`.
Do: 1. Client: non-extractable ECDSA P-256 key in IndexedDB. 2. Function: after the OAuth exchange, sign a device certificate (GitHub id, device public key, 7-day expiry, `kid`) with an Ed25519 key from a new Pages secret `CERT_SIGNING_KEY`; keep the cached `CryptoKey` in module scope (10 ms CPU limit); do not return the GitHub token to the browser beyond what the app needs, and never send it to servers. 3. Server: accept `kid`-addressed public keys from config, verify certificate and a signature over a server challenge that includes the `server_id`; keep the owner check and claim flow of 0053. 4. Per-owner revoked-device list stored on the server. 5. Remove the token from the wire protocol (`packages/core`), update tests and the e2e harness.
Done-when: a connection succeeds with a certificate; a connection replayed to a different `server_id`, an expired or revoked certificate, and a certificate from an unknown `kid` all fail; the GitHub token appears in no server message or log (test greps both).

### S.2 Passkey step-up for root and device revocation (0065) — [>] moved to docs/plans/termenbox-roadmap.md as R31
Class: implement · Needs: S.1, B.2 · Check: `cargo test -p termenbox-server`
Context: Root host sessions (decision 0058) must not rely on the device certificate alone.
Do: 1. WebAuthn registration at install (QR/command flow) and an assertion check every 12 h before a root session; verify on the server. 2. App: active sessions list, revoke device, end session. 3. Audit entries without session content.
Done-when: a root session cannot start without a fresh assertion; revoking a device ends its sessions; tests cover both.

### S.3 Signed releases, pinned installer, freeze file (0063) — [x] done: v5 N.2 (signed releases)
Class: implement · Needs: 0.2 · Check: `grep -q cosign .github/workflows/docker-build.yaml && grep -q '@sha256:' packages/client/public/install.sh`
Context: CI builds the image in `.github/workflows/docker-build.yaml`; `packages/client/public/install.sh` uses `ghcr.io/termenbox/termenbox:latest`. Guardrail `releases-are-signed`.
Do: 1. cosign keyless signing in CI for images and bundled artifacts. 2. A release step rewrites the installer with the published digest and verifies the signature (cosign or a digest check) before running. 3. A signed `freeze` file on the CDN that the installer and updater check. 4. Document hardware-key 2FA, scoped tokens, branch protection for installer, Dockerfile and workflows.
Done-when: a tampered image or a published freeze file makes the installer stop; CI proves it with a test image.

### S.4 Directory abuse controls and degraded mode (0064) — [>] moved to docs/plans/termenbox-roadmap.md as R09
Class: implement · Needs: C.2 · Check: `cd packages/client && npx --yes pnpm@9 test`
Context: `packages/client/functions/api/directory/_lib.ts` has `NEW_IDS_PER_SRC_PER_HOUR` and `MIN_ANNOUNCE_INTERVAL_MS`; abuse still costs Worker requests. Guardrail `directory-request-budget`.
Do: 1. Cloudflare rate-limiting rule for announce (document and apply with the API token). 2. Hashcash proof for a new `server_id`, produced by the server, verified in `parseAnnounce`. 3. Client `connectToServer` falls back to the cached record when the directory returns 429/5xx. 4. Message on fresh install when the directory is down.
Done-when: unproven new ids are rejected; with the directory forced to 503 an existing server still connects.

### S.5 Web baseline: CSP and SECURITY.md (0066) — [x]‖
Class: implement · Needs: none · Check: `test -f packages/client/public/_headers && test -f SECURITY.md`
Context: Fact 0023 notes the hosted client's headers were not checked.
Do: 1. Check current headers with `curl -I`. 2. Add `_headers` (strict CSP without inline script, frame-ancestors none, HSTS, nosniff, referrer policy); fix any inline script the build emits. 3. `SECURITY.md` with the advisory channel and 90-day window. 4. Verify the app still works (login, add server, terminal).
Done-when: `curl -I` shows the headers and the e2e or a manual login passes.

### S.6 Privacy notice and delete-my-data (0066) — [>] moved to docs/plans/termenbox-roadmap.md as R08
Class: implement · Needs: S.5, C.4 · Check: `cd packages/client && npx --yes pnpm@9 test`
Do: privacy page in the client; authenticated `POST /api/me/delete` removing the owner list and the records of that owner's servers; tests; retention (30 days idle) stated.
Done-when: after deletion, lookups of that owner's servers return 404 and the list is empty.

### S.7 Change journal, dry-run and revert (0067) — [>] moved to docs/plans/termenbox-v5-native-host-mode.md as step N.3
Class: implement · Needs: B.2 · Check: `cargo test -p termenbox-server`
Context: Guardrail `host-changes-are-journaled`.
Do: journal in the config dir; every installer and profile change writes an entry before applying; `--dry-run` list; `termenbox-server --revert`; image rollback after a failed health check; short terms page.
Done-when: installing then reverting in a test container restores the starting state; a failed health check restores the previous image.

### S.8 Key rotation and incident runbook — [>] moved to docs/plans/termenbox-roadmap.md as R32
Class: plan · Needs: S.1, S.3 · Check: `test -s docs/skills/incident-response.md`
Do: write a procedure in `docs/skills/incident-response.md` for leaked certificate signing key (rotate by `kid`), compromised release (freeze file, revoke), directory flood, and disclosure handling; rehearse each once on a staging project.
Done-when: the procedure exists and each scenario has a recorded rehearsal.

## Phase C: directory scale (0060, fact 0022)

### C.1 Spike: R2 + CDN limits — [x]‖
Class: explore · Needs: none · Check: `test -s docs/facts/0024-r2-cdn-spike.md`
Context: Free limits in fact 0022 are unverified. Zone `vivantel.dev` is on Cloudflare; the Cloudflare token is in the repo `.env` (never print it).
Do: create a public R2 bucket on a custom domain (e.g. `dir.termenbox.dev`), set a Cache Rule (1 h edge TTL), measure that repeated GETs do not invoke any Worker or class B operation, confirm free-tier numbers from Cloudflare docs, record the verdict and update fact 0022.
Done-when: fact 0024 states pass/fail with measurements.

### C.2 Announce on change plus 7-day keepalive — [>] moved to docs/plans/termenbox-roadmap.md as R06
Class: implement · Needs: none · Check: `cargo test -p termenbox-server`
Context: `packages/server/src/directory.rs` has `REFRESH_EVERY` = 12 h.
Do: announce on IP/port/fingerprint/claim change and every 7 days; unclaimed 5 min stays; adjust tests; update fact 0022.
Done-when: a claimed idle server announces once per 7 days (test with a fake clock).

### C.3 Signed records on R2 behind the CDN — [>] moved to docs/plans/termenbox-roadmap.md as R17
Class: implement · Needs: C.1, C.2, S.4 · Check: `cd packages/client && npx --yes pnpm@9 test`
Do: `announce` writes `r/<id>.json` to R2; client `lookup` reads the CDN URL and retries with `?v=<seq>` on failed connect; D1 stays for claims until verified in production; migrate with rollback.
Done-when: lookups produce zero Worker requests in Cloudflare analytics over a test day.

### C.4 Owner-keyed server list and settings (0068) — [>] moved to docs/plans/termenbox-roadmap.md as R18
Class: implement · Needs: C.2, C.1, C.6 · Check: `cd packages/client && npx --yes pnpm@9 test`
Do: per-user encrypted object (list plus settings) read from the public domain with `no-cache`, written by a Worker with a conditional put; HKDF per-user secret issued with the device certificate; changes relayed to the owner's other connected devices through the servers' data channel; local outbox when a write fails; merge with localStorage on first login. Depends on the C.1 and C.6 verdicts for the storage layer.
Done-when: a server added in one browser appears in an open second browser within seconds, and on a closed one at its next open, with no Worker request for reads.

### C.6 Spike: a free write path without Workers and R2 writes — [x]‖
Class: explore · Needs: none · Check: `test -s docs/facts/0025-free-write-path-spike.md`
Context: Decision 0068 is a draft; the owner asked whether announces, claim polling and user-data writes can leave Cloudflare Workers and R2 Class A entirely. Candidates: (1) an open relay network such as Nostr (signed, replaceable, encrypted events; subscriptions give live push and replace claim polling; several free public relays plus an optional own relay), with the Worker kept only for certificate issuance and key derivation; (2) our own directory on an always-free VM (Oracle or Google) behind the Cloudflare CDN; (3) sharding across several free serverless vendors; (4) the status quo of R2 and Workers.
Do: 1. Prototype (1): a server publishing a signed, owner-encrypted record as a replaceable event to at least 3 public relays, a browser reading and subscribing, measuring reliability, event size limits, retention, rate limits and required proof-of-work over a week. 2. Check that records cannot be enumerated into a list of server IPs (encrypt the address fields to the owner). 3. Estimate the same fact-0022 table for each candidate. 4. Record the verdict, risks and a recommendation.
Done-when: fact 0025 compares the candidates with measurements and recommends one; fact 0022 and decision 0068 are updated to match.

---

### C.5 Request-budget alarm — [>] moved to docs/plans/termenbox-roadmap.md as R07
Class: implement · Needs: C.3, C.4 · Check: `grep -q directory-request-budget docs/guardrails/INDEX.md`
Do: a daily scheduled workflow reads Cloudflare analytics for Workers requests and opens an issue above 60%; update fact 0022 with measured numbers.
Done-when: the workflow runs green and the issue path is tested with a lowered threshold.
