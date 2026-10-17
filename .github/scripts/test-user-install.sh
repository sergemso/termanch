#!/bin/sh
# Runs the installer for the current user (host-me, decision 0113) inside a machine that runs systemd, as a normal user
# without root, and checks what it did (CI job "installer", mode host-me). This script itself runs as root only to set the
# machine up (a user, that user's systemd manager) and to inspect the result.
# Expects: /install.sh, /uninstall.sh, /release (+ /release2, /release3, /release4), /keys.txt, curl, ssh-keygen, iproute2.
set -eu

ORIGIN=https://app.termenbox.dev
SECRET="$(head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 43)"
fail() { echo "FAIL: $*"; exit 1; }

echo "== the installer for the current user refuses to run as root"
if TERMENBOX_RELEASE_URL=file:///release TERMENBOX_RELEASE_KEYS="$(cat /keys.txt)" sh /install.sh "$SECRET" "$ORIGIN" host-me >/tmp/root.txt 2>&1; then
  fail "host-me installed as root"
fi
grep -q "needs no root" /tmp/root.txt || { cat /tmp/root.txt; fail "the refusal does not say why"; }

useradd --create-home --shell /bin/bash alice
A_UID="$(id -u alice)"
# What a login over ssh gives alice: her own systemd manager. Lingering is left off, so the installer's own step runs.
systemctl start "user@$A_UID.service"
i=0; while [ ! -S "/run/user/$A_UID/bus" ] && [ $i -lt 20 ]; do i=$((i + 1)); sleep 1; done
[ -S "/run/user/$A_UID/bus" ] || fail "alice has no user manager in this machine"

