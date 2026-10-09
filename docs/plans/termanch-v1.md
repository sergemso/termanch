# Termanch v1 Implementation Plan

**Self-sufficient plan for a fresh session with zero prior context.**

## Overview
Build Termanch: a web-based terminal for managing remote AI coding agents (Codex, Claude Code, Herdr) from mobile browsers, with Mosh-level session persistence. Self-hosted, no native apps, MIT licensed.

**Target**: Linux VPS (512MB RAM, 1 vCPU), iOS Safari 16+, Chrome Android 100+
**Architecture**: Monorepo (Cargo workspace + pnpm workspace)
**Team**: 1 architect, 4 AI devs (core, server, client, integration), 1 optimization engineer

---

### 1.1 Repository Setup — [ ]
Class: setup · Needs: none · Check: `ls -la Cargo.toml pnpm-workspace.yaml packages/`
Context: Initialize monorepo structure per DECISION-0010.
Do:
1. Create root `Cargo.toml` with `[workspace]` members = `["packages/*"]`, `resolver = "2"`
2. Create root `pnpm-workspace.yaml` with `packages: ["packages/client"]`
3. Create `packages/{server,agent,hook,core,client}` directories
4. Create `docker/Dockerfile` multi-stage template
5. Create `.github/workflows/ci.yaml` with cargo + pnpm + wasm-pack test jobs
6. Add root `.gitignore`, `.editorconfig`, `LICENSE` (MIT), `README.md`
Done-when: `cargo check --workspace` and `pnpm install` succeed; CI passes on empty project.

---

### 1.2 Core Protocol Types (Shared) — [ ]
Class: implement · Needs: 1.1 · Check: `cargo check -p termanch-core && ls packages/core/src/protocol.rs`
Context: Define wire protocol types per DECISION-0004, FACT-0006. Single source of truth for Rust + TS.
Do:
1. `packages/core/Cargo.toml`: deps `serde`, `postcard`, `thiserror`, `bytes`
2. `packages/core/src/protocol.rs`: Define all message types (HandshakeInit, HandshakeResp, KeyExchange, EncryptedFrame, SyncRequest, SyncResponse, Intent, DeltaFrame, FullState, AgentEvent, Notification, Error)
3. Implement `Encode`/`Decode` using `postcard` (varint + length-prefixed)
4. `build.rs`: Generate TS types via `wasm-bindgen` + custom codegen to `packages/client/src/protocol/`
5. Unit tests: round-trip encode/decode for each message type
Done-when: `cargo test -p termanch-core` passes; TS types importable in client.

---

### 2.1 termanch-core: WASM Terminal Engine — [ ]
Class: implement · Needs: 1.2 · Check: `wasm-pack build --target web --out-dir pkg && ls pkg/termanch_core_bg.wasm`
Context: WASM core per FACT-0014 (vte), FACT-0005 (Rope/CRDT), DECISION-0003, DECISION-0009 (ChaCha20).
Do:
1. `packages/core/Cargo.toml`: add `vte`, `ropey`, `chacha20poly1305`, `x25519-dalek`, `hkdf`, `rand`, `wasm-bindgen`, `web-sys`, `js-sys`, `console_error_panic_hook`
2. `packages/core/src/terminal.rs`: Implement `TerminalCore` with:
   - `vte::Parser` + `Perform` impl feeding `ropey::Rope` buffer
   - Cursor, scrollback, SGR state, DEC modes tracking
   - `process_output(bytes: &[u8]) -> Vec<Op>` (Ops: Retain/Delete/Insert)
   - `get_viewport(top: usize, height: usize) -> ViewportData`
3. `packages/core/src/ssp.rs`: Sequence CRDT logic:
   - `apply_ops(ops: &[Op], version: u64) -> Result<(), Error>`
   - `compute_diff(from_version: u64, to_version: u64) -> Vec<Op>`
   - Version history ring buffer (last 1000 ops)
4. `packages/core/src/crypto.rs`: ChaCha20-Poly1305 + X25519 + HKDF per DECISION-0009
   - `encrypt_frame(key: &[u8;32], nonce: &[u8;12], plaintext: &[u8]) -> Vec<u8>`
   - `decrypt_frame(key: &[u8;32], nonce: &[u8;12], ciphertext: &[u8]) -> Result<Vec<u8>, Error>`
   - `derive_session_key(shared_secret: &[u8;32], session_id: &[u8]) -> [u8;32]`
5. `packages/core/src/lib.rs`: `wasm-bindgen` exports for `TerminalCore`, `SspEngine`, `CryptoEngine`
6. `wasm-pack build --target web --release --out-dir pkg` — verify < 2MB gzipped
Done-when: WASM builds; `wasm-pack test --headless --firefox` passes; bundle size < 2MB gzipped.

