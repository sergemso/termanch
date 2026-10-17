#!/bin/sh
# Run a command in the pinned build container:  scripts/dev.sh [--full] <command...>
#   scripts/dev.sh cargo test --workspace
#   scripts/dev.sh --full sh -c 'pnpm install --frozen-lockfile && cargo build --release -p termenbox-server && node packages/client/e2e/run.mjs'
# --full adds Node, pnpm and the Chrome libraries. Caches persist in the `cache` volume (docker/docker-compose.dev.yml).
set -eu
cd "$(dirname "$0")/.."
svc=rust
if [ "${1:-}" = "--full" ]; then svc=full; shift; fi
[ "$#" -gt 0 ] || { echo "usage: scripts/dev.sh [--full] <command...>" >&2; exit 2; }
export DEV_UID="$(id -u)" DEV_GID="$(id -g)"
export DOCKER_BUILDKIT=1
compose="docker compose -f docker/docker-compose.dev.yml"
# A no-op when the Dockerfile is unchanged; picks up edits to it otherwise (run alone never rebuilds).
$compose build --quiet "$svc" >/dev/null
exec $compose run --rm "$svc" "$@"
