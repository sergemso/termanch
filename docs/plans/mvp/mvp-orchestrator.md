# Termanch MVP — Orchestrator Plan

**Goal**: Deliver a minimal end-to-end working system in 2-3 weeks with 4 subagents working in parallel.

**Architecture**: Hybrid — Termanch-hosted client (Cloudflare Pages) + User-hosted server (VPS + Docker)

**MVP Scope** (only these features):
- User deploys server to their VPS via Docker (+ Cloudflare Tunnel for TLS)
- Hosted client at `https://app.termanch.dev` (Cloudflare Pages, our account)
- GitHub OAuth login (our OAuth app, free tier)
- Register server via QR code + HMAC token (no control plane)
- Connect via WebSocket (cross-origin, CORS allowed)
- List tmux sessions, attach to terminal
- Receive agent notifications (spawn/complete/error)
- Write prompts to agents via terminal

**Explicitly NOT in MVP**:
- WebTransport (WebSocket only)
- WASM terminal engine (xterm.js WebGL direct)
- SSH agent auth (GitHub OAuth only)
- SSP/CRDT sync (full frame deltas, base64)
- Herdr-specific protocol (generic tmux session list)
- Mobile PWA/offline/gestures/voice
- Diff viewer, preview, chat view polish
- Self-hosted client option

---

## Subagent Assignments

| Subagent | Plan File | Owner | Dependencies |
|----------|-----------|-------|--------------|
| repo-setup | mvp-01-repo-setup.md | Architect | None |
| shared-types | mvp-02-shared-types.md | Core Dev | repo-setup |
| server | mvp-03-server.md | Server Dev | shared-types |
| agent | mvp-04-agent.md | Agent Dev | server |
| client | mvp-05-client.md | Client Dev | shared-types |
| docker | mvp-06-docker-deploy.md | Architect | server, agent, client |
| integration | mvp-07-integration.md | Integration Dev | all above |

---

## Execution Order

```
Week 1 (Parallel):
  ├─ repo-setup (Day 1) + shared-types (Day 1-2)
  ├─ server (Day 2-5) ──────────┐
  ├─ client (Day 2-5) ──────────┤→ integration (Week 2)
  └─ agent (Day 3-5) ───────────┘

Week 2:
  ├─ docker (Day 1-2)
  └─ integration + e2e test (Day 2-5)

Week 3: Buffer / polish / deploy to test VPS
```

---

## Sync Points (Mandatory)

| Day | Sync | Participants | Artifact |
|-----|------|--------------|----------|
| 1 | Repo + types ready | All | `cargo check --workspace` passes |
| 3 | Server WS + auth + /register works | Server, Client | `curl` test script |
| 5 | Client OAuth + QR flow works | Client, Server | Playwright test |
| 7 | Docker + cloudflared runs | Architect, All | `docker compose up` test |
| 10 | Full e2e: OAuth → Register → Terminal | All | Video demo |

---

## Shared Contracts (Frozen for MVP)

### WebSocket Protocol (JSON)
```json
// Client → Server
{ "type": "auth", "token": "github_jwt", "server_token": "hmac_token" }
{ "type": "list_sessions" }
{ "type": "attach", "session_id": "tmux-123" }
{ "type": "input", "data": "bHMgCg==" }
{ "type": "resize", "cols": 80, "rows": 24 }

// Server → Client
{ "type": "auth_ok", "user": "github_user", "server_name": "my-vps" }
{ "type": "sessions", "sessions": [{ "id": "1", "name": "main", "agent": "tmux" }] }
{ "type": "session_attached", "session_id": "1" }
{ "type": "output", "data": "bHMgCg==" }
{ "type": "agent_event", "event": "spawned", "agent": "codex", "session_id": "1" }
{ "type": "error", "message": "..." }
```

### Registration (HTTP)
```
POST /register { "token": "hmac_token" }
→ 200 { "server_url": "wss://abc.trycloudflare.com/ws", "server_name": "my-vps" }
```

### GitHub OAuth Flow
1. Client: Redirect to `https://github.com/login/oauth/authorize?client_id=...&redirect_uri=https://app.termanch.dev/callback&scope=read:user user:email`
2. GitHub: User authorizes → redirects to `https://app.termanch.dev/callback?code=...`
3. Client: Exchange code for access token (via GitHub API proxy or direct)
4. Client: Store JWT in `localStorage`

### Server Registration Flow
1. User clicks "Add Server" in client → generates registration token (HMAC)
2. Shows QR code with token
3. User runs `docker compose exec termanch-server termanch-server --register` on VPS
4. Server prints same token + QR → user scans
5. Browser polls `/register?token=...` → gets `server_url`
6. Server added to user's server list

---

## Definition of Done (MVP)

1. `docker compose up -d` starts server + agent + cloudflared on user's VPS
2. Open `https://app.termanch.dev` → "Login with GitHub" → completes OAuth
3. Click "Add Server" → scan QR → server appears in list
4. Click server → terminal renders prompt, can type `ls`
5. Run `codex` in another tmux pane → notification appears in UI
6. Type prompt in UI → agent receives it in tmux

---

## Risk Mitigation (MVP-specific)

| Risk | Mitigation |
|------|------------|
| GitHub OAuth verification | Use Internal mode (100 users) for MVP; verify later |
| Cloudflare Tunnel reliability | Document trycloudflare (no account) + named tunnel options |
| Cross-origin WebSocket | CORS headers on server; test thoroughly |
| Registration token security | HMAC-SHA256, single-use, 10-min expiry |
| Docker image size | Multi-stage build, strip binaries, target < 150MB |
| Rate limiting | 10 req/min/IP on /register; 5 auth/min/IP on WS |