as_alice() {
  runuser -u alice -- env HOME=/home/alice XDG_RUNTIME_DIR="/run/user/$A_UID" DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/$A_UID/bus" \
    TERMENBOX_RELEASE_URL="${REL:-file:///release}" TERMENBOX_RELEASE_KEYS="$(cat /keys.txt)" "$@"
}
BIN=/home/alice/.local/bin/termenbox-server
STATE=/home/alice/.config/termenbox
JOURNAL=/home/alice/.local/state/termenbox
UNITS=/home/alice/.config/systemd/user
usr() { as_alice systemctl --user "$@"; }
snapshot() { (cd /home/alice && find . -path ./.cache -prune -o -print | sort | md5sum); ls -A /etc/systemd/system /usr/local/bin | sort | md5sum; }

echo "== without tmux it stops and says what to run, having changed nothing"
before="$(snapshot)"
if as_alice sh /install.sh "$SECRET" "$ORIGIN" host-me >/tmp/notmux.txt 2>&1; then fail "installed without tmux"; fi
grep -q "tmux is needed" /tmp/notmux.txt || { cat /tmp/notmux.txt; fail "the refusal does not say why"; }
[ "$(snapshot)" = "$before" ] || fail "a refused install changed the machine"
apt-get install -y -qq tmux >/dev/null 2>&1 || fail "could not install tmux for the rest of the test"

echo "== a dry run changes nothing"
before="$(snapshot)"
as_alice env TERMENBOX_DRY_RUN=1 sh /install.sh "$SECRET" "$ORIGIN" host-me
[ "$(snapshot)" = "$before" ] || fail "the dry run changed the machine"

echo "== install, as alice, with no root"
before_system="$(ls -A /etc/systemd/system /usr/local/bin /var/lib | sort | md5sum)"
as_alice sh /install.sh "$SECRET" "$ORIGIN" host-me | tee /tmp/install.txt
usr is-active --quiet termenbox || fail "the user service is not active"
port="$(sed -n 's/^Environment=TERMENBOX_PORT=//p' "$UNITS/termenbox.service")"
curl -fs "http://127.0.0.1:$port/health" >/dev/null || fail "the server does not answer on its health port"
pid="$(usr show -p MainPID --value termenbox)"
[ "$pid" -gt 0 ] || fail "the service has no main process"
[ "$(stat -c %U "/proc/$pid")" = alice ] || fail "the server does not run as alice"
! grep -q '^User=' "$UNITS/termenbox.service" || fail "the unit names a user; a user unit must not"
grep -q '^KillMode=process' "$UNITS/termenbox.service" || fail "sessions would die with the service"
grep -q '^WantedBy=default.target' "$UNITS/termenbox.service" || fail "the unit is not wanted by the user's default target"
[ -f "$STATE/server_key" ] || fail "the server did not create its state"
[ "$(ls -A /etc/systemd/system /usr/local/bin /var/lib | sort | md5sum)" = "$before_system" ] || fail "something outside alice's home was changed"
as_alice "$BIN" --journal-dir "$JOURNAL" --journal-list | grep -q unit_installed || fail "the journal has no unit entry"
as_alice "$BIN" --journal-dir "$JOURNAL" --journal-list | grep -q file_created || fail "the journal has no binary entry"
# Starting at boot needs lingering: either alice could switch it on for herself, or the installer said what root would have to run.
if [ "$(loginctl show-user alice -p Linger --value)" = yes ]; then
  as_alice "$BIN" --journal-dir "$JOURNAL" --journal-list | grep -q linger_enabled || fail "lingering was enabled but is not in the journal"
else
  grep -q "loginctl enable-linger alice" /tmp/install.txt || fail "no lingering and no instruction how to get it"
fi

echo "== installing again changes nothing"
entries="$(as_alice "$BIN" --journal-dir "$JOURNAL" --journal-list | wc -l)"
as_alice sh /install.sh "$SECRET" "$ORIGIN" host-me
[ "$(as_alice "$BIN" --journal-dir "$JOURNAL" --journal-list | wc -l)" = "$entries" ] || fail "a second install wrote more journal entries"
usr is-active --quiet termenbox || fail "the service stopped"

echo "== the updater and the request handler are user units and running"
usr is-active --quiet termenbox-update.timer || fail "the update timer is not active"
usr is-active --quiet termenbox-request.path || fail "the request path unit is not active"
[ -d "$STATE/requests" ] || fail "the requests directory is missing"
[ "$(stat -c %U "$STATE/requests")" = alice ] || fail "the requests directory does not belong to alice"
as_alice "$BIN" --journal-dir "$JOURNAL" --journal-list | grep -q termenbox-update.timer || fail "the updater units are not in the journal"
sha() { sha256sum "$1" | cut -d' ' -f1; }
helper() { REL="file://$1" as_alice env TERMENBOX_BINARY="$BIN" "$BIN" --root-helper update --user-helper --journal-dir "$JOURNAL"; }

echo "== the user helper refuses to run as root, and a root helper refuses a plain user"
if TERMENBOX_RELEASE_URL=file:///release4 TERMENBOX_RELEASE_KEYS="$(cat /keys.txt)" "$BIN" --root-helper update --user-helper --journal-dir "$JOURNAL" >/tmp/rootuser.txt 2>&1; then fail "the user helper ran as root"; fi
grep -q "must not run as root" /tmp/rootuser.txt || { cat /tmp/rootuser.txt; fail "the refusal does not say why"; }
if as_alice "$BIN" --root-helper update --journal-dir "$JOURNAL" >/tmp/plain.txt 2>&1; then fail "the root helper ran as a plain user"; fi

echo "== a frozen release is not installed"
before_sha="$(sha "$BIN")"
helper /release4 | grep -q "paused" || fail "a frozen release was not reported"
[ "$(sha "$BIN")" = "$before_sha" ] || fail "a frozen release changed the binary"

echo "== a newer release is installed by alice's own updater, the old binary is kept, the service comes back"
helper /release2 | grep -q "updated .* -> 9.0.1" || fail "the update did not report success"
[ "$(sha "$BIN")" = "$(sha /release2/termenbox-server-x86_64-linux)" ] || fail "the new binary is not in place"
[ -f "$BIN.prev" ] || fail "the previous binary was not kept"
usr is-active --quiet termenbox || fail "the service is not active after the update"

echo "== a release that does not come up is rolled back"
good_sha="$(sha "$BIN")"
set +e
helper /release3 > /tmp/rollback.txt 2>&1
code=$?
set -e
[ "$code" = 2 ] || { cat /tmp/rollback.txt; fail "a failed update did not exit with 2 (got $code)"; }
grep -q "rolled back" /tmp/rollback.txt || fail "the rollback was not reported"
[ "$(sha "$BIN")" = "$good_sha" ] || fail "the old binary was not restored"
usr is-active --quiet termenbox || fail "the service is not active after the rollback"

echo "== a request from the server reaches the user helper, and junk does not"
requests="$STATE/requests"
printf '{"action":"update-now"}' > "$requests/r1.json"
printf '{"action":"rm","path":"/"}' > "$requests/r2.json"
ln -s /etc/hostname "$requests/r3.json"
chown -h alice "$requests"/*.json
i=0
while [ -n "$(ls -A "$requests")" ] && [ $i -lt 30 ]; do i=$((i + 1)); sleep 1; done
[ -z "$(ls -A "$requests")" ] || fail "the helper did not consume the requests"
[ -f /etc/hostname ] || fail "a link in the requests directory damaged its target"

echo "== uninstall.sh as alice shows the plan first and changes nothing"
before="$(snapshot)"
as_alice sh /uninstall.sh | grep -q "Nothing was changed" || fail "the uninstall preview did not say it changed nothing"
[ "$(snapshot)" = "$before" ] || fail "the uninstall preview changed the machine"
usr is-active --quiet termenbox || fail "the preview stopped the service"

echo "== uninstall.sh --yes, as alice, removes it all"
as_alice sh /uninstall.sh --yes
[ ! -e "$UNITS/termenbox.service" ] || fail "the unit is still there"
[ ! -e "$BIN" ] || fail "the binary is still there"
[ ! -e "$STATE" ] || fail "the state directory is still there"
[ ! -e "$JOURNAL" ] || fail "the journal is still there"
[ -d /home/alice ] || fail "alice's home was touched"
[ "$(loginctl show-user alice -p Linger --value)" != yes ] || fail "lingering the installer enabled was left on"
echo "OK: host-me"
