#!/bin/sh
# Run manually on the VPS after copying the reviewed deployment files.
set -eu
[ "$(id -u)" = 0 ] || { echo 'Run with sudo sh deploy/staging/install-ci.sh'; exit 1; }
cd /home/ubuntu/koleksiyonum-staging
test -f .env.staging.local
bash -n deploy/staging/deploy-ci.sh
sh -n deploy/staging/start.sh
docker compose -f compose.staging.yaml --env-file .env.staging.local config --quiet
# Refuse an old Compose file that would ignore the versioned CI image.
grep -Fq '${BACKEND_IMAGE:-koleksiyonum-backend:staging}' compose.staging.yaml
install -o root -g root -m 755 deploy/staging/deploy-ci.sh /usr/local/sbin/koleksiyonum-deploy
temp_rule=$(mktemp)
trap 'rm -f "$temp_rule"' EXIT HUP INT TERM
printf '%s\n' 'ubuntu ALL=(root) NOPASSWD: /usr/local/sbin/koleksiyonum-deploy' > "$temp_rule"
chmod 440 "$temp_rule"
visudo -cf "$temp_rule"
install -o root -g root -m 440 "$temp_rule" /etc/sudoers.d/koleksiyonum-deploy
visudo -c
install -d -o ubuntu -g ubuntu -m 700 /home/ubuntu/koleksiyonum-ci
echo 'CI deployment command installed. No application or database restart was performed.'
