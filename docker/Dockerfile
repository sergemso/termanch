# Multi-stage Dockerfile for termanch-server
FROM rust:1.79-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy workspace files
COPY Cargo.toml Cargo.lock ./
COPY packages/core ./packages/core
COPY packages/server ./packages/server
COPY packages/agent ./packages/agent

# Build server and agent
RUN cargo build --release -p termanch-server -p termanch-agent

# Runner stage
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    tmux \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -u 1000 -s /bin/bash termanch

WORKDIR /home/termanch

# Copy binaries
COPY --from=builder /app/target/release/termanch-server /usr/local/bin/
COPY --from=builder /app/target/release/termanch-agent /usr/local/bin/

# Create directories
RUN mkdir -p /home/termanch/.config/termanch && chown -R termanch:termanch /home/termanch

USER termanch

ENV TERMANCH_HOST=0.0.0.0
ENV TERMANCH_PORT=8080
ENV TERMANCH_SOCKET_PATH=/tmp/termanch-agent.sock

EXPOSE 8080

# Default command runs server
CMD ["termanch-server"]