---

### 2.2 termanch-server: WebTransport/WebSocket Server — [ ]
Class: implement · Needs: 1.1, 1.2 · Check: `cargo build --release -p termanch-server && ./target/release/termanch-server --help`
Context: Server per FACT-0001, DECISION-0001, DECISION-0004, DECISION-0008, GUARDRAIL-resource-constraints.
Do:
1. `packages/server/Cargo.toml`: deps `tokio`, `quinn`, `tokio-tungstenite`, `http`, `h3`, `rustls`, `pem`, `termanch-core` (protocol types only), `tracing`, `clap`
2. `packages/server/src/main.rs`: CLI args (config path, log level, paranoid mode)
3. `packages/server/src/config.rs`: Config struct (listen addr, TLS cert/key, session limits, rate limits)
4. `packages/server/src/transport.rs`: Transport abstraction:
   - `WebTransportServer` (quinn + h3) on `:443`
   - `WebSocketServer` (tokio-tungstenite) on `:443` (ALPN fallback)
   - Unified `Connection` trait with `send_frame`, `recv_frame`, `close`
5. `packages/server/src/session.rs`: Session state machine:
   - Handshake → KeyExchange → Authenticated → Sync → Active
   - Per-session: `SspEngine`, `CryptoEngine`, PTY handle (via `tokio::process::Command`)
   - Rate limiting: token bucket per IP (10 conn, 5 handshake/min)
6. `packages/server/src/auth.rs`: SSH agent challenge-response per DECISION-0006
   - `verify_ssh_signature(challenge, signature, fingerprint) -> bool`
7. `packages/server/src/pty.rs`: PTY management (spawn shell, resize, read/write)
8. `packages/server/src/metrics.rs`: Prometheus exporter on `127.0.0.1:9090` (GUARDRAIL-internal-network-binding)
7. systemd unit: `termanch-server.service` with `CAP_NET_BIND_SERVICE`, `AmbientCapabilities`, `MemoryLimit=300M`
Done-when: Server starts, accepts WebTransport + WebSocket, completes handshake, spawns PTY, serves metrics on 127.0.0.1:9090.

---

### 2.3 termanch-agent: PTY Owner + Event Bus — [ ]
Class: implement · Needs: 2.2 · Check: `cargo build --release -p termanch-agent && ./target/release/termanch-agent --help`
Context: Agent per FACT-0009, DECISION-0007. Owns PTY, emits events to Unix socket.
Do:
1. `packages/agent/Cargo.toml`: deps `tokio`, `nix`, `termanch-core` (protocol), `tracing`
2. `packages/agent/src/main.rs`: Daemon entry; single instance per user (lock file)
3. `packages/agent/src/pty_owner.rs`: Spawns user's `$SHELL` as PTY leader; bridges PTY ↔ server via stdin/stdout
4. `packages/agent/src/event_socket.rs`: Unix socket listener at `~/.termanch/agent.sock` (chmod 600)
   - Accepts connections from hook/client; sends `AgentEvent` frames (postcard)
5. `packages/agent/src/hooks.rs`: Shell hook installer (generates bash/zsh/fish snippets)
6. `packages/agent/src/detection.rs`: Agent detection via `ps` scan + env var parsing
7. systemd user unit: `termanch-agent.service` (Type=notify, Restart=on-failure)
Done-when: Agent starts, owns PTY, Unix socket accepts connections, emits `AgentSpawned` on `codex` launch.

---

### 2.4 termanch-hook: Shell Hook Installer — [ ]
Class: implement · Needs: 2.3 · Check: `cargo build --release -p termanch-hook && ./target/release/termanch-hook install --dry-run`
Context: Hook per DECISION-0007. Installs shell config for prompt markers + agent wrappers.
Do:
1. `packages/hook/Cargo.toml`: deps `clap`, `dirs`, `shell-words`, `termanch-agent` (hook snippets)
2. `packages/hook/src/main.rs`: CLI: `install [--shell bash|zsh|fish]`, `uninstall`, `status`
3. `packages/hook/src/snippets.rs`: Embedded shell snippets for:
   - Bash: `PROMPT_COMMAND` + `preexec` (source `bash-preexec.sh`)
   - Zsh: `precmd` + `preexec`
   - Fish: `fish_prompt` + `fish_preexec`
   - OSC 1337 sequences: `OSC 1337 ; CurrentDir=... ST`, `OSC 133 ; C ; cmd ST`, `OSC 133 ; D ; exit_code ST`
   - Wrapper functions: `codex() { notify_agent_spawn "codex" $$; command codex "$@"; }`
