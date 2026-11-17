#!/bin/sh
set -eu
cd "$(dirname "$0")/../.."
if [ "$(id -u)" -ne 0 ]; then
  echo 'Run with: sudo sh deploy/staging/start.sh'
  exit 1
fi
umask 077
if [ ! -f .env.staging.local ]; then
  if docker volume inspect koleksiyonum-staging_postgres_data >/dev/null 2>&1; then
    echo 'Existing database volume found but env file is missing. Restore the original env file; do not generate new passwords.'
    exit 1
  fi
  command -v openssl >/dev/null
  admin_password=$(openssl rand -hex 32)
  app_password=$(openssl rand -hex 32)
  printf 'STAGING_DB_ADMIN_PASSWORD=%s\nSTAGING_DB_APP_PASSWORD=%s\n' "$admin_password" "$app_password" > .env.staging.local
  unset admin_password app_password
fi
chmod 600 .env.staging.local
if [ -f .deployed-image ]; then
  BACKEND_IMAGE=$(cat .deployed-image)
  case "$BACKEND_IMAGE" in
    koleksiyonum-backend:sha-*) export BACKEND_IMAGE ;;
    *) echo 'Invalid deployed image marker'; exit 1 ;;
  esac
  echo 'CI-managed installation: use the GitHub workflow for updates.'
  docker compose -f compose.staging.yaml --env-file .env.staging.local up -d --no-build --wait backend caddy
  exit 0
fi
compose() { docker compose -f compose.staging.yaml --env-file .env.staging.local "$@"; }
compose config --quiet
compose --profile tools run --rm --build migrate
compose run --rm --no-deps caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
compose up -d --wait --wait-timeout 180 backend caddy
compose ps
echo 'Services started. HTTPS certificate issuance may take a little longer.'
echo 'Check https://test.koleksiyonum.com.tr/health/db'
