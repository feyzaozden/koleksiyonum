#!/bin/bash
# Run on the VPS after uploading compose.staging.yaml. Never put secrets in arguments.
set -euo pipefail
[[ $(id -u) == 0 ]] || { echo 'Use sudo bash deploy/staging/configure-catalog.sh'; exit 1; }
exec 9>/run/lock/koleksiyonum-staging-deploy.lock
flock -w 600 9
cd /home/ubuntu/koleksiyonum-staging
test -f .env.staging.local
grep -q 'TMDB_READ_ACCESS_TOKEN:' compose.staging.yaml
export BACKEND_IMAGE
BACKEND_IMAGE=$(cat .deployed-image)
[[ $BACKEND_IMAGE =~ ^koleksiyonum-backend:sha-[0-9a-f]{40}$ ]] || exit 1
if [[ -t 0 ]]; then read -r -s -p 'TMDB API Read Access Token (hidden): ' token; printf '\n'; else read -r token; fi
token=${token%$'\r'}
[[ $token =~ ^[A-Za-z0-9_.+/=-]{30,}$ ]] || { echo 'Invalid token format'; exit 1; }
umask 077
temp_env=$(mktemp .env.catalog.XXXXXX.local)
trap 'rm -f "$temp_env"' EXIT
grep -v '^TMDB_READ_ACCESS_TOKEN=' .env.staging.local > "$temp_env"
printf 'TMDB_READ_ACCESS_TOKEN=%s\n' "$token" >> "$temp_env"
unset token
docker compose -f compose.staging.yaml --env-file "$temp_env" config --quiet
cp -p .env.staging.local .env.catalog-previous.local
mv "$temp_env" .env.staging.local
if ! docker compose -f compose.staging.yaml --env-file .env.staging.local up -d --no-build --no-deps --wait backend; then
  cp -p .env.catalog-previous.local .env.staging.local
  docker compose -f compose.staging.yaml --env-file .env.staging.local up -d --no-build --no-deps --wait backend
  echo 'Configuration failed; previous environment restored.'
  exit 1
fi
echo 'Catalog configuration loaded.'
