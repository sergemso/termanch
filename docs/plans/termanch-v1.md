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
Class: implement · Needs: 2.1, 4.1, 8.5 · Check: `docker compose -f docker/docker-compose.yml config`
Context: Hosted-mode bar is ≤2 user actions after the VPS exists (bootstrap-simplicity, scoped by 0052).
Do:
1. Server image with tmux (target <150MB), cloudflared sidecar, trycloudflare default, named tunnel optional; no inline config edits.
2. Installer and compose come from step 8.5; nothing is printed for the user to copy.
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

### 8.1 Verify tunnel and directory assumptions — [x]
Issue: #24
Class: explore · Needs: none · Check: `test -s docs/facts/0018-connectivity-limits.md`
Context: DECISION-0056 rests on unverified limits. Also covers the optional "Connect Cloudflare" flow.
Do:
1. Quick tunnels: do WebSockets work and stay up for hours; request/connection limits; ToS for non-HTML traffic; how `cloudflared` exposes the URL (metrics endpoint or log) so the server can read it.
2. Free-tier budget for 10^5 users: D1 writes/reads, Pages Functions requests, announce frequency (one write per tunnel restart).
3. Cloudflare OAuth: can a self-managed client's scopes create tunnels and DNS records in the user's account; is a verified client domain needed.
4. Quick tunnel vs named tunnel behaviour on VPS reboot and cloudflared crash.
Done-when: each item has a verdict and source in the fact; unsupported assumptions are written back into DECISION-0056. (Done: FACT-0018.)

---

### 8.2 Signed directory service — [x]
Issue: #25
Class: implement · Needs: 8.1, 2.1 · Check: `cd packages/client && ./node_modules/.bin/vitest run`
Context: Pages Functions + D1 under `packages/client/functions/api/directory/`; deployable by self-hosters with their client. The signed record carries `ip`, `udp_port`, `dtls_fingerprint` and an optional `ws_url` (tunnel fallback), per DECISION-0057.
Do:
0. Server side: after startup and on every address change, sign and POST the record (`RtcInfo` plus `seq`) with the persisted server key.
1. `POST /api/directory/announce {server_id (ed25519 pubkey), ip, udp_port, dtls_fingerprint, ws_url?, seq, proof_hash, sig}`: verify signature, reject stale `seq`, rate-limit per id, store.
2. `GET /api/directory/lookup?id=` returns the signed record; `GET /api/directory/pending?h=<hash of claim secret>` returns a first announcement made with that secret.
3. Validate `ip` (public unicast only; reject private, loopback, link-local, multicast) and `udp_port`. Keep requests cheap: `pending` supports backoff (2s, 4s, 8s, then 10s) and a total timeout; steady state needs no polling (FACT-0018 budget). Records expire (e.g. 30 days idle); caps on URL length and format (https only, trycloudflare or allow-listed pattern).
4. Tests: bad signature, replayed seq, oversized input, expiry.
Done-when: a forged or replayed announcement is rejected; a valid one is served unchanged.

---

### 8.3 Server: managed quick tunnel (fallback transport, after 8.8) — [ ]
Issue: #26
Class: implement · Needs: 8.1, 8.2 · Check: `cargo test -p termanch-server`
Context: Fallback for networks or VPSes without a reachable UDP port (DECISION-0057). The server supervises `cloudflared`, learns the URL, and announces it as the record's `ws_url`; nobody prints or types URLs.
Do:
0. Start `cloudflared` with `--metrics 127.0.0.1:PORT` and read the URL from `GET /quicktunnel` (FACT-0018); health from `/ready`.
1. Persistent ed25519 identity in the config dir (0600).
2. Supervisor: start `cloudflared tunnel --url`, parse the URL, restart with backoff when it exits, re-announce on every URL change (signed, increasing `seq`).
3. First announce carries `HMAC(claim secret, url|seq)` and `hash(claim secret)`; the claim secret comes from the install command, not from stdout.
4. Remove `--register` printing; keep an explicit `TERMANCH_TUNNEL=off` for users with their own TLS endpoint.
5. Tests with a fake `cloudflared` script and a fake directory.
Done-when: killing the tunnel yields a new URL announced within 30s without human input.

