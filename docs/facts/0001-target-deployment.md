---
id: 0001
title: Target Deployment Environment
status: active
tags: [deployment, infrastructure]
date: 2026-10-09
---

# Target Deployment Environment

The primary target deployment for `termenbox-server` is a Linux VPS with:
- Docker (Compose) for the server and agent, with a cloudflared sidecar
- 512 MB RAM minimum
- 1 vCPU minimum
- No root privileges required (runs as user)
- Internal sockets bind to 127.0.0.1 only

This constraint drives:
- Memory-efficient Rust implementation (tokio + axum)
- No heavy dependencies (no Kubernetes, no database)
- Single-image deployment model