---
id: internal-network-binding
title: Internal Network Binding (127.0.0.1 Only)
status: active
governed-by: 0001
grounded-in: 0001
derivation-note: Deployment fact requires no root, user-only; internal services must not expose to network
tags: [security, network, deployment]
---

# Guardrail: Internal Network Binding (127.0.0.1 Only)

## Rule
**MUST** bind all internal services (agent socket, hook socket, metrics, health) to `127.0.0.1` only. **MUST NOT** bind to `0.0.0.0`, `::`, or any external interface.

## Binding Matrix
| Service | Port/Socket | Bind Address | Exposure |
|---|---|---|---|
| `termanch-server` (WebTransport/WSS) | 443 (configurable) | `0.0.0.0:443` | **Public** (user's VPS firewall controls access) |
| `termanch-agent` (PTY proxy) | N/A (stdio) | N/A | Internal only |
| `termanch-agent` (event socket) | `~/.termanch/agent.sock` | Unix socket | `127.0.0.1` equivalent |
| `termanch-hook` (installer) | N/A | N/A | CLI only |
| Metrics (Prometheus) | 9090 | `127.0.0.1:9090` | **Internal** (scraped by local Prometheus or SSH tunnel) |
| Health check | 8080 | `127.0.0.1:8080` | **Internal** (systemd watchdog) |

## Rationale
- **Defense in depth**: Even if VPS firewall misconfigured, internal services not exposed
- **No root**: Binding to `< 1024` requires root or capabilities; 443 via `setcap` or reverse proxy
- **SSH tunnel pattern**: User accesses metrics/health via `ssh -L 9090:127.0.0.1:9090`

## Implementation
- Server: `SocketAddr::from(([127,0,0,1], 9090))` for metrics
- systemd: `BindToDevice=` not needed; `ListenStream=` for 443 with `AmbientCapabilities=CAP_NET_BIND_SERVICE`
- Docker: `-p 127.0.0.1:9090:9090` for internal ports

## Enforcement
- CI: `grep -r "0.0.0.0\|\[::\]" --include="*.rs" packages/server/ packages/agent/ | grep -v test → fail`
- systemd unit review: `systemd-analyze verify termanch-server.service`
- Runtime: `ss -ltnp | grep -E ":9090|:8080" | grep -v "127.0.0.1" → alert`