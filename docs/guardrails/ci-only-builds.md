---
id: ci-only-builds
title: All Builds Run in CI Only
status: active
governed-by: 0010,0011
grounded-in: 0010,0011
tags: [process, ci, build, release]
---

# Guardrail: All Builds Run in CI Only

## Rule
**ALL** compilation, testing, Docker image builds, and client builds **MUST** run exclusively in GitHub Actions CI pipelines. No local build harness, Makefiles, or custom build scripts.

## Prohibited
- `Makefile`, `build.sh`, `justfile`, `Taskfile.yml`, `build.rs` (except for codegen in CI)
- Custom scripts in `scripts/` that compile/test/package
- Local `cargo build --release` for production artifacts
- Local `pnpm build` for production client assets
- Local `docker build` for release images

## Allowed (Local Development Only)
- `cargo check` / `cargo test` — fast feedback loop
- `pnpm dev` / `pnpm build` — local preview
- `docker compose up` — local integration testing

## Required CI Pipelines
| Pipeline | Trigger | Produces |
|----------|---------|----------|
| `ci.yaml` | PR, push to main | Test results, typecheck |
| `docker-build.yaml` | push to main, tags | Multi-arch Docker images to GHCR |
| `deploy-pages.yaml` | push to main | Client to Cloudflare Pages |
| `bootstrap-publish.yaml` | tag `bootstrap-v*` | Bootstrap script to get.termanch.dev |

## Enforcement
```bash
# CI check: fail if build scripts exist outside .github/workflows/
find . -name "Makefile" -o -name "build.sh" -o -name "justfile" -o -name "Taskfile*" | grep -v ".github/workflows" | grep -v "node_modules" && exit 1

# CI check: no cargo build --release in scripts/
grep -r "cargo build --release" scripts/ && exit 1

# CI check: no pnpm build in scripts/ (except CI)
grep -r "pnpm.*build" scripts/ && exit 1
```

## Rationale
- **Reproducibility**: CI provides consistent environment (OS, toolchain, cache)
- **Security**: Release artifacts built in audited, signed CI logs (SLSA)
- **Cost**: GitHub Actions free tier sufficient; no paid CI/CD (GUARDRAIL-no-paid-services)
- **Bootstrap simplicity**: Users never build — they `docker compose up` pre-built images (GUARDRAIL-bootstrap-simplicity)
- **Resource constraints**: CI runners sized appropriately; no local resource variance

## Fitness Function (Debt)
- Automate enforcement check in `ci.yaml` (not yet implemented)
- Add `cargo deny` + `pnpm audit` to supply chain check