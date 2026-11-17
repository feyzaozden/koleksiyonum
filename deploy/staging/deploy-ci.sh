#!/bin/bash
# Install root-owned at /usr/local/sbin/koleksiyonum-deploy. Backend images only.
set -euo pipefail
[[ $(id -u) == 0 ]] || { echo 'Root required'; exit 1; }
[[ $# == 1 && $1 =~ ^[0-9a-f]{40}$ ]] || { echo 'Expected commit SHA'; exit 1; }
exec 9>/run/lock/koleksiyonum-staging-deploy.lock
flock -w 600 9
cd /home/ubuntu/koleksiyonum-staging
[[ -f .env.staging.local ]] || { echo 'Staging must be installed first'; exit 1; }
archive="/home/ubuntu/koleksiyonum-ci/$1.tar.gz"
[[ -f "$archive" && ! -L "$archive" ]] || { echo 'Image archive missing'; exit 1; }
compose() { docker compose -f compose.staging.yaml --env-file .env.staging.local "$@"; }
previous=$(docker inspect --format '{{.Image}}' koleksiyonum-staging-backend-1)
# Immutable local rollback tag, kept until the next deployment.
docker tag "$previous" koleksiyonum-backend:rollback
export BACKEND_IMAGE="koleksiyonum-backend:sha-$1"
docker load -i "$archive"
docker image inspect "$BACKEND_IMAGE" >/dev/null
compose config --quiet
# Fail before replacement if any migration fails. Applied migrations are never undone here.
compose --profile tools run --rm --no-deps migrate
if ! compose up -d --no-build --no-deps --wait --wait-timeout 120 backend; then
  echo 'Backend health check failed. Restoring previous image (database is not rolled back).'
  BACKEND_IMAGE=koleksiyonum-backend:rollback compose up -d --no-build --no-deps --wait --wait-timeout 120 backend
  exit 1
fi
umask 077
printf '%s\n' "$BACKEND_IMAGE" > .deployed-image.next
mv -f .deployed-image.next .deployed-image
rm -- "$archive"
echo "Backend deployed: $1"
