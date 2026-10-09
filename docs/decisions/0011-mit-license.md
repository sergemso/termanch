---
id: 0011
title: MIT License for All Components
status: active
track: product
tags: [license, legal, mit]
date: 2026-10-09
accepted-by: architect
---

# Decision: MIT License for All Components

## Context
Termanch is open-source, self-hosted, no paid services. License must:
- Allow commercial use (companies self-hosting)
- Allow modification and redistribution
- Be compatible with all dependencies (Rust: mostly MIT/Apache-2.0; JS: MIT)
- Be simple and well-understood

## Decision
**MIT License** for all code, documentation, and assets.

## Rationale
- **Maximum adoption**: No copyleft barrier for commercial users
- **Simplicity**: 3 paragraphs, universally recognized
- **Dependency compatibility**: All Rust crates and npm packages used are MIT/Apache-2.0/BSD compatible
- **No patent concerns**: Apache-2.0 patent grant not needed (no patented algorithms)

## Consequences
- Every source file includes SPDX header:
  ```rust
  // SPDX-License-Identifier: MIT
  ```
  ```typescript
  // SPDX-License-Identifier: MIT
  ```
- `LICENSE` file at repo root
- `Cargo.toml` and `package.json` have `license = "MIT"`
- Contributors agree to DCO (Developer Certificate of Origin) via commit sign-off
- No CLA required (DCO sufficient for MIT)