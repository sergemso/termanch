# Termanch Plan (re-baselined on the MVP)

**Goal**: A web terminal for managing remote AI coding agents from a phone browser; sessions survive disconnects. Self-hosted server, no subscriptions.
**Baseline**: the shipped hybrid MVP (DECISION-0013, 0051): GitHub OAuth, WebSocket, xterm.js WebGL, tmux-backed sessions, Cloudflare Tunnel, QR + HMAC registration.
**Modes**: hosted client (app.termanch.dev) and self-hosted client (DECISION-0052). Servers are single-owner (DECISION-0053).
**Near-term bar**: mobile-usable via tmux persistence + fast reconnect/replay. SSP/CRDT, WebTransport, WASM core, SSH auth and app-layer E2E are deferred (see Backlog).
**Constraints**: 512MB RAM / 1 vCPU, no paid services, internal sockets on 127.0.0.1, secrets never logged, builds run in CI.
**Replaces**: docs/plans/archive/termanch-v1-original.md (issues #1-#12, closed as not planned).

---

### 1.1 Verify browser-capability assumptions — [x]
Issue: #13
Class: explore · Needs: none · Check: `test -s docs/facts/0016-browser-capabilities.md`
Context: Deferred designs (0051) and the mobile bar rest on claims never verified. Record what is true today, with sources.
Do:
1. Check iOS Safari/Chrome Android support for: WebSocket background behaviour, installed-PWA Web Push (iOS 16.4+), Background Fetch, Badge API, WebTransport, Web Crypto ChaCha20, soft-keyboard viewport APIs (`visualViewport`, VirtualKeyboard).
2. Write `docs/facts/0016-browser-capabilities.md` and correct facts 0003/0007/0011 where they are wrong.
Done-when: each claim has a verdict and a source; the mobile steps below cite it.

---

### 1.2 Green baseline and doc reconciliation — [ ]
Issue: #14
Class: implement · Needs: none · Check: `cargo test --workspace && pnpm -r build`
Context: Plan v1 and the shipped code diverged; README/BOOTSTRAP/0013 disagree on who hosts the client.
Do:
1. Make `cargo check`, `cargo test --workspace`, `pnpm -r build` pass in CI (`.github/workflows/ci.yaml`).
2. Reconcile README, docs/BOOTSTRAP.md, facts 0001/0015 with DECISION-0051/0052: label hosted vs self-hosted paths; drop systemd/single-container/postgres wording.
3. Correct `AGENTS.md` architecture summary (it still lists WebTransport, SSP, SSH auth).
Done-when: CI is green on master; no doc describes deferred designs as current.

---

### 2.1 Single-owner server binding — [ ]
Issue: #15
Class: implement · Needs: 1.2 · Check: `cargo test -p termanch-server`
Context: DECISION-0053. Today any valid GitHub token passes auth (packages/server/src/auth.rs).
Do:
1. On `/register`, store the registering GitHub user id in `/config` (volume).
2. `auth` rejects other ids; audit-log accept/reject (timestamp, ip, github id; never tokens/HMAC).
3. Validate the GitHub token server-side per connection; define token lifetime and the OAuth code exchange location (client-only exchange needs the client secret: document how it is proxied without a Termanch backend in self-host mode).
4. Tests: owner accepted, other user rejected, expired registration token rejected, token single-use.
Done-when: a second GitHub account cannot attach; tests pass.

---

### 2.2 Reconnect and screen replay — [ ]
Issue: #16
Class: implement · Needs: 1.2 · Check: `cargo test -p termanch-server && pnpm --filter termanch-client test`
Context: The "Mosh-level" promise on top of a session backend (DECISION-0051, 0054). Resume = re-attach: tmux and similar multiplexers repaint the screen on attach, so the server keeps no replay buffer.
Do:
1. Server owns the terminal path: backend trait, PTY attach per connection, detach-only on drop, heartbeat ping (done, e2e-tested).
2. Client `Connection`: backoff (1s..30s + jitter), ping/pong half-open detection, immediate retry on foreground/online, re-auth, re-attach to the active session, terminal reset before repaint (done, unit-tested).
3. Measure on real devices: network toggle on iOS Safari and Chrome Android resumes within 2s of connectivity; record in docs/facts.
Done-when: device test passes; the e2e test (drop socket, reconnect, same screen) stays green in CI.

---

### 3.1 Mobile terminal UX — [ ]
Issue: #17
Class: implement · Needs: 1.1, 2.2 · Check: `pnpm --filter termanch-client build && pnpm --filter termanch-client test`
Context: Mobile is the target; the MVP is desktop Chrome only.
Do:
1. Key row (Esc, Tab, Ctrl, Alt, arrows) and soft-keyboard-aware layout.
2. Touch scroll, pinch font size, copy/paste.
3. Responsive session list and Add Server modal.
4. Test on iOS Safari 16+ and Chrome Android 100+ (BrowserStack-free: real device or CI emulation; record results).
Done-when: a user can run `ls`, `vim`-style Esc/Ctrl combos and scroll on a phone.

---

### 3.2 Installable PWA — [ ]
Issue: #18
Class: implement · Needs: 1.1, 3.1 · Check: `pnpm --filter termanch-client build && ls packages/client/dist/manifest.webmanifest`
Context: Installed PWA is required for iOS Web Push and gives a fast cold start.
Do:
1. Web manifest, icons, service worker caching static assets only (no session secrets in IndexedDB/Cache).
2. Foreground/visibility handling: on resume trigger 2.2 reconnect.
Done-when: installable on iOS and Android; cold start from cache works offline-shell.

---

### 4.1 Agent detection and notifications — [ ]
Issue: #19
Class: implement · Needs: 2.2 · Check: `cargo test -p termanch-server`
Context: Goal "manage AI coding agents". MVP has toasts for spawn/complete/error; detection method is only "manual codex in tmux".
Do:
1. Define the agent-event contract (spawned/needs-input/completed/error) and how each is detected in tmux (process scan of pane pid tree for codex/claude/herdr; prompt-wait heuristics only as a documented best effort).
2. Detection runs inside the server (DECISION-0054), per backend session; audit-log without agent output.
3. Client toasts, unread badge in session list.
4. If 1.1 confirms installed-PWA Web Push: optional push (VAPID, no paid service), payload carries no terminal content.
Done-when: running `claude` or `codex` in a tmux pane shows spawn and completion notifications within 5s.

---

### 5.1 Container and one-command deploy — [ ]
Issue: #20
Class: implement · Needs: 2.1, 4.1 · Check: `docker compose -f docker/docker-compose.yml config`
Context: Hosted-mode bar is ≤2 user actions after the VPS exists (bootstrap-simplicity, scoped by 0052).
Do:
1. Server image with tmux (target <150MB), cloudflared sidecar, trycloudflare default, named tunnel optional; no inline config edits.
2. `get` script / compose-URL flow that prints the QR/registration code in the logs.
3. CI builds and pushes the image (builds run in CI only).
4. Document the self-hosted client path (Terraform/Pages/OAuth app) separately.
Done-when: fresh 512MB VPS reaches a working terminal following the README only; image size and idle RSS are reported by CI.

---

### 6.1 End-to-end test and resource gates — [ ]
Issue: #21
Class: review · Needs: 5.1 · Check: `pnpm --filter termanch-client test:e2e`
Context: Nothing in the MVP proves the Definition of Done or the 512MB/1 vCPU limit.
Do:
1. Playwright e2e in CI: mocked OAuth → register → attach → type `ls` → reconnect → resumed.
2. CI gate: server idle+10-session RSS <300MB, client bundle <2MB gzipped (xterm.js only, so expected well under).
3. Throughput smoke: 10k lines/sec does not exceed 50% of one vCPU.
Done-when: gates enforced in CI.

---

### 7.1 Verify herdr and other backend CLIs — [ ]
Issue: #22
Class: explore · Needs: 2.2 · Check: `test -s docs/facts/0017-backend-clis.md`
Context: The user wants tmux, herdr or an own alternative (DECISION-0054). The `command` backend needs three CLI invocations per tool; herdr's are unverified (it advertises a CLI and local socket API; sources disagree on repo and license).
Do:
1. Install herdr and zellij; find list/create/attach commands; check that attach repaints on start and only detaches when killed, and that a PTY client works.
2. Record findings and working env snippets in `docs/facts/0017-backend-clis.md` and the README; add an integration test per verified tool, skipped when the binary is absent.
3. If herdr cannot fit the command shape, note what a dedicated adapter needs (its socket API).
Done-when: each tool has a verdict, a tested snippet or a written reason it does not fit.

---

### 7.2 Server-native backend — [ ]
Issue: #23
Class: plan · Needs: 2.2 · Check: `test -s docs/decisions/0055-native-backend.md`
Context: "Our own alternative": sessions the server holds itself, for hosts without a multiplexer. Needs a design before code: PTYs live in the server process (die on restart unless handed to a helper), and replay needs terminal state (a VT parser such as `vte`, or a bounded raw ring) since there is no multiplexer to repaint.
Do:
1. Write the decision: process model, persistence across server restarts, replay method, memory bound per session (512MB budget), multi-client attach.
2. Implement `NativeBackend` behind the `SessionBackend` trait with an e2e test equal to the tmux one.
Done-when: the decision is accepted and the backend passes the shared backend conformance tests.

---

## Dependency Graph
```
1.1 ─────────┬──────────────► 3.1 ► 3.2
1.2 ─┬► 2.1 ─┼────────────────────────────┐
     └► 2.2 ─┬► 3.1                        ├► 5.1 ► 6.1
             └► 4.1 ───────────────────────┘
```
Parallelizable after 1.2: 2.1 ‖ 2.2; after 2.2: 3.1 ‖ 4.1.

Parallel with 7.x: backends are independent of 3.x/4.x.

## Backlog (deferred; each needs a new decision to start)
WebTransport transport; WASM core + SSP/CRDT predictive echo; SSH-agent/WebAuthn auth; app-layer E2E encryption; diff viewer, preview, chat view; shell-hook installer; multi-user servers; Herdr-specific protocol; GitHub-Gist server-list sync.

## Open Risks
| Risk | Mitigation |
|---|---|
| Cloudflare sees terminal traffic (TLS terminates at the edge) | State it in docs; E2E is in the backlog |
| Hosted OAuth app needs GitHub verification beyond 100 users | Internal mode for now; self-host path |
| trycloudflare URL changes on restart | Re-register flow; named tunnel documented |
| iOS suspends sockets in background | 2.2 resume + 3.2 PWA; no silent-push reliance |
