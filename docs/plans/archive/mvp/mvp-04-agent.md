# MVP-04: Agent Daemon (PTY Owner + Session Detection)

**Owner**: Agent Dev | **Duration**: 2 days | **Depends on**: mvp-03

## Goal
User-level daemon that detects tmux sessions, emits events via Unix socket to server.

## Do
1. **`packages/agent/Cargo.toml`**
   ```toml
   [dependencies]
   tokio = { version = "1", features = ["full"] }
   nix = "0.28"
   termenbox-core = { path = "../core" }
   tracing = "0.1"
   serde = { version = "1.0", features = ["derive"] }
   serde_json = "1.0"
   ```

2. **`packages/agent/src/main.rs`** — Daemon entry:
   - Single instance per user (lock file at `~/.termenbox/agent.lock`)
   - Create `~/.termenbox/` dir (chmod 700)
   - Bind Unix socket at `~/.termenbox/agent.sock` (chmod 600)
   - Spawn detection loop + socket listener

3. **`packages/agent/src/detection.rs`** — Session detection:
   ```rust
   pub async fn detect_sessions() -> Vec<SessionInfo> {
       // tmux list-sessions -F "#{session_id} #{session_name}"
       // For each: check if herdr process owns it (ps scan + env)
       // Return Vec<SessionInfo> { id, name, agent: Some("herdr") | None }
   }
   ```
   - Run every 5s, emit `SessionListChanged` if diff

4. **`packages/agent/src/event_socket.rs`** — Unix socket server:
   - Accept connections from server
   - Send `AgentEvent` frames (JSON, newline-delimited)
   - Events: `SessionSpawned`, `SessionTerminated`, `AgentSpawned { agent: "codex", session_id }`

5. **`packages/agent/src/agent_detection.rs`** — Agent process detection:
   - Scan `ps aux` for `codex`, `claude`, `herdr` processes
   - Match to tmux session via environment variables (`TMUX_PANE`, etc.)
   - Emit `AgentSpawned` event when detected

6. **systemd user unit**: `~/.config/systemd/user/termenbox-agent.service`
   ```ini
   [Unit]
   Description=Termenbox Agent
   [Service]
   Type=notify
   Restart=on-failure
   ExecStart=%h/.cargo/bin/termenbox-agent
   [Install]
   WantedBy=default.target
   ```

## Check
```bash
cargo build --release -p termenbox-agent
./target/release/termenbox-agent --help
# Daemon starts, socket accepts, emits tmux sessions + agent events
```

## MVP Simplification
- No PTY ownership (server owns PTY directly)
- No shell hooks (user manually runs `codex` in tmux)
- Detection: `tmux list-sessions` + `ps aux` scan only