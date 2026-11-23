#!/usr/bin/env bash
# Generates the production secrets files from Smart-Surveillance-System/.env:
#   infra/mosquitto/passwd   (MQTT_USERNAME / MQTT_PASSWORD)
#   infra/mosquitto/acl
#   BASIC_AUTH_HASH in .env  (bcrypt of BASIC_AUTH_PASSWORD, for Caddy)
# Requires Docker. Safe to re-run after changing passwords.
set -euo pipefail

cd "$(dirname "$0")/../.."
[ -f .env ] || { echo ".env not found. cp infra/.env.prod.example .env first" >&2; exit 1; }

get() { grep -E "^$1=" .env | tail -n1 | cut -d= -f2- | sed -e "s/^['\"]//" -e "s/['\"]$//"; }

MQTT_USERNAME="$(get MQTT_USERNAME)"
MQTT_PASSWORD="$(get MQTT_PASSWORD)"
BASIC_AUTH_PASSWORD="$(get BASIC_AUTH_PASSWORD)"
for v in MQTT_USERNAME MQTT_PASSWORD BASIC_AUTH_PASSWORD; do
  [ -n "${!v}" ] || { echo "$v is empty in .env" >&2; exit 1; }
done
if [ "$MQTT_PASSWORD" = "change-me" ] || [ "$BASIC_AUTH_PASSWORD" = "change-me" ]; then
  echo "Refusing to use the placeholder password 'change-me'. Edit .env first." >&2
  exit 1
fi

mkdir -p infra/mosquitto
rm -f infra/mosquitto/passwd
touch infra/mosquitto/passwd
docker run --rm -v "$PWD/infra/mosquitto:/work" eclipse-mosquitto:2 \
  mosquitto_passwd -b /work/passwd "$MQTT_USERNAME" "$MQTT_PASSWORD"
chmod 644 infra/mosquitto/passwd

cat > infra/mosquitto/acl <<EOF
user $MQTT_USERNAME
topic readwrite ppe/#
topic read \$SYS/#
EOF
chmod 644 infra/mosquitto/acl

HASH="$(docker run --rm caddy:2-alpine caddy hash-password --plaintext "$BASIC_AUTH_PASSWORD")"
# Single quotes: docker compose must not interpolate the $ signs inside the bcrypt hash.
grep -vE '^BASIC_AUTH_HASH=' .env > .env.tmp || true
printf "BASIC_AUTH_HASH='%s'\n" "$HASH" >> .env.tmp
mv .env.tmp .env

# Evidence upload token for the Jetson (generated once, kept if already set)
TOKEN="$(get EVIDENCE_UPLOAD_TOKEN)"
if [ -z "$TOKEN" ] || [ "$TOKEN" = "change-me" ]; then
  TOKEN="$(openssl rand -hex 24)"
  grep -vE '^EVIDENCE_UPLOAD_TOKEN=' .env > .env.tmp || true
  printf 'EVIDENCE_UPLOAD_TOKEN=%s\n' "$TOKEN" >> .env.tmp
  mv .env.tmp .env
  echo "Generated EVIDENCE_UPLOAD_TOKEN (give this to the Jetson as EVIDENCE_UPLOAD_TOKEN): $TOKEN"
fi

echo "Wrote infra/mosquitto/passwd, infra/mosquitto/acl and BASIC_AUTH_HASH in .env"