---

### 8.4 Client: one-step Add Server and auto-reconnect via directory — [x]
Issue: #27
Class: implement · Needs: 8.2, 2.2 · Check: `cd packages/client && ./node_modules/.bin/vitest run`
Context: Replaces the manual URL/link modal.
Do:
1. Add Server, flow A: generate the claim secret (expires in 15 minutes, single use), show the single install command with a copy button, poll `pending` until the server announces; verify the HMAC; pin the server key; add the server.
1b. Flow B: a Scan button decodes the installer's QR from the live camera or from a picked screenshot (small JS decoder; try inverted images); same pending/verify/pin path. Tell the user to delete the screenshot.
2. On connect failure, look up the server by id, verify the signature against the pinned key, and reconnect to the new address or fingerprint (feeds the 2.2 backoff loop). Pluggable transport inside `Connection`: webrtc-direct first (8.9), WebSocket to `ws_url` as fallback.
3. The `#add=` link path is gone; a claim link is `<client>/#claim=<secret>` (QR or typed). The manual tunnel URL stays under "Advanced" for users who bring their own endpoint.
4. Known gap, for 8.5: re-adding a server that already has an owner (new phone, cleared storage) needs the installer to accept a fresh secret as proof of root on the VPS and re-bind the owner; today a claimed server ignores new secrets.
Done-when: restarting the server is invisible to a logged-in client apart from a short reconnect (measured: back in about 8 s; worst case = heartbeat 5 s + 3 s).

---

### 8.5 One-command installer — [x]
Issue: #28
Class: implement · Needs: 8.3 · Check: `sh -n packages/client/public/install.sh && dash -n packages/client/public/install.sh`
Context: Served from the client origin as `/install.sh` (hosted and self-hosted).
Do:
1. Non-interactive POSIX script taking the claim secret and the directory origin: installs Docker if missing, writes the compose file, starts the server (UDP port published; opens it in `ufw`/`firewalld` when present), restarts on reboot. `cloudflared` is added only when the fallback (8.3) exists.
2. Idempotent; refuses to run if a different owner is already bound; no prompts, no output the user must act on.
3. Fresh-VPS test in CI where feasible (container), manual on a real 512MB VPS.
3. When stdout is a terminal, also draw the claim QR (white quiet zone, large modules); never when piped or run from cloud-init.
Done-when: pasting the command on a fresh VPS results in a connected server in the client, with no further input; the QR scans from a phone screenshot of a dark terminal. (Verified with the published image on a real VPS: install, announce to the production directory, verify, connect over WebRTC; not yet from a phone.)

---

### 8.6 Optional: Connect Cloudflare for stable tunnels — [ ]
Issue: #29
Class: plan · Needs: 8.1 · Check: `test -s docs/decisions/0057-connect-cloudflare.md`
Context: For users who do have a domain on Cloudflare (a public tunnel hostname needs a zone they own, FACT-0018) or want a stable URL. Scopes exist (Tunnel Write, DNS Write); public clients need PKCE and a verified domain TXT record.
Do: decide go/no-go; if go, design OAuth consent, tunnel + DNS creation in the user's account, token handoff via the install command.
Done-when: decision recorded either way.

---

