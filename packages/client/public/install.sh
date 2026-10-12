#!/bin/sh
# Termanch installer. Served by the client at /install.sh.
#
#   curl -fsSL https://app.termanch.vivantel.dev/install.sh | sh -s -- <claim secret> <client origin> [mode]
#   curl -fsSL https://app.termanch.vivantel.dev/install.sh | sh -s -- - <client origin> [mode]      (shows a QR instead)
#
# The optional last word picks where sessions run (DECISION-0058, 0075):
#   (none)      an isolated Docker container (installs Docker if missing)
#   host-user   directly on this machine as a dedicated unprivileged user `termanch`, as a systemd service
#   host        directly on this machine as root, as a systemd service
# The host modes give the owner's browser a shell on the machine itself and need no Docker.
#
# It picks a free UDP port, starts the server and hands it the claim secret. It asks nothing and needs nothing
# afterwards: the server appears in Termanch by itself. Safe to run again: a new secret re-claims the server
# (root on this host already allows that).
#
# Host modes: every change is recorded in /var/lib/termanch-root before it is made and can be undone with
# `termanch-server --revert`. The release is checked before anything is installed: its manifest must carry a valid
# signature by the release key below (checked with ssh-keygen), and the binary must match the signed SHA-256.
set -eu

SECRET="${1:--}"
ORIGIN="${2:-${TERMANCH_CLIENT_URL:-https://app.termanch.vivantel.dev}}"
MODE="${3:-container}"
IMAGE="${TERMANCH_IMAGE:-ghcr.io/sergemso/termanch:latest}"
NAME="${TERMANCH_CONTAINER:-termanch}"
ROOT="${TERMANCH_DATA:-/opt/termanch}"

# The public keys that sign releases: `kid ssh-ed25519 key` lines, the same as packages/server/release-keys.txt.
# TERMANCH_RELEASE_KEYS and TERMANCH_RELEASE_URL exist for the installer's own tests; on a real install they are unset.
RELEASE_KEYS="${TERMANCH_RELEASE_KEYS:-r1 ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIDNH6+yZgMpZl+tW8C/D+9Ga0bN39vXzIIJMKmHB6auf}"
RELEASE_URL="${TERMANCH_RELEASE_URL:-https://github.com/sergemso/termanch/releases/latest/download}"

say() { printf '%s\n' "$*"; }
die() { printf 'termanch: %s\n' "$*" >&2; exit 1; }

case "$ORIGIN" in
  https://*|http://localhost*|http://127.0.0.1*) ;;
  *) die "the client address must start with https://" ;;
esac
ORIGIN="${ORIGIN%/}"
case "$MODE" in
  container|host|host-user) ;;
  *) die "unknown mode \"$MODE\" (use host-user, host, or leave it out)" ;;
esac
if [ "$SECRET" != "-" ]; then
  case "$SECRET" in
    *[!A-Za-z0-9_-]*) die "the claim secret has unexpected characters" ;;
  esac
  [ "${#SECRET}" -eq 43 ] || die "the claim secret has the wrong length"
fi

# Root is needed for services, users and the firewall. Re-run this script under sudo; it was piped in, so fetch it again.
if [ "$(id -u)" -ne 0 ]; then
  command -v sudo >/dev/null 2>&1 || die "run this as root (or install sudo)"
  exec sudo env TERMANCH_IMAGE="$IMAGE" TERMANCH_CONTAINER="$NAME" TERMANCH_DATA="$ROOT" \
    TERMANCH_SKIP_FIREWALL="${TERMANCH_SKIP_FIREWALL:-}" TERMANCH_DRY_RUN="${TERMANCH_DRY_RUN:-}" \
    TERMANCH_FORCE="${TERMANCH_FORCE:-}" TERMANCH_RELEASE_URL="${TERMANCH_RELEASE_URL:-}" TERMANCH_RELEASE_KEYS="${TERMANCH_RELEASE_KEYS:-}" \
    sh -c "$(curl -fsSL "$ORIGIN/install.sh")" termanch-install "$SECRET" "$ORIGIN" "$MODE"
fi

