# termanch-server image. Built and pushed by CI only (.github/workflows/docker-build.yaml).
# cargo-chef compiles the dependencies in their own layer, keyed on Cargo.lock, so a source change rebuilds
# only our crates. The runtime base comes from docker/Dockerfile.base (rebuilt weekly).
ARG BASE_IMAGE=ghcr.io/sergemso/termanch-base:latest

FROM lukemathwalker/cargo-chef:latest-rust-1-slim-bookworm AS chef
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config libssl-dev cmake \
    && rm -rf /var/lib/apt/lists/*

# The workspace lists every package, so each must be present; only the server is built.
FROM chef AS planner
COPY Cargo.toml Cargo.lock ./
COPY packages/core ./packages/core
COPY packages/server ./packages/server
COPY packages/agent ./packages/agent
RUN cargo chef prepare --recipe-path recipe.json

FROM chef AS builder
COPY --from=planner /app/recipe.json recipe.json
RUN cargo chef cook --release -p termanch-server --recipe-path recipe.json
COPY Cargo.toml Cargo.lock ./
COPY packages/core ./packages/core
COPY packages/server ./packages/server
COPY packages/agent ./packages/agent
RUN cargo build --release -p termanch-server && strip target/release/termanch-server

FROM ${BASE_IMAGE}
LABEL org.opencontainers.image.source="https://github.com/sergemso/termanch" \
      org.opencontainers.image.description="Termanch server: web terminal for remote AI coding agents" \
      org.opencontainers.image.licenses="MIT"
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
