#!/usr/bin/env bash
# One-time installation. Existing sites are backed up before changes.
set -Eeuo pipefail
ROOT=/opt/deep-surge-lab/repo
SITE=/etc/nginx/conf.d/task-stream.conf
ORIGIN=/etc/nginx/conf.d/deep-surge-lab.conf
SNIPPET=/etc/nginx/snippets/deep-surge-lab-locations.inc
test -f "$SITE"
test -f "$ROOT/scripts/nginx-origin.conf"
test -f "$ROOT/scripts/nginx-locations.inc"
if ! grep -qF 'include /etc/nginx/snippets/deep-surge-lab-locations.inc;' "$SITE"; then
    grep -qF 'include /etc/nginx/snippets/deep-surge-location.inc;' "$SITE"
fi
BACKUP=$(mktemp -d /opt/deep-surge-lab/nginx-backup-$(date +%Y%m%d-%H%M%S)-XXXXXX)
mkdir -p /etc/nginx/snippets
cp -a "$SITE" "$BACKUP/task-stream.conf"
if [[ -f "$ORIGIN" ]]; then cp -a "$ORIGIN" "$BACKUP/origin.conf"; fi
if [[ -f "$SNIPPET" ]]; then cp -a "$SNIPPET" "$BACKUP/locations.inc"; fi
restore() {
    cp -a "$BACKUP/task-stream.conf" "$SITE"
    if [[ -f "$BACKUP/origin.conf" ]]; then cp -a "$BACKUP/origin.conf" "$ORIGIN"; else rm -f "$ORIGIN"; fi
    if [[ -f "$BACKUP/locations.inc" ]]; then cp -a "$BACKUP/locations.inc" "$SNIPPET"; else rm -f "$SNIPPET"; fi
}
trap 'install_status=$?; trap - ERR; restore; exit "$install_status"' ERR
cp "$ROOT/scripts/nginx-origin.conf" "$ORIGIN"
cp "$ROOT/scripts/nginx-locations.inc" "$SNIPPET"
if ! grep -qF 'include /etc/nginx/snippets/deep-surge-lab-locations.inc;' "$SITE"; then
    grep -qF 'include /etc/nginx/snippets/deep-surge-location.inc;' "$SITE"
    sed -i '/include \/etc\/nginx\/snippets\/deep-surge-location.inc;/a\    include /etc/nginx/snippets/deep-surge-lab-locations.inc;' "$SITE"
fi
if ! nginx -t; then restore; echo 'Nginx check failed; configuration restored.' >&2; exit 1; fi
if ! systemctl reload nginx; then restore; nginx -t && systemctl reload nginx; exit 1; fi
printf '%s\n' "$BACKUP" > /opt/deep-surge-lab/nginx-backup-path
trap - ERR
printf 'Nginx installed. Backup: %s\n' "$BACKUP"
