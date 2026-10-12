#!/bin/sh
# Termanch installer. Served by the client at /install.sh.
#
#   curl -fsSL https://app.termanch.vivantel.dev/install.sh | sh -s -- <claim secret> <client origin>
#   curl -fsSL https://app.termanch.vivantel.dev/install.sh | sh -s -- - <client origin>     (shows a QR instead)
#
# It installs Docker if missing, picks a free UDP port, starts the server and hands it the claim
# secret. It asks nothing and needs nothing afterwards: the server appears in Termanch by itself.
# Safe to run again: a new secret re-claims the server (root on this host already allows that).
set -eu

SECRET="${1:--}"
ORIGIN="${2:-${TERMANCH_CLIENT_URL:-https://app.termanch.vivantel.dev}}"
IMAGE="${TERMANCH_IMAGE:-ghcr.io/sergemso/termanch:latest}"
NAME="${TERMANCH_CONTAINER:-termanch}"
ROOT="${TERMANCH_DATA:-/opt/termanch}"

say() { printf '%s\n' "$*"; }
die() { printf 'termanch: %s\n' "$*" >&2; exit 1; }

case "$ORIGIN" in
  https://*|http://localhost*|http://127.0.0.1*) ;;
  *) die "the client address must start with https://" ;;
esac
ORIGIN="${ORIGIN%/}"
if [ "$SECRET" != "-" ]; then
  case "$SECRET" in
    *[!A-Za-z0-9_-]*) die "the claim secret has unexpected characters" ;;
  esac
  [ "${#SECRET}" -eq 43 ] || die "the claim secret has the wrong length"
fi

# Root is needed for Docker and the firewall. Re-run this script under sudo; it was piped in, so fetch it again.
if [ "$(id -u)" -ne 0 ]; then
  command -v sudo >/dev/null 2>&1 || die "run this as root (or install sudo)"
  exec sudo env TERMANCH_IMAGE="$IMAGE" TERMANCH_CONTAINER="$NAME" TERMANCH_DATA="$ROOT" \
    TERMANCH_SKIP_FIREWALL="${TERMANCH_SKIP_FIREWALL:-}" \
    sh -c "$(curl -fsSL "$ORIGIN/install.sh")" termanch-install "$SECRET" "$ORIGIN"
fi

if ! command -v docker >/dev/null 2>&1; then
  say "Installing Docker..."
  curl -fsSL https://get.docker.com | sh >/dev/null 2>&1 || die "could not install Docker; install it and run this command again"
fi
systemctl enable --now docker >/dev/null 2>&1 || true
docker info >/dev/null 2>&1 || die "Docker is installed but not running"

mkdir -p "$ROOT/home"

# One UDP port for the WebRTC connection. The client learns it from the server's signed record, so any
# free port works. Keep the same one across re-runs so firewalls and the directory stay stable.
udp_in_use() {
  command -v ss >/dev/null 2>&1 || return 1
  ss -H -lun 2>/dev/null | awk '{print $4}' | grep -Eq "[:.]$1\$"
}
if [ -s "$ROOT/udp_port" ]; then
  PORT="$(cat "$ROOT/udp_port")"
else
  PORT=4443
  tries=0
  while udp_in_use "$PORT" && [ "$tries" -lt 50 ]; do
    PORT=$((20000 + $(od -An -N2 -tu2 /dev/urandom | tr -d ' ') % 40000))
    tries=$((tries + 1))
  done
  [ "$tries" -lt 50 ] || die "could not find a free UDP port"
  echo "$PORT" > "$ROOT/udp_port"
fi

if [ -z "${TERMANCH_SKIP_FIREWALL:-}" ]; then
  if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
    ufw allow "$PORT/udp" >/dev/null 2>&1 || true
  fi
  if command -v firewall-cmd >/dev/null 2>&1 && firewall-cmd --state >/dev/null 2>&1; then
    firewall-cmd --permanent --add-port="$PORT/udp" >/dev/null 2>&1 && firewall-cmd --reload >/dev/null 2>&1 || true
  fi
fi

chown -R 1000:1000 "$ROOT/home"
docker pull -q "$IMAGE" >/dev/null 2>&1 || docker image inspect "$IMAGE" >/dev/null 2>&1 || die "could not download $IMAGE"
docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" --restart unless-stopped \
  -p "$PORT:$PORT/udp" \
  -e "TERMANCH_UDP_PORT=$PORT" -e "TERMANCH_CLIENT_URL=$ORIGIN" \
  -v "$ROOT/home:/home/node" \
  "$IMAGE" >/dev/null || die "could not start the server"

# Wait for the server process, then hand over the claim.
i=0
until docker exec "$NAME" termanch-server --help >/dev/null 2>&1; do
  i=$((i + 1))
  [ "$i" -lt 30 ] || die "the server did not start; see: docker logs $NAME"
  sleep 1
done

if [ "$SECRET" = "-" ]; then
  OUT="$(docker exec "$NAME" termanch-server --register --qr)"
  case "$OUT" in
    *"already registered"*)
      say "$OUT"
      say "To add it to another browser, or after removing it from the app, open Add Server > Paste a command"
      say "in Termanch and run the command shown there: it starts a fresh registration for this server."
      ;;
    *)
      say "Scan this with Termanch (Add Server > Scan a QR), or open the link:"
      say "$OUT"
      ;;
  esac
else
  docker exec "$NAME" termanch-server --claim "$SECRET" >/dev/null
  say "Termanch server started. It will appear in the app within a minute."
fi
