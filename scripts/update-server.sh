#!/usr/bin/env bash
set -Eeuo pipefail
umask 022
BASE=/opt/deep-surge-lab
REPO="$BASE/repo"
mkdir -p "$BASE/releases"
exec 9>"$BASE/update.lock"
flock -n 9 || { echo 'Another update is running.' >&2; exit 1; }
if [[ "${1:-}" == --local ]]; then
    TARGET=$(git -C "$REPO" rev-parse HEAD)
elif [[ $# == 0 ]]; then
    timeout 60 git -C "$REPO" -c credential.helper= -c http.lowSpeedLimit=1024 -c http.lowSpeedTime=30 fetch --no-tags origin main
    TARGET=$(git -C "$REPO" rev-parse FETCH_HEAD)
else
    echo 'Usage: update-server.sh [--local]' >&2; exit 2
fi
RELEASE=$(mktemp -d "$BASE/releases/${TARGET:0:12}-XXXXXX")
NEXT="$BASE/.current-$$"
PUBLISHED=0
cleanup() { rm -f "$NEXT"; if [[ "$PUBLISHED" == 0 ]]; then rm -rf "$RELEASE"; fi; }
trap cleanup EXIT
git -C "$REPO" archive "$TARGET" | tar -x -C "$RELEASE"
cd "$RELEASE"
timeout 60 npm run check
timeout 60 npm test
test -s index.html
test -s editor/index.html
chmod -R a+rX "$RELEASE"
OLD=$(readlink "$BASE/current" || true)
ln -s "$RELEASE" "$NEXT"
mv -Tf "$NEXT" "$BASE/current"
PUBLISHED=1
if ! curl --fail --silent --show-error --max-time 15 http://127.0.0.1:3184/deep-surge-lab/ >/dev/null ||
   ! curl --fail --silent --show-error --max-time 15 http://127.0.0.1:3184/deep-surge-editor/ >/dev/null; then
    if [[ -n "$OLD" ]]; then
        ln -s "$OLD" "$NEXT"; mv -Tf "$NEXT" "$BASE/current"
    else
        rm -f "$BASE/current"
        PUBLISHED=0
    fi
    echo 'HTTP check failed; previous release restored when available.' >&2; exit 1
fi
printf '%s\n' "$TARGET" > "$BASE/deployed-commit"
git -C "$REPO" reset --hard "$TARGET"
printf 'Deployed %s\nhttps://taskstream.xyz/deep-surge-lab/\nhttps://taskstream.xyz/deep-surge-editor/\n' "$TARGET"
