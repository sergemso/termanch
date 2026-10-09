# Termanch MVP Plans

Minimal end-to-end implementation plans for subagents (Hybrid Architecture).

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  TERMANCH CLOUDFLARE PAGES (our account, free)                 │
│  https://app.termanch.dev                                       │
│  ├── GitHub OAuth "Login" button                                │
│  ├── Session list / Terminal UI (xterm.js WebGL)               │
│  └── "Add Server" → QR code with registration token            │
└─────────────────────────────────────────────────────────────────┘
                              │
                    GitHub OAuth + Registration token
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  USER'S VPS (Docker, ~$5/mo)                                    │
│  ├── cloudflared (sidecar, free tunnel, auto TLS)              │
│  │    └── https://<random>.trycloudflare.com → localhost:443   │
│  ├── termanch-server:443                                        │
│  │    ├── Validates GitHub JWT (our OAuth app)                │
│  │    ├── Verifies registration token (HMAC)                  │
│  │    ├── Spawns PTY, bridges WebSocket ↔ tmux                │
│  │    └── CORS: allow https://app.termanch.dev                │
│  └── termanch-agent (Unix socket → server)                     │
└─────────────────────────────────────────────────────────────────┘
```

## Plan Files

| # | Plan | Owner | Days | Depends On |
|---|------|-------|------|------------|
| 0 | [mvp-orchestrator.md](mvp-orchestrator.md) | Architect | - | - |
| 1 | [mvp-01-repo-setup.md](mvp-01-repo-setup.md) | Architect | 0.5 | - |
| 2 | [mvp-02-shared-types.md](mvp-02-shared-types.md) | Core Dev | 1 | 1 |
| 3 | [mvp-03-server.md](mvp-03-server.md) | Server Dev | 3 | 2 |
| 4 | [mvp-04-agent.md](mvp-04-agent.md) | Agent Dev | 2 | 3 |
| 5 | [mvp-05-client.md](mvp-05-client.md) | Client Dev | 3 | 2 |
| 6 | [mvp-06-docker-deploy.md](mvp-06-docker-deploy.md) | Architect | 1 | 3,4,5 |
| 7 | [mvp-07-integration.md](mvp-07-integration.md) | Integration Dev | 2 | 3,4,5,6 |

## Parallelization

```
Week 1:
  Day 1:  mvp-01, mvp-02 (parallel)
  Day 2-5: mvp-03, mvp-05 (parallel)
  Day 3-5: mvp-04 (starts after server basics ready)

Week 2:
  Day 1-2: mvp-06
  Day 2-5: mvp-07

Week 3: Buffer
```

## Key MVP Decisions (vs v1)

| v1 Feature | MVP Decision |
|------------|--------------|
| WebTransport + WebSocket | WebSocket only (cross-origin) |
| WASM terminal engine (vte + Rope + CRDT) | xterm.js WebGL direct |
| SSH agent challenge-response | GitHub OAuth (our app) |
| SSP/CRDT sync | Full frame deltas (base64) |
| Herdr-specific protocol | Generic tmux session list |
| Mobile PWA/offline/gestures | Desktop Chrome only |
| Shell hooks + agent wrappers | Manual `codex` in tmux |
| Diff viewer, preview, chat view | Agent notification toasts only |
| Self-hosted everything | Hybrid: Client on CF Pages, Server on user VPS |
| Multi-stage Docker (client+server) | Server-only Docker + cloudflared sidecar |

## Shared Contracts (Frozen)

See [mvp-orchestrator.md#shared-contracts-frozen-for-mvp](mvp-orchestrator.md#shared-contracts-frozen-for-mvp)

## Definition of Done

See [mvp-orchestrator.md#definition-of-done-mvp](mvp-orchestrator.md#definition-of-done-mvp)

## Open Decisions (Resolved)

| Decision | Choice |
|----------|--------|
| Registration secret storage | Generated on first run, stored in `/config/registration_secret` (volume) |
| Server naming | User enters name in app after scanning QR |
| Multiple servers per user | Stored in `localStorage` (MVP), sync via GitHub Gist later |
| GitHub OAuth scopes | `read:user user:email` |
| Rate limiting `/register` | 10/min/IP, single-use per token |
| TLS for user | Cloudflare Tunnel (trycloudflare for zero-setup, or named tunnel) |
| OAuth provider | GitHub (simpler verification for dev audience) |