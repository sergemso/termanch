---
id: 0063-signed-releases-and-opt-in-updates
title: Releases are signed, the installer pins digests, and host-mode updates are opt-in
status: active
date: 2026-10-12
track: process
accepted-by: Sergey Strebulaev <s@vivantel.dev>
tags: [security, supply-chain, deployment, roadmap]
---

## Decision

- CI signs every image and every third-party artifact it bundles with cosign (keyless, GitHub OIDC). `install.sh` pins the image digest it was published with and verifies the signature before starting.
- The updater verifies signatures or upstream checksums, keeps the previous version and rolls back on a failed health check. Auto-update is on in container mode and **opt-in in host mode**.
- A signed `freeze` file served from the CDN stops every updater and the installer; publishing it is the kill switch.
- Deploy tokens (Cloudflare, ghcr) are scoped to the narrowest permissions; maintainer accounts use hardware-key 2FA; branch protection requires review for the installer, Dockerfile and workflows.

## Why

A compromise of the Pages deploy, the image or an upstream tool would otherwise reach every host-mode box within a day. See [[releases-are-signed]] and 0059.
