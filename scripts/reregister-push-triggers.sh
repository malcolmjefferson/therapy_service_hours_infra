#!/usr/bin/env bash
# Re-registers the pipeline's GitHub push triggers (runbook §4). Needed when the pipeline was
# created while its CodeConnections connection was still PENDING: Release change works, but merges
# to main start no run. Saving the pipeline unchanged is a no-op, so this makes two real updates:
# first without the push triggers, then with the exact current definition again. The end state is
# identical to what CDK deployed, so there is no drift.
# Usage (Git Bash, after aws login): scripts/reregister-push-triggers.sh
set -euo pipefail
cd "$(dirname "$0")/.."

name="${PIPELINE_NAME:-therapy-service-hours}"
region="${AWS_REGION:-us-west-2}"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

aws codepipeline get-pipeline --region "$region" --name "$name" --query pipeline --output json > "$work/current.json"
node scripts/push-triggers.mjs without "$work/current.json" > "$work/without.json"
node scripts/push-triggers.mjs restore "$work/current.json" > "$work/restore.json"
node scripts/push-triggers.mjs check "$work/current.json"

echo "1/2: removing the push triggers from $name"
aws codepipeline update-pipeline --region "$region" --pipeline "file://$work/without.json" --query pipeline.version --output text
echo "2/2: restoring the original definition (re-registers the triggers)"
aws codepipeline update-pipeline --region "$region" --pipeline "file://$work/restore.json" --query pipeline.version --output text
echo "Done. The next merge to main in any of the three repos should start a run (trigger type WebhookV2)."