4. `packages/hook/src/installer.rs`: Detects shell, backs up rc file, appends snippet, sources
5. Tests: Dry-run install/uninstall for each shell; verify snippets syntactically correct
Done-when: `termanch-hook install` modifies `~/.bashrc`/`.zshrc`/`.config/fish/config.fish` correctly; `uninstall` restores backup.

---

### 3.1 termanch-client: Svelte 5 PWA Shell — [ ]
Class: implement · Needs: 1.1, 2.1 · Check: `pnpm --filter termanch-client build && ls packages/client/dist/`
Context: Client per DECISION-0002, FACT-0002, FACT-0010, DECISION-0005 (PWA).
Do:
1. `packages/client/package.json`: Svelte 5, Vite, TypeScript, `xterm@5`, `@xterm/addon-webgl@5`, `@xterm/addon-fit@5`, `workbox`, `idb`
2. `packages/client/vite.config.ts`: WASM import via `vite-plugin-wasm`, `worker` plugin for core, PWA manifest
3. `packages/client/src/app.html`: PWA meta (theme-color, apple-touch-icon, manifest)
4. `packages/client/src/main.ts`: Bootstrap; register service worker; init IndexedDB (idb)
5. `packages/client/src/stores/session.ts`: Svelte 5 runes store for session state (connection, buffer, viewport)
6. `packages/client/src/components/Terminal.svelte`: xterm.js WebGL integration
   - `onMount`: create `Terminal`, `WebglAddon`, `FitAddon`
   - WASM worker: `new Worker(new URL('./core.worker.ts', import.meta.url))`
   - `postMessage` with `Transferable` for delta frames
7. `packages/client/src/workers/core.worker.ts`: WASM core bridge
   - `import init, { TerminalCore, SspEngine, CryptoEngine } from 'termanch-core'`
   - Handles `Intent` → WASM → `DeltaFrame` → main thread
8. `packages/client/src/lib/transport.ts`: Transport abstraction (WebTransport + WebSocket fallback)
   - `WebTransportClient` + `WebSocketClient` implementing common interface
   - Auto-fallback logic per DECISION-0001
9. PWA: `vite-plugin-pwa` config (manifest, service worker, offline cache)
Done-when: `pnpm build` produces `dist/`; `pnpm preview` loads terminal; WebGL renderer works; service worker caches assets; installable on mobile.

---

### 3.2 Client: Transport + Crypto Integration — [ ]
Class: implement · Needs: 3.1, 2.1 · Check: `pnpm --filter termanch-client test:integration`
Context: Wire up transport, handshake, encryption per DECISION-0001, DECISION-0004, DECISION-0009.
Do:
1. `packages/client/src/lib/crypto.ts`: Web Crypto API wrappers for X25519 + HKDF + ChaCha20-Poly1305
   - `generateKeyPair()`, `deriveKey()`, `encrypt()`, `decrypt()` — matching WASM crypto
2. `packages/client/src/lib/handshake.ts`: Handshake state machine
   - `HandshakeInit` → `HandshakeResp` → `KeyExchange` → verified → session keys
   - SSH agent challenge: WebExtension native messaging (desktop) or prompt for mobile
3. `packages/client/src/lib/sync.ts`: SSP client logic
   - `requestSync(lastVersion)` → apply `SyncResponse` ops → render viewport
   - Reconnect: exponential backoff (1s, 2s, 4s, 8s, max 30s)
4. `packages/client/src/lib/agent.ts`: Agent event subscription (Chat View, Diff Viewer)
5. Integration test: Full handshake → keystroke → delta frame → render (Playwright)
Done-when: Client connects to local server, authenticates, renders shell prompt, types `ls` → output appears.

---

### 3.3 Client: Mobile UX + iOS Mitigations — [ ]
Class: implement · Needs: 3.2 · Check: `pnpm --filter termanch-client test:e2e -- --grep mobile`
Context: Mobile UX per FACT-0002, FACT-0010, DECISION-0005, GUARDRAIL-minimum-browser-support.
Do:
1. `packages/client/src/components/KeyboardRow.svelte`: Ctrl/Esc/Tab/Alt, arrows, history up/down
2. `packages/client/src/lib/gestures.ts`: Touch handlers (swipe scroll, pinch zoom → font size, long-press select)
3. `packages/client/src/lib/voice.ts`: Web Speech API (on-device) → sends text as keystrokes
4. `packages/client/src/lib/image.ts`: File API (camera/gallery) → base64 → OSC 1337 image paste
5. `packages/client/src/lib/persistence.ts`: IndexedDB checkpoint every 500ms (buffer, cursor, keys, version)
6. `packages/client/src/sw.ts`: Service worker with Background Fetch (15min) + Push event handler
7. `packages/client/src/components/ChatView.svelte`: Agent events as cards (confirmation, completion, error)
8. `packages/client/src/components/DiffViewer.svelte`: Git diff rendering (side-by-side, inline)
9. `packages/client/src/components/Preview.svelte`: Iframe for localhost ports (tunneled via server)
10. iOS testing: Safari 16+ (WebSocket path), Safari 17+ (WebTransport path); verify background restore < 200ms
Done-when: Mobile Lighthouse PWA score > 90; background/foreground cycle restores session; gestures work; voice input works; image paste works; Chat View renders agent events.

