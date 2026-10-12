#!/usr/bin/env bash
# Smoke test of a deployed environment through CloudFront (S0-15, ADR-0004). Fails on the first
# broken expectation, naming it. Usage: scripts/smoke.sh https://<distribution>.cloudfront.net
set -euo pipefail

base="${1:?usage: smoke.sh <base URL>}"
base="${base%/}"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

fail() { echo "SMOKE FAIL: $*" >&2; exit 1; }
ok() { echo "ok: $*"; }

# fetch <name> <path>: writes $work/<name>.body and $work/<name>.headers (lower-cased), prints the status.
fetch() {
  curl -sS --max-time 20 -o "$work/$1.body" -D "$work/$1.raw" -w '%{http_code}' "$base$2"
  tr 'A-Z' 'a-z' < "$work/$1.raw" | tr -d '\r' > "$work/$1.headers"
}
header() { grep -m1 "^$2:" "$work/$1.headers" | cut -d' ' -f2- || true; }
expect_header() { # name header expected-substring (lower case)
  local v; v="$(header "$1" "$2")"
  [[ "$v" == *"$3"* ]] || fail "$1: header $2 is '${v}', expected it to contain '$3'"
}
security_headers() {
  expect_header "$1" strict-transport-security "max-age=31536000"
  expect_header "$1" x-content-type-options nosniff
  expect_header "$1" x-frame-options deny
  expect_header "$1" referrer-policy strict-origin-when-cross-origin
  expect_header "$1" content-security-policy "default-src 'self'"
}

status="$(fetch health /api/v1/healthz)"
[[ "$status" == 200 ]] || fail "GET /api/v1/healthz returned $status"
grep -q '"status":"ok"' "$work/health.body" || fail "healthz body is not {\"status\":\"ok\",...}: $(head -c 200 "$work/health.body")"
expect_header health content-type application/json
expect_header health cache-control no-store
security_headers health
ok "healthz 200 JSON ($(grep -o '"version":"[^"]*"' "$work/health.body"))"

status="$(fetch missing /api/v1/smoke-test-does-not-exist)"
if [[ "${AUTH_ENABLED:-false}" == true ]]; then
  [[ "$status" == 401 ]] || fail "unknown API path returned $status, expected 401 without a token"
  expect_header missing content-type application/json
  status="$(fetch profile /api/v1/me)"
  [[ "$status" == 401 ]] || fail "/me returned $status without a token"
  ok "protected routes reject requests without tokens"
else
  [[ "$status" == 404 ]] || fail "unknown API path returned $status, expected 404 (not index.html)"
  expect_header missing content-type application/problem+json
  ok "unknown API path is problem+json 404"
fi

status="$(fetch deeplink /schedules)"
[[ "$status" == 200 ]] || fail "SPA deep link /schedules returned $status"
expect_header deeplink content-type text/html
grep -q 'id="root"' "$work/deeplink.body" || fail "deep link did not return the SPA's index.html"
ok "SPA deep link serves index.html"

status="$(fetch index /)"
[[ "$status" == 200 ]] || fail "GET / returned $status"
expect_header index cache-control no-cache
security_headers index
ok "index.html is no-cache with security headers"

asset="$(grep -o '/assets/[^"]*\.js' "$work/index.body" | head -1 || true)"
[[ -n "$asset" ]] || fail "index.html references no /assets/*.js"
status="$(fetch asset "$asset")"
[[ "$status" == 200 ]] || fail "GET $asset returned $status"
expect_header asset cache-control immutable
ok "hashed asset $asset is immutable"

echo "Smoke test passed for $base"
