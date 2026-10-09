---
id: 0010
title: Monorepo with Cargo Workspace and pnpm Workspace
status: active
track: process
tags: [repo, monorepo, cargo, pnpm, build]
date: 2026-10-09
accepted-by: architect
---

# Decision: Monorepo with Cargo Workspace and pnpm Workspace

## Context
Termanch has multiple components:
- Rust: server, agent, hook, core (WASM)
- TypeScript: client (Svelte)
- Shared: wire protocol types, constants

Build and release must be atomic for cross-cutting changes (protocol changes affect all components).

## Decision
**Single monorepo** with dual workspace managers:
- **Cargo workspace** for Rust packages (`Cargo.toml` at root)
- **pnpm workspace** for TypeScript packages (`pnpm-workspace.yaml` at root)

## Structure
```
termanch/
├── Cargo.toml                    # [workspace] members = ["packages/*"]
├── pnpm-workspace.yaml           # packages: ["packages/client"]
├── packages/
│   ├── server/                   # termanch-server (bin)
│   ├── agent/                    # termanch-agent (bin)
│   ├── hook/                     # termanch-hook (bin)
│   ├── core/                     # termanch-core (cdylib → WASM)
│   └── client/                   # termanch-client (Svelte + TS)
├── docker/Dockerfile             # Multi-stage: builds all Rust, copies client dist
└── .github/workflows/ci.yaml     # cargo test + pnpm test + wasm-pack test
```

## Shared Types
- `packages/core/src/protocol.rs` defines wire protocol structs
- Annotated with `#[derive(Serialize, Deserialize)]` + `bincode`/`postcard` encode
- `build.rs` in core generates TS types via `wasm-bindgen` + custom codegen
- Client imports: `import { HandshakeInit, DeltaFrame } from 'termanch-core'`

## Rationale
- **Atomic commits**: Protocol change = single PR updating core + server + client
- **Shared versioning**: Single version tag for all components
- **CI simplicity**: One pipeline, shared cache
- **Developer experience**: `cargo build --workspace` + `pnpm -r build` builds everything

## Tradeoffs
| Aspect | Monorepo (chosen) | Polyrepo |
|---|---|---|
| Cross-cutting changes | Single PR | Coordinated PRs |
| Versioning | Unified | Independent |
| CI | Single pipeline | Multiple pipelines |
| Clone size | Larger | Per-repo smaller |
| Access control | All or nothing | Per-repo |

## Consequences
- `Cargo.toml` defines `[workspace]` with `resolver = "2"`
- `pnpm-workspace.yaml` includes only `packages/client` (Rust not in pnpm)
- Docker multi-stage: builder stage compiles Rust; runner stage copies binaries + client `dist/`
- Release: `cargo release` + `pnpm publish` from same tag