# One UDP port for the WebRTC connection. The client learns it from the server's signed record, so any
# free port works. Keep the same one across re-runs so firewalls and the directory stay stable.
udp_in_use() {
  command -v ss >/dev/null 2>&1 || return 1
  ss -H -lun 2>/dev/null | awk '{print $4}' | grep -Eq "[:.]$1\$"
}
tcp_in_use() {
  command -v ss >/dev/null 2>&1 || return 1
  ss -H -ltn 2>/dev/null | awk '{print $4}' | grep -Eq "[:.]$1\$"
}
random_port() { echo $((20000 + $(od -An -N2 -tu2 /dev/urandom | tr -d ' ') % 40000)); }
# pick_port <in_use function> <first candidate> <file holding the previous choice>
pick_port() {
  if [ -s "$3" ]; then cat "$3"; return; fi
  _p="$2"
  _tries=0
  while "$1" "$_p" && [ "$_tries" -lt 50 ]; do
    _p="$(random_port)"
    _tries=$((_tries + 1))
  done
  [ "$_tries" -lt 50 ] || die "could not find a free port"
  echo "$_p"
}

open_firewall() {
  [ -z "${TERMANCH_SKIP_FIREWALL:-}" ] || return 0
  if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
    ufw allow "$1/udp" >/dev/null 2>&1 || true
  fi
  if command -v firewall-cmd >/dev/null 2>&1 && firewall-cmd --state >/dev/null 2>&1; then
    firewall-cmd --permanent --add-port="$1/udp" >/dev/null 2>&1 && firewall-cmd --reload >/dev/null 2>&1 || true
  fi
}

# ---------------------------------------------------------------------------------------------------------
# Isolated container (Docker)
# ---------------------------------------------------------------------------------------------------------
install_container() {
  if ! command -v docker >/dev/null 2>&1; then
    say "Installing Docker..."
    curl -fsSL https://get.docker.com | sh >/dev/null 2>&1 || die "could not install Docker; install it and run this command again"
  fi
  systemctl enable --now docker >/dev/null 2>&1 || true
  docker info >/dev/null 2>&1 || die "Docker is installed but not running"

  mkdir -p "$ROOT/home"
  PORT="$(pick_port udp_in_use 4443 "$ROOT/udp_port")"
  [ -n "$PORT" ] || die "could not find a free UDP port"
  echo "$PORT" > "$ROOT/udp_port"
  open_firewall "$PORT"

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
      *"is registered to"*) say "$OUT" ;;
      *)
        say "Scan this with Termanch (Add Server > Scan a QR), or open the link:"
        say "$OUT"
        ;;
    esac
  else
    docker exec "$NAME" termanch-server --claim "$SECRET" >/dev/null
    say "Termanch server started. It will appear in the app within a minute."
  fi
}

# ---------------------------------------------------------------------------------------------------------
# This host (native, no Docker)
# ---------------------------------------------------------------------------------------------------------
BIN=/usr/local/bin/termanch-server
UNIT_NAME=termanch.service
UNIT=/etc/systemd/system/$UNIT_NAME
STATE=/var/lib/termanch
JOURNAL=/var/lib/termanch-root

# Hands the claim over (or prints the registration QR) as the user the service runs as.
native_claim() {
  _env="TERMANCH_CONFIG_DIR=$STATE TERMANCH_CLIENT_URL=$ORIGIN TERMANCH_UDP_PORT=$1"
  # shellcheck disable=SC2086 # _env is a list of NAME=value words
  if [ "$RUN_USER" = root ]; then _run="env $_env"; else _run="runuser -u $RUN_USER -- env $_env"; fi
  if [ "$SECRET" = "-" ]; then
    # shellcheck disable=SC2086
    OUT="$($_run "$BIN" --register --qr)"
    case "$OUT" in
      *"is registered to"*) say "$OUT" ;;
      *)
        say "Scan this with Termanch (Add Server > Scan a QR), or open the link:"
        say "$OUT"
        ;;
    esac
  else
    # shellcheck disable=SC2086
    $_run "$BIN" --claim "$SECRET" >/dev/null
    say "Termanch server started. It will appear in the app within a minute."
  fi
}