---

### 4.1 Docker + Deployment — [ ]
Class: implement · Needs: 2.2, 2.3, 2.4, 3.3 · Check: `docker build -t termanch . && docker run --rm -p 443:443 termanch`
Context: Single-container deployment per FACT-0001, GUARDRAIL-resource-constraints.
Do:
1. `docker/Dockerfile`: Multi-stage
   - Stage 1 (builder): `rust:1.80` + `node:20` → `cargo build --release --workspace` + `pnpm build`
   - Stage 2 (runner): `debian:bookworm-slim` → copy binaries + client `dist/` + TLS certs
   - Entry: `termanch-server` (runs agent + hook install on first start via init script)
2. `docker/compose.yaml`: Optional compose for local dev (server + postgres if needed)
3. `docs/deploy.md`: VPS setup (user, SSH keys, firewall, systemd, TLS via Let's Encrypt)
4. `docs/paranoid-mode.md`: nftables rules for GUARDRAIL-paranoid-mode
Done-when: Docker image < 200MB; runs on 512MB VM; `systemctl status termanch-server` shows active; mobile client connects.

---

### 4.2 Documentation + Polish — [ ]
Class: review · Needs: 4.1 · Check: `ls docs/*.md && cargo doc --workspace`
Context: Complete user-facing docs.
Do:
1. `docs/architecture.md`: ASCII diagram of components + data flows
2. `docs/protocol.md`: Wire protocol spec (from FACT-0006 + DECISION-0004)
3. `docs/deploy.md`: Step-by-step VPS deployment
4. `docs/paranoid-mode.md`: Hardened deployment guide
5. `docs/mobile.md`: iOS/Android specific instructions
6. `docs/development.md`: Contributing, building, testing
7. API docs: `cargo doc --workspace --no-deps` → `target/doc/`
8. CHANGELOG.md: Generated from git log (conventional commits)
Done-when: All docs render; `cargo doc` passes; deployment guide tested on fresh VPS.

---

### 5.1 Load Testing + Optimization — [ ]
Class: debug · Needs: 4.1 · Check: `cargo bench -p termanch-server && pnpm --filter termanch-client run benchmark`
Context: Optimize for GUARDRAIL-resource-constraints, mobile battery.
Do:
1. Server: `cargo bench` for SSP diff, crypto, PTY throughput; target: 10k lines/sec < 50% CPU
2. Client: Lighthouse CI (performance, PWA); WASM bundle size check
3. Memory: `valgrind --tool=massif` on server; `wasm-objdump` for WASM size analysis
4. Network: Simulate 3G/4G (Chrome DevTools); measure reconnect latency
5. Profile: `perf record` on server; `console.profile()` in client
Done-when: All benchmarks pass thresholds; Lighthouse > 90; memory < 300MB RSS.

---

## Dependency Graph
```
1.1 → 1.2 → 2.1 → 2.2 → 2.3 → 2.4
                    ↓
                    3.1 → 3.2 → 3.3
                                    ↓
                          4.1 ← 4.2 ← 5.1
```

## Parallelizable Groups (‖)
- 2.1 ‖ 2.2 (core types ready)
- 2.3 ‖ 2.4 (after 2.2)
- 3.1 ‖ 3.2 (after 2.1)
- 4.1 ‖ 4.2 (after 2.4, 3.3)

## Risk List & Mitigations
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| WebTransport not in Safari 16 | High | Medium | WebSocket fallback (DECISION-0001); test both paths |
| WASM bundle > 2MB | Medium | High | `wasm-opt -Oz`; strip debug; optional `vte` features |
| iOS tab kill loses state | High | High | IndexedDB checkpoint + Background Fetch + Push (DECISION-0005) |
| SSH agent access on mobile | Medium | High | Document Prompt/Blink/Termius agent setup; fallback to WebAuthn later |
| PTY output flood OOM | Medium | High | Ring buffer cap (FACT-0005); backpressure to PTY |
| Crypto timing attacks | Low | Critical | ChaCha20-Poly1305 constant-time (DECISION-0009); `cargo audit` |
| Dependency supply chain | Low | High | `cargo deny` + `pnpm audit` in CI; pin versions |

---

## Next Steps (go-getter plan next)
Run `go-getter plan next docs/plans/termanch-v1.md` to see ready steps.