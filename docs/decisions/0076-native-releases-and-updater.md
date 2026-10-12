---
id: 0076-native-releases-and-updater
title: Native releases carry a signed manifest and a root-owned updater applies them with rollback
status: active
date: 2026-10-12
track: process
accepted-by: Sergey Strebulaev <s@vivantel.dev>
tags: [build, security, deployment]
---

## Decision

- A tagged release builds the static binaries on the native amd64 and arm64 runners and publishes them with `SHA256SUMS` and a `manifest.json` (version, per-architecture hashes and URLs, optional `freeze`) signed with an Ed25519 **release key** kept as a GitHub Actions secret. Its public key (with a key id) is embedded in the installer and in the server binary; a rotation adds a second key id (as for device certificates, 0062).
- The installer and the updater verify the manifest signature, then the binary hash, before running or swapping anything. No extra tools are needed and the download host is not trusted. This amends 0063 for native binaries; Docker images keep cosign.
- A root-owned updater (a systemd timer plus a helper, separate from the server which may be unprivileged) checks daily, honours a signed `freeze`, keeps the previous binary, swaps atomically, restarts the unit and **rolls back** when the health check fails. The app can ask for an immediate check through 0077.
- Supported architectures: x86_64 and aarch64 Linux.

## Why

Nothing else updates a native service, and an update channel is also an attack channel, so it must be verified, reversible and stoppable. A signed manifest with an embedded key is verifiable with a few lines of code on any host, where cosign would need a 40 MB tool. See [[updates-are-verified-and-reversible]], [[releases-are-signed]], [[0063-signed-releases-and-opt-in-updates]].
