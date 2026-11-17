#!/bin/bash
# Run interactively on the VPS. Never pass credentials in command arguments.
set -euo pipefail
[[ $(id -u) == 0 ]] || { echo 'Use sudo bash deploy/staging/configure-mail.sh'; exit 1; }
cd /home/ubuntu/koleksiyonum-staging
test -f .env.staging.local
test -f .deployed-image
grep -q 'MAIL_MODE:' compose.staging.yaml
docker compose -f compose.staging.yaml --env-file .env.staging.local run --rm --no-deps caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
read -r -s -p 'Resend API key (hidden): ' api_key
printf '\n'
read -r -p 'Sender [noreply@koleksiyonum.com.tr]: ' sender
sender=${sender:-noreply@koleksiyonum.com.tr}
read -r -p 'Test recipient [koleksiyonum.destek@gmail.com]: ' recipient
recipient=${recipient:-koleksiyonum.destek@gmail.com}
[[ $api_key =~ ^re_[A-Za-z0-9_-]+$ ]] || { echo 'Invalid API key format'; exit 1; }
email_pattern='^[A-Za-z0-9._+%-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
[[ $sender =~ $email_pattern && $recipient =~ $email_pattern ]] || { echo 'Invalid email address'; exit 1; }
umask 077
temp_env=$(mktemp .env.mail.XXXXXX.local)
trap 'rm -f "$temp_env"' EXIT
grep -vE '^(MAIL_MODE|RESEND_API_KEY|MAIL_FROM|MAIL_TEST_RECIPIENTS)=' .env.staging.local > "$temp_env"
printf 'MAIL_MODE=resend\nRESEND_API_KEY=%s\nMAIL_FROM=%s\nMAIL_TEST_RECIPIENTS=%s\n' "$api_key" "$sender" "$recipient" >> "$temp_env"
unset api_key sender recipient
export BACKEND_IMAGE
BACKEND_IMAGE=$(cat .deployed-image)
[[ $BACKEND_IMAGE =~ ^koleksiyonum-backend:sha-[0-9a-f]{40}$ ]] || { echo 'Invalid image marker'; exit 1; }
docker compose -f compose.staging.yaml --env-file "$temp_env" config --quiet
cp -p .env.staging.local .env.mail-previous.local
mv "$temp_env" .env.staging.local
if ! docker compose -f compose.staging.yaml --env-file .env.staging.local up -d --no-build --no-deps --wait backend; then
  cp -p .env.mail-previous.local .env.staging.local
  docker compose -f compose.staging.yaml --env-file .env.staging.local up -d --no-build --no-deps --wait backend
  echo 'Mail configuration failed; previous environment restored.'
  exit 1
fi
docker compose -f compose.staging.yaml --env-file .env.staging.local up -d --no-deps --force-recreate caddy
echo 'Mail settings loaded. No email was sent by this script.'
echo 'Use https://test.koleksiyonum.com.tr/auth-test to test delivery.'