install_native() {
  [ -d /run/systemd/system ] && command -v systemctl >/dev/null 2>&1 \
    || die "this machine does not run systemd, which the host install needs. Use the isolated container install instead (leave out host / host-user)."
  command -v curl >/dev/null 2>&1 || die "curl is needed"
  command -v sha256sum >/dev/null 2>&1 || die "sha256sum is needed"
  command -v ssh-keygen >/dev/null 2>&1 || die "ssh-keygen is needed to check the release signature (install openssh-client) and nothing was changed"
  case "$(uname -m)" in
    x86_64|amd64) ARCH=x86_64 ;;
    aarch64|arm64) ARCH=aarch64 ;;
    *) die "unsupported processor $(uname -m); the host install supports x86_64 and aarch64" ;;
  esac
  RUN_USER=root
  [ "$MODE" = "host-user" ] && RUN_USER=termanch

  TMP="$(mktemp -d)"
  trap 'rm -rf "$TMP"' EXIT

  # Already installed here: refresh the claim only. TERMANCH_FORCE=1 reinstalls.
  if [ -x "$BIN" ] && [ -f "$UNIT" ] && [ -z "${TERMANCH_FORCE:-}" ]; then
    say "Termanch is already installed on this machine."
    systemctl is-active --quiet "$UNIT_NAME" || systemctl start "$UNIT_NAME"
    RUN_USER="$(sed -n 's/^User=//p' "$UNIT")"
    RUN_USER="${RUN_USER:-root}"
    PORT="$(cat "$JOURNAL/udp_port")"
    native_claim "$PORT"
    return
  fi

  # 1. The release: a signed manifest first, then a binary that matches the hash in it.
  say "Checking the latest release..."
  curl -fsSL --retry 3 -o "$TMP/manifest.json" "$RELEASE_URL/manifest.json" || die "could not download the release manifest"
  curl -fsSL --retry 3 -o "$TMP/manifest.json.sig" "$RELEASE_URL/manifest.json.sig" || die "could not download the release signature"
  printf '%s\n' "$RELEASE_KEYS" | awk 'NF >= 3 { print "termanch-release " $2 " " $3 }' > "$TMP/allowed_signers"
  ssh-keygen -Y verify -f "$TMP/allowed_signers" -I termanch-release -n termanch-release \
    -s "$TMP/manifest.json.sig" < "$TMP/manifest.json" >/dev/null 2>&1 \
    || die "the release signature is not valid, so nothing was installed"
  grep -q '"freeze": *true' "$TMP/manifest.json" && die "new installs are paused by the maintainers (a signed freeze); try again later"
  VERSION="$(sed -n 's/.*"version": *"\([0-9.]*\)".*/\1/p' "$TMP/manifest.json" | head -1)"
  SHA="$(awk -v arch="$ARCH" '
    $0 ~ "\"" arch "\": *[{]" { inside = 1; next }
    inside && /"sha256":/ { gsub(/.*"sha256": *"/, ""); gsub(/".*/, ""); print; exit }
    inside && /[}]/ { inside = 0 }' "$TMP/manifest.json")"
  case "$SHA" in
    *[!0-9a-f]*|"") die "the release has no $ARCH binary" ;;
  esac
  [ "${#SHA}" -eq 64 ] || die "the release has no valid $ARCH hash"
  curl -fsSL --retry 3 -o "$TMP/termanch-server" "$RELEASE_URL/termanch-server-$ARCH-linux" || die "could not download the server"
  echo "$SHA  $TMP/termanch-server" | sha256sum -c - >/dev/null 2>&1 || die "the downloaded server does not match the signed hash, so nothing was installed"
  chmod 755 "$TMP/termanch-server"
  "$TMP/termanch-server" --help >/dev/null 2>&1 || die "the downloaded server does not run on this machine"

  # 2. What will change. Everything below is recorded in the journal first.
  PORT="$(pick_port udp_in_use 4443 "$JOURNAL/udp_port")"
  HTTP_PORT="$(pick_port tcp_in_use 8080 "$JOURNAL/http_port")"
  [ -n "$PORT" ] && [ -n "$HTTP_PORT" ] || die "could not find free ports"
  say ""
  say "Termanch $VERSION will be installed on this machine (sessions run as $RUN_USER):"
  say "  - the server  $BIN"
  [ "$RUN_USER" = root ] || { id "$RUN_USER" >/dev/null 2>&1 || say "  - a new user  $RUN_USER"; }
  command -v tmux >/dev/null 2>&1 || say "  - the package tmux (sessions are tmux sessions)"
  say "  - state       $STATE"
  say "  - a service   $UNIT_NAME (starts at boot)"
  say "  - UDP port    $PORT (opened in the firewall if one is active)"
  say "Every change is recorded in $JOURNAL; undo them with: termanch-server --revert --dry-run, then --revert"
  say ""
  [ -z "${TERMANCH_DRY_RUN:-}" ] || { say "(dry run: nothing was changed)"; return; }

  # journal KIND key=value...  records a change before it is made (the verified binary does the writing)
  journal() {
    _kind="$1"; shift
    _args=""
    for f in "$@"; do _args="$_args --journal-field $f"; done
    # shellcheck disable=SC2086
    "$TMP/termanch-server" --journal-dir "$JOURNAL" --journal-record "$_kind" $_args >/dev/null || die "could not write the journal"
  }

  mkdir -p "$JOURNAL"
  chmod 700 "$JOURNAL"
  echo "$PORT" > "$JOURNAL/udp_port"
  echo "$HTTP_PORT" > "$JOURNAL/http_port"

  # 3. The changes, each recorded first.
  if [ -e "$BIN" ]; then
    mkdir -p "$JOURNAL/backups"
    BACKUP="$JOURNAL/backups/termanch-server.$(date +%s)"
    cp -p "$BIN" "$BACKUP"
    journal file_replaced "path=$BIN" "backup=$BACKUP" "sha256=$SHA"
  else
    journal file_created "path=$BIN" "sha256=$SHA"
  fi
  install -m 0755 "$TMP/termanch-server" "$BIN"

  if [ "$RUN_USER" != root ] && ! id "$RUN_USER" >/dev/null 2>&1; then
    journal user_created "name=$RUN_USER" "home=/home/$RUN_USER"
    useradd --create-home --shell /bin/bash "$RUN_USER" >/dev/null 2>&1 \
      || adduser -D -s /bin/sh "$RUN_USER" >/dev/null 2>&1 \
      || die "could not create the user $RUN_USER"
  fi

  if ! command -v tmux >/dev/null 2>&1; then
    say "Installing tmux..."
    if command -v apt-get >/dev/null 2>&1; then
      journal package_installed manager=apt name=tmux
      DEBIAN_FRONTEND=noninteractive apt-get install -y -qq tmux >/dev/null 2>&1
    elif command -v dnf >/dev/null 2>&1; then
      journal package_installed manager=dnf name=tmux
      dnf install -y -q tmux >/dev/null 2>&1
    elif command -v yum >/dev/null 2>&1; then
      journal package_installed manager=yum name=tmux
      yum install -y -q tmux >/dev/null 2>&1
    elif command -v pacman >/dev/null 2>&1; then
      journal package_installed manager=pacman name=tmux
      pacman -S --noconfirm --quiet tmux >/dev/null 2>&1
    fi
    command -v tmux >/dev/null 2>&1 || die "could not install tmux; install it and run this command again"
  fi

  journal dir_created "path=$STATE"
  mkdir -p "$STATE"
  chown "$RUN_USER" "$STATE"
  chmod 700 "$STATE"

  if [ -z "${TERMANCH_SKIP_FIREWALL:-}" ]; then
    if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
      journal firewall_rule_added tool=ufw "rule=$PORT/udp"
    elif command -v firewall-cmd >/dev/null 2>&1 && firewall-cmd --state >/dev/null 2>&1; then
      journal firewall_rule_added tool=firewalld "rule=$PORT/udp"
    fi
    open_firewall "$PORT"
  fi

  journal unit_installed "name=$UNIT_NAME" "path=$UNIT"
  {
    echo "[Unit]"
    echo "Description=Termanch terminal server"
    echo "After=network-online.target"
    echo "Wants=network-online.target"
    echo ""
    echo "[Service]"
    [ "$RUN_USER" = root ] || echo "User=$RUN_USER"
    echo "WorkingDirectory=~"
    [ "$RUN_USER" != root ] || echo "Environment=HOME=/root"
    echo "Environment=TERMANCH_RUN=native"
    echo "Environment=TERMANCH_RUN_USER=$RUN_USER"
    echo "Environment=TERMANCH_CONFIG_DIR=$STATE"
    echo "Environment=TERMANCH_HOST=127.0.0.1"
    echo "Environment=TERMANCH_PORT=$HTTP_PORT"
    echo "Environment=TERMANCH_UDP_PORT=$PORT"
    echo "Environment=TERMANCH_CLIENT_URL=$ORIGIN"
    echo "ExecStart=$BIN"
    echo "Restart=on-failure"
    echo "RestartSec=2"
    echo "# The tmux sessions the server starts must outlive a restart or an update of the server."
    echo "KillMode=process"
    echo ""
    echo "[Install]"
    echo "WantedBy=multi-user.target"
  } > "$UNIT"
  systemctl daemon-reload
  systemctl enable --now "$UNIT_NAME" >/dev/null 2>&1 || die "could not start the service; see: journalctl -u $UNIT_NAME"

  i=0
  until curl -fs "http://127.0.0.1:$HTTP_PORT/health" >/dev/null 2>&1; do
    i=$((i + 1))
    [ "$i" -lt 30 ] || die "the server did not start; see: journalctl -u $UNIT_NAME"
    sleep 1
  done

  native_claim "$PORT"
}

case "$MODE" in
  container) install_container ;;
  host|host-user) install_native ;;
esac
