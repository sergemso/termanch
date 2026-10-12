#!/bin/sh
# Runs the native installer inside a machine that runs systemd and checks what it did (CI job "installer").
#   test-native-install.sh host-user|host
# Expects: /install.sh (the installer), /release (a signed test release), /keys.txt (the test release key),
# curl, ssh-keygen and iproute2 installed. Exits non-zero on the first thing that is wrong.
set -eu

MODE="$1"
ORIGIN=https://app.termanch.vivantel.dev
SECRET="$(head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 43)"
RUN_USER=termanch
[ "$MODE" = host ] && RUN_USER=root

export TERMANCH_RELEASE_URL=file:///release
TERMANCH_RELEASE_KEYS="$(cat /keys.txt)"
export TERMANCH_RELEASE_KEYS
export TERMANCH_SKIP_FIREWALL=1

fail() { echo "FAIL: $*"; exit 1; }
snapshot() { ls -A /etc/systemd/system /usr/local/bin /var/lib /home 2>/dev/null | sort | md5sum; }

before="$(snapshot)"

echo "== a dry run changes nothing"
TERMANCH_DRY_RUN=1 sh /install.sh "$SECRET" "$ORIGIN" "$MODE"
[ "$(snapshot)" = "$before" ] || fail "the dry run changed the machine"

echo "== install"
sh /install.sh "$SECRET" "$ORIGIN" "$MODE"
systemctl is-active --quiet termanch || fail "the service is not active"
port="$(sed -n 's/^Environment=TERMANCH_PORT=//p' /etc/systemd/system/termanch.service)"
curl -fs "http://127.0.0.1:$port/health" >/dev/null || fail "the server does not answer on its health port"
pid="$(systemctl show -p MainPID --value termanch)"
[ "$pid" -gt 0 ] || fail "the service has no main process"
[ "$(stat -c %U "/proc/$pid")" = "$RUN_USER" ] || fail "the server does not run as $RUN_USER"
[ "$MODE" = host ] || id termanch >/dev/null || fail "the user termanch was not created"
command -v tmux >/dev/null || fail "tmux was not installed"
grep -q '^KillMode=process' /etc/systemd/system/termanch.service || fail "sessions would die with the service"
[ -f /var/lib/termanch/server_key ] || fail "the server did not create its state"
termanch-server --journal-list | grep -q unit_installed || fail "the journal has no unit entry"
termanch-server --journal-list | grep -q file_created || fail "the journal has no binary entry"

echo "== installing again changes nothing"
entries="$(termanch-server --journal-list | wc -l)"
sh /install.sh "$SECRET" "$ORIGIN" "$MODE"
[ "$(termanch-server --journal-list | wc -l)" = "$entries" ] || fail "a second install wrote more journal entries"
systemctl is-active --quiet termanch || fail "the service stopped"

echo "== a changed release is refused"
cp /release/manifest.json /tmp/manifest.good
echo " " >> /release/manifest.json 2>/dev/null || true
if TERMANCH_FORCE=1 sh /install.sh "$SECRET" "$ORIGIN" "$MODE" >/tmp/refused.txt 2>&1; then
  cp /tmp/manifest.good /release/manifest.json 2>/dev/null || true
  fail "a release with a broken signature was installed"
fi
grep -q "signature is not valid" /tmp/refused.txt || { cat /tmp/refused.txt; fail "the refusal does not say why"; }
cp /tmp/manifest.good /release/manifest.json 2>/dev/null || true

echo "== revert restores the machine"
systemctl stop termanch
rm -rf /var/lib/termanch/*   # the server's own state is removed by the uninstall step, not by the journal
termanch-server --revert --dry-run | grep -q "would revert" || fail "the dry run shows nothing"
termanch-server --revert
[ ! -e /etc/systemd/system/termanch.service ] || fail "the unit is still there"
[ ! -e /usr/local/bin/termanch-server ] || fail "the binary is still there"
[ ! -e /var/lib/termanch ] || fail "the state directory is still there"
[ "$MODE" = host ] || ! id termanch >/dev/null 2>&1 || fail "the user is still there"
echo "OK: $MODE"
