#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "[+] Running unit tests before deployment..."
python3 -m unittest discover -s "${SCRIPT_DIR}/tests" -v

echo "[+] Deploying get-churn-intelligence Cloud Function (Gen 2)..."
CLOUDSDK_METRICS_ENVIRONMENT="${CLOUDSDK_METRICS_ENVIRONMENT:+$CLOUDSDK_METRICS_ENVIRONMENT }datacloud.antigravity" \
  gcloud functions deploy get-churn-intelligence \
  --gen2 \
  --region=us-central1 \
  --runtime=python311 \
  --source="${SCRIPT_DIR}/agent_platform_tool" \
  --entry-point=get_churn_intelligence \
  --trigger-http \
  --allow-unauthenticated \
  --quiet
