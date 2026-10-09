---
id: 0001
title: Target Deployment Environment
status: active
tags: [deployment, infrastructure]
date: 2026-10-09
---

# Target Deployment Environment

The primary target deployment for `termanch-server` is a Linux VPS with:
- systemd for service management
- 512 MB RAM minimum
- 1 vCPU minimum
- No root privileges required (runs as user)
- Internal sockets bind to 127.0.0.1 only

This constraint drives:
- Memory-efficient Rust implementation (tokio + quinn)
- No heavy dependencies (no Kubernetes, no database)
- Single-binary deployment model