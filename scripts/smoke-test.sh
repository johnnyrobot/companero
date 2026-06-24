#!/usr/bin/env bash
set -euo pipefail
IMG=companero:smoke
docker build -t "$IMG" .
docker run -d --rm -p 8099:80 --name companero_smoke "$IMG"
trap 'docker stop companero_smoke >/dev/null 2>&1 || true' EXIT
for i in $(seq 1 20); do curl -fsS http://localhost:8099/ >/dev/null 2>&1 && break; sleep 0.5; done
curl -fsS http://localhost:8099/ >/dev/null 2>&1 || { echo "FAIL: container did not become ready within ~10s"; docker logs companero_smoke; exit 1; }

# index.html must be no-cache + carry CSP
idx=$(curl -sI http://localhost:8099/index.html)
echo "$idx" | grep -iq 'cache-control: no-cache' || { echo "FAIL: index.html not no-cache"; exit 1; }
echo "$idx" | grep -iq 'content-security-policy' || { echo "FAIL: missing CSP"; exit 1; }
echo "$idx" | grep -iq 'x-content-type-options: nosniff' || { echo "FAIL: missing nosniff"; exit 1; }

# a hashed asset must be immutable
asset=$(curl -s http://localhost:8099/index.html | grep -oE '\./[a-z]+\.[0-9a-f]{8}\.(js|css)' | head -1)
[ -n "$asset" ] || { echo "FAIL: no hashed asset ref in index.html"; exit 1; }
hdr=$(curl -sI "http://localhost:8099/${asset#./}")
echo "$hdr" | grep -iq 'cache-control: public, max-age=31536000, immutable' || { echo "FAIL: asset not immutable"; exit 1; }

# service worker must be no-cache
curl -sI http://localhost:8099/service-worker.js | grep -iq 'cache-control: no-cache' || { echo "FAIL: SW not no-cache"; exit 1; }

# stable-named ES module must be no-cache
curl -sI http://localhost:8099/src/dialogs.js | grep -qi 'cache-control: no-cache' || { echo "FAIL: /src/dialogs.js not no-cache"; exit 1; }
echo "SMOKE OK"
