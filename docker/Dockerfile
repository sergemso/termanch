# termanch-server image. Built and pushed by CI only (.github/workflows/docker-build.yaml).
FROM rust:1-slim-bookworm AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config libssl-dev cmake \
    && rm -rf /var/lib/apt/lists/*

# The workspace lists every package, so each must be present; only the server is built.
COPY Cargo.toml Cargo.lock ./
COPY packages/core ./packages/core
COPY packages/server ./packages/server
COPY packages/agent ./packages/agent
RUN cargo build --release -p termanch-server && strip target/release/termanch-server

# Runtime: Node is here so coding agents (codex, claude) can be installed inside the session environment.
FROM node:22-bookworm-slim
LABEL org.opencontainers.image.source="https://github.com/sergemso/termanch" \
      org.opencontainers.image.description="Termanch server: web terminal for remote AI coding agents" \
      org.opencontainers.image.licenses="MIT"
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates tmux git curl openssh-client procps \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/termanch-server /usr/local/bin/termanch-server

# The base image already has a non-root user `node` (uid 1000); its home is the persistent volume.
USER node
WORKDIR /home/node
ENV TERMANCH_CONFIG_DIR=/home/node/.config/termanch \
    TERMANCH_HOST=127.0.0.1 \
    TERMANCH_PORT=8080

# The HTTP/WebSocket port stays inside the container; clients reach the server on its UDP port.
HEALTHCHECK --interval=60s --timeout=5s --start-period=10s CMD curl -fs http://127.0.0.1:8080/health || exit 1
CMD ["termanch-server"]
