---
id: 0114-server-builds-and-tests-run-in-a-pinned-container
title: The Rust server and the browser end-to-end tests are built and run in a pinned container, not from a host install
status: draft
date: 2026-10-17
track: process
tags: [build, repo]
---

## Decision

- `docker/Dockerfile.dev` pins the build toolchain in two targets: `rust` (compiler, C toolchain, cmake, OpenSSL headers, tmux, musl) and `full` (that plus Node, pnpm and Chromium). `scripts/dev.sh [--full] <command>` runs any command in it with the repository mounted.
- Cargo's registry and `target/`, and pnpm's store, live in one named volume, so a second build is incremental. CI builds with the same toolchain family and caches with `rust-cache`; the shipped image keeps its own cargo-chef build (`docker/Dockerfile`).
- Client-only work (unit tests, the dev server) may use a host Node and pnpm; nothing requires a compiler on the host.

## Why

A machine without a C compiler or root could not build or test the server at all, and the e2e scripts need tmux, a browser and a built server together. A pinned image makes a laptop, a bare VM and CI compile and test the same way; the volume keeps the cost of that to the first build (about 2 minutes cold, under a second warm). Status is `draft`: it records what was set up at the owner's request and awaits their acceptance.
