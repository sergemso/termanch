# MVP-03: WebSocket Server

**Owner**: Server Dev | **Duration**: 3 days | **Depends on**: mvp-02

## Goal
WebSocket server on :443 with GitHub OAuth JWT validation, registration endpoint, PTY management, CORS for app.termanch.dev.

## Do
1. **`packages/server/Cargo.toml`**
   ```toml
   [dependencies]
   tokio = { version = "1", features = ["full"] }
   tokio-tungstenite = "0.21"
   rustls = "0.23"
   pem = "1.0"
   termanch-core = { path = "../core" }
   tracing = "0.1"
   tracing-subscriber = "0.3"
   clap = { version = "4", features = ["derive"] }
   jsonwebtoken = "9.0"
   reqwest = { version = "0.12", features = ["json"] }
   hmac = "0.12"
   sha2 = "0.10"
   hex = "0.4"
   axum = "0.7"  # for HTTP /register endpoint
   tower-http = { version = "0.5", features = ["cors"] }
   ```

2. **`packages/server/src/main.rs`** — CLI: config path, log level, `--register` flag

3. **`packages/server/src/config.rs`** — Config struct:
   ```rust
   pub struct Config {
       pub listen_addr: String,           // "0.0.0.0:443"
       pub tls_cert_path: String,
       pub tls_key_path: String,
       pub github_client_id: String,
       pub github_client_secret: String,
       pub registration_secret: String,   // 32-byte hex, generated on first run
       pub allowed_origin: String,        // "https://app.termanch.dev"
   }
   ```

4. **`packages/server/src/transport.rs`** — WebSocket server using `tokio-tungstenite` + `rustls` on :443

5. **`packages/server/src/github_auth.rs`** — GitHub OAuth JWT validation:
   - Fetch JWKS from `https://github.com/login/oauth/jwks` (cache with TTL)
   - Validate `jsonwebtoken::decode` with RS256
   - Extract `sub` (user ID) and `login` (username)
   - Verify `aud` matches `github_client_id`

6. **`packages/server/src/register.rs`** — Registration endpoint:
   - `POST /register` with `{ token }`
   - Validate HMAC-SHA256(token) == HMAC-SHA256(registration_secret, server_id)
   - Single-use tokens (store used tokens in memory with 10-min TTL)
   - Return `{ server_url, server_name }` where `server_url` = `wss://<tunnel-host>/ws`
   - Rate limit: 10 req/min/IP

7. **`packages/server/src/cors.rs`** — CORS middleware:
   - `Access-Control-Allow-Origin: https://app.termanch.dev`
   - `Access-Control-Allow-Credentials: true`
   - `Access-Control-Allow-Headers: Content-Type, Authorization`
   - `Access-Control-Allow-Methods: GET, POST, OPTIONS`
   - Handle preflight `OPTIONS` for `/register` and WebSocket upgrade

8. **`packages/server/src/session.rs`** — Session state machine:
   - `Unauthenticated` → `Authenticated` → `Attached`
   - Per-session: PTY handle, WebSocket sink
   - Auth requires both `token` (GitHub JWT) AND `server_token` (registration token)
   - Rate limiting: 5 auth/min/IP

9. **`packages/server/src/pty.rs`** — PTY management:
   - Spawn `bash` (or `$SHELL`) via `tokio::process::Command` with `pty`
   - Handle resize, read/write
   - Bridge PTY output → WebSocket `Output` messages (base64)

10. **`packages/server/src/agent_socket.rs`** — Unix socket client to agent:
    - Connect to `~/.termanch/agent.sock`
    - Receive `AgentEvent` → broadcast to relevant WebSocket clients

11. **`packages/server/src/metrics.rs`** — Prometheus on 127.0.0.1:9090

12. **`--register` CLI command**:
    - Generate `server_id` (16 random bytes)
    - Compute `token = HMAC_SHA256(registration_secret, server_id)`
    - Print token + QR code (using `qrencode` if available)

## Check
```bash
cargo build --release -p termanch-server
./target/release/termanch-server --help
./target/release/termanch-server --register  # prints token + QR
# Server starts, accepts WS, completes OAuth, handles /register, spawns PTY
```

## Integration Points
- Agent connects via Unix socket at `~/.termanch/agent.sock`
- Client connects via `wss://<tunnel-host>/ws` (cross-origin from app.termanch.dev)
- Registration via `POST https://<tunnel-host>/register`