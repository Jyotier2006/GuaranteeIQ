#!/usr/bin/env sh
# Requires Docker + Compose and curl. Not executed in the provided build environment.
set -eu
docker compose up --build -d
trap 'docker compose down' EXIT
ready=0
for attempt in $(seq 1 30); do
  if curl -fsS http://localhost:8080/healthz >/dev/null; then ready=1; break; fi
  sleep 1
done
[ "$ready" = 1 ]
curl -fsS http://localhost:8080/ | grep -q 'GuaranteeIQ'
curl -fsS http://localhost:8080/a-spa-route | grep -q 'GuaranteeIQ'
[ "$(docker compose exec -T web id -u)" = 10001 ]
asset="$(docker compose exec -T web sh -c 'ls /usr/share/nginx/html/assets/index-*.js' | head -n 1 | xargs basename)"
curl -fsSI "http://localhost:8080/assets/$asset" | grep -qi 'immutable'
curl -fsSI -H 'Accept-Encoding: gzip' "http://localhost:8080/assets/$asset" | grep -qi 'Content-Encoding: gzip'
echo 'PASS: health, index, SPA fallback, non-root, asset cache and gzip.'
