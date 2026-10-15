---
id: 0012
title: Repository Structure
status: active
tags: [repo, monorepo, cargo, pnpm]
date: 2026-10-09
---

# Repository Structure

**Monorepo** with two workspace managers:

```
termenbox/
├── Cargo.toml              # Cargo workspace root
├── pnpm-workspace.yaml     # pnpm workspace root
├── packages/
│   ├── server/             # termenbox-server (Rust)
│   ├── agent/              # termenbox-agent (Rust)
│   ├── hook/               # termenbox-hook (Rust, CLI installer)
│   ├── core/               # termenbox-core (Rust → WASM)
│   └── client/             # termenbox-client (Svelte + TS)
├── docker/
│   └── Dockerfile          # Multi-stage build
├── docs/                   # Knowledge base (this directory)
└── .github/
    └── workflows/          # CI/CD
```

**Shared types**: `core/src/protocol.rs` defines wire protocol structs (serde + bincode). Client imports via `wasm-bindgen` generated TS types.

**Build**: `cargo build --workspace` + `pnpm -r build`. Docker builds server+agent+hook; client builds to static assets served by server.