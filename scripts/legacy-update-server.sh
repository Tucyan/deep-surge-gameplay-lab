#!/usr/bin/env bash
# Compatibility entry for the previous game deployment.
set -Eeuo pipefail
SCRIPT=/opt/deep-surge-lab/repo/scripts/update-server.sh
if [[ ! -f "$SCRIPT" ]]; then
    echo 'The gameplay experiment has not been installed on this server.' >&2
    exit 1
fi
exec bash "$SCRIPT" "$@"
