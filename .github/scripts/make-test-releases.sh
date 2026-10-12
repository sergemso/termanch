#!/bin/sh
# Builds signed test releases for the installer and updater tests, all signed by one throwaway key.
#   make-test-releases.sh STATIC_BINARY OUT_DIR
# OUT_DIR gets: release (0.1.0, the binary), release2 (0.1.1, a different binary that works), release3 (0.1.2, a
# binary that starts but never serves, so the update must roll back), release4 (0.1.3, frozen), key / key.pub and
# keys.txt (the public key in release-keys format).
set -eu
BIN="$1"
OUT="$2"
HERE="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$OUT"
ssh-keygen -q -t ed25519 -N '' -C test -f "$OUT/key"
echo "t1 $(cut -d' ' -f1,2 "$OUT/key.pub")" > "$OUT/keys.txt"

release() { # dir version [--freeze]  (binary at $dir/termanch-server-x86_64-linux)
  dir="$1"; version="$2"; shift 2
  cp "$dir/termanch-server-x86_64-linux" "$dir/termanch-server-aarch64-linux"
  python3 "$HERE/make_manifest.py" "$version" "$dir" "$dir/manifest.json" "$@" >/dev/null
  ssh-keygen -Y sign -n termanch-release -f "$OUT/key" "$dir/manifest.json" >/dev/null 2>&1
}

mkdir -p "$OUT/release" "$OUT/release2" "$OUT/release3" "$OUT/release4"
cp "$BIN" "$OUT/release/termanch-server-x86_64-linux"
release "$OUT/release" 0.1.0

cp "$BIN" "$OUT/release2/termanch-server-x86_64-linux"
printf '\n# 0.1.1\n' >> "$OUT/release2/termanch-server-x86_64-linux"   # trailing bytes: a different file that still runs
release "$OUT/release2" 0.1.1

printf '#!/bin/sh\nif [ "$1" = "--help" ]; then exit 0; fi\nexec sleep 3600\n' > "$OUT/release3/termanch-server-x86_64-linux"
chmod +x "$OUT/release3/termanch-server-x86_64-linux"
release "$OUT/release3" 0.1.2

cp "$BIN" "$OUT/release4/termanch-server-x86_64-linux"
printf '\n# 0.1.3\n' >> "$OUT/release4/termanch-server-x86_64-linux"
release "$OUT/release4" 0.1.3 --freeze
