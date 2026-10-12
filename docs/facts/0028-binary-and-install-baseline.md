---
id: 0028
title: The server binary and installer before the native host mode
status: active
tags: [server, deployment, build]
date: 2026-10-12
---

# The server binary and installer before the native host mode

- `termanch-server` is built for `x86_64-unknown-linux-gnu` and links glibc and OpenSSL dynamically (`libssl.so.3`, `libcrypto.so.3`). OpenSSL comes only from `reqwest`'s default native-tls; the WebRTC library `str0m` already uses `aws-lc-rs`. It is not a portable single file.
- There is no release workflow: binaries exist only inside the Docker image built by `.github/workflows/docker-build.yaml` (native amd64 and arm64 runners).
- `packages/client/public/install.sh` always installs and uses Docker. Host mode (decision 0058, merged) runs the server in a container started with `--pid=host --privileged` and reaches the host through `nsenter` (`Runner` in `packages/server/src/backend.rs`).
- Nothing restarts or updates the server except Docker's restart policy; the change journal (0067, v2 plan S.7) and signed releases (0063, v2 plan S.3) are not built.
- The server needs `tmux` on the machine where sessions run; in host mode the installer installs it with the host's package manager.