### 8.7 Prototype WebRTC direct — [x]
Issue: #30
Class: explore · Needs: 8.1 · Check: `test -s docs/facts/0021-webrtc-direct.md`
Context: DECISION-0057. No hole-punching, STUN, TURN or signaling: server public IP + one UDP port + fixed DTLS certificate; the client builds the remote description itself.
Do:
1. Pick the Rust stack (str0m, webrtc-rs or other): ICE-lite, one UDP port for all clients, persisted DTLS certificate, memory per connection on a 512MB VPS.
2. Browser side: build the remote SDP locally (server ufrag/pwd convention, candidate, fingerprint) and connect from Chrome, Firefox, Android Chrome and iOS Safari 16+; record which need SDP munging.
3. Public IP on NAT-mapped clouds (AWS, GCP, Oracle): discovery and the explicit candidate address.
4. Reachability: default UDP firewalls of Hetzner, DigitalOcean, AWS, GCP, Oracle; what the installer can open; behaviour on mobile and common Wi-Fi networks that block UDP; failure detection time in the client.
5. Data channel limits: max message size, ordering, throughput and latency against WebSocket.
6. Abuse: unauthenticated-peer limits (handshake rate, memory cap) since credentials are static.
Done-when: a phone on LTE types into a tmux session on a real VPS over the prototype; each item has a verdict in the fact.

---

### 8.8 Server: WebRTC-direct transport — [x]
Issue: #31
Class: implement · Needs: 8.7, 2.1 · Check: `cargo test -p termanch-server`
Context: Makes the session path transport-agnostic and adds the primary transport.
Do:
1. Extract a `Transport` seam under `sessions.rs` (messages in/out, close); WebSocket becomes one implementation.
2. Data-channel transport per 8.7; auth and owner binding in the first message; unauthenticated peers limited and timed out.
3. Announcing `ip`, `udp_port`, `dtls_fingerprint` to the directory is done in 8.2/8.3 (the server exposes them as `RtcInfo`; `/rtc-info` is a dev-only unsigned route).
4. e2e test: a Rust WebRTC client (or headless browser in CI) through the whole auth + tmux + reconnect path.
Done-when: the e2e suite passes over WebRTC and WebSocket from one set of tests. (Done on branch feat/webrtc-direct-server.)

---

### 8.9 Client: WebRTC-direct transport — [x]
Issue: #32
Class: implement · Needs: 8.7, 8.2, 2.2 · Check: `cd packages/client && ./node_modules/.bin/vitest run`
Context: `Connection` gains a transport interface; WebRTC first, WebSocket fallback.
Do:
1. `RTCPeerConnection` + data channel built from the directory record; fingerprint pinned from the signed record.
2. Failure detection within 5 s with a clear "server unreachable on UDP port N" state; fallback to `ws_url` when present.
3. Same heartbeat, backoff and re-attach behaviour as 2.2.
Done-when: unit tests for transport selection and fallback; works on iOS Safari and Android Chrome per the 8.7 matrix.

---

## Dependency Graph
```
1.1 ─────────┬──────────────► 3.1 ► 3.2
1.2 ─┬► 2.1 ─┼────────────────────────────┐
     └► 2.2 ─┬► 3.1                        ├► 5.1 ► 6.1
             └► 4.1 ───────────────────────┘
```
Parallelizable after 1.2: 2.1 ‖ 2.2; after 2.2: 3.1 ‖ 4.1.

Parallel with 7.x and 8.x: backends are independent of 3.x/4.x.

## Backlog (deferred; each needs a new decision to start)
WebTransport transport; WASM core + SSP/CRDT predictive echo; SSH-agent/WebAuthn auth; app-layer E2E encryption; diff viewer, preview, chat view; shell-hook installer; multi-user servers; Herdr-specific protocol; GitHub-Gist server-list sync.

## Open Risks
| Risk | Mitigation |
|---|---|
| Cloudflare sees terminal traffic (TLS terminates at the edge) | State it in docs; E2E is in the backlog |
| Hosted OAuth app needs GitHub verification beyond 100 users | Internal mode for now; self-host path |
| trycloudflare URL changes on restart | Re-register flow; named tunnel documented |
| iOS suspends sockets in background | 2.2 resume + 3.2 PWA; no silent-push reliance |
