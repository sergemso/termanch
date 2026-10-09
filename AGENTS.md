# Termanch — AGENTS.md

<!-- knowledge-base:start -->
## Knowledge Base

This project uses a fact/decision/guardrail/skill knowledge system.
See `docs/{facts,decisions,guardrails,skills}/` — facts (what's true),
decisions (what's committed to and why), guardrails (what must/must not
happen), procedures (how to act). Maintained via `capture`
after work sessions; validated via `lint` on demand; queried via
`query`.
<!-- knowledge-base:end -->

## Project Overview

**Termanch** — a web-based terminal for managing remote AI coding agents
(Codex, Claude Code, Herdr) from any mobile browser, with Mosh-level
session persistence. No native apps. No subscriptions. Self-hosted.

## Key Directories

```
docs/
  facts/           # Descriptive truths (14 facts)
  decisions/       # Axiomatic commitments (12 decisions)
  guardrails/      # Normative rules (8 guardrails)
  skills/          # Procedural knowledge (tags, roles)
  plans/           # Implementation plans
packages/
  server/          # termanch-server (Rust, WebTransport/WSS)
  agent/           # termanch-agent (Rust, PTY owner)
  hook/            # termanch-hook (Rust, shell installer)
  core/            # termanch-core (Rust→WASM, SSP, crypto)
  client/          # termanch-client (Svelte 5, xterm.js WebGL)
```

## Quick Commands

```bash
# Build everything
cargo build --workspace --release
pnpm -r build

# Test
cargo test --workspace
pnpm -r test

# WASM
cd packages/core && wasm-pack build --target web --release

# Docker
docker build -t termanch -f docker/Dockerfile .

# Lint knowledge base
# (requires go-getter plugin)
lint
```

## Architecture Summary

- **Transport**: WebTransport (QUIC) primary, WebSocket fallback (DECISION-0001)
- **SSP**: Rope + sequence CRDT, full frame deltas (DECISION-0003)
- **Crypto**: X25519 + HKDF + ChaCha20-Poly1305 (DECISION-0009)
- **Auth**: SSH agent challenge-response (DECISION-0006)
- **Client**: Svelte 5 + xterm.js WebGL + PWA (DECISION-0002, FACT-0010)
- **Agents**: PTY wrapper + shell hooks + Unix socket (DECISION-0007)
- **Deployment**: Single Docker container, 512MB RAM, 1 vCPU (FACT-0001)

## Guardrail Highlights

- No native apps (GUARDRAIL-no-native-apps)
- No paid services (GUARDRAIL-no-paid-services)
- 512MB RAM / 1 vCPU limit (GUARDRAIL-resource-constraints)
- Secrets in memory only, never logged (GUARDRAIL-security-secrets-handling)
- Internal services on 127.0.0.1 only (GUARDRAIL-internal-network-binding)
- Audit logging without secrets (GUARDRAIL-audit-logging-no-secrets)

## Minimum Browser Support

- iOS Safari 16+ (WebTransport flag, WebSocket fallback)
- Chrome Android 100+
- Desktop: Chrome/Firefox/Edge current-2, Safari 16+

## License

MIT (DECISION-0011)