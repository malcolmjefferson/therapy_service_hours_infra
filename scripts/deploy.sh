#!/usr/bin/env bash
# Manual deploy guard (until the pipeline, S0-14, does all deploys).
# Refuses to deploy anything but a clean checkout of origin/main, so work-in-progress branches can
# never reach an environment. Usage, from a dedicated deploy checkout:
#   EXPECTED_AWS_ACCOUNT=<account> BACKEND_DIST=<backend build> scripts/deploy.sh dev/Data
set -euo pipefail
cd "$(dirname "$0")/.."

[[ $# -ge 1 ]] || { echo "usage: scripts/deploy.sh <stack path, e.g. dev/Data> [cdk options]" >&2; exit 2; }
[[ -n "${EXPECTED_AWS_ACCOUNT:-}" ]] || { echo "EXPECTED_AWS_ACCOUNT is not set." >&2; exit 1; }
[[ -n "${BACKEND_DIST:-}" && -f "${BACKEND_DIST}/VERSION" ]] || { echo "BACKEND_DIST must point at a backend build with a VERSION file." >&2; exit 1; }

git fetch --quiet origin main
if [[ -n "$(git status --porcelain)" ]]; then
  echo "Refusing to deploy: the checkout has uncommitted changes." >&2; git status --short >&2; exit 1
fi
head="$(git rev-parse HEAD)"; main="$(git rev-parse origin/main)"
if [[ "$head" != "$main" ]]; then
  echo "Refusing to deploy: HEAD is $head, but origin/main is $main." >&2
  echo "Run: git checkout --detach origin/main && npm ci" >&2
  exit 1
fi

echo "Deploying infra $main with backend $(cat "$BACKEND_DIST/VERSION")"
npx cdk deploy "$@" --exclusively
