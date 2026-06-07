#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

source "${SCRIPT_DIR}/render.sh"

echo "================================================"
echo " Deploy Data Layer (CBDC Pilot)"
echo "================================================"

# Postgres secret
bash "${ROOT_DIR}/data/postgres/create-secret.sh"

# MinIO secret
bash "${ROOT_DIR}/data/minio/create-secret.sh"

# Helm repos
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo add minio https://charts.min.io
helm repo update

# Postgres (Paladin operational DB)
helm upgrade --install postgres bitnami/postgresql \
  --namespace database \
  --create-namespace \
  --values "${ROOT_DIR}/data/postgres/postgres-values.yaml" \
  --wait --timeout 300s

# MinIO (off-chain encrypted document storage)
# Clean up stuck post-job from any prior failed upgrade
kubectl delete job minio-post-job -n minio --ignore-not-found=true 2>/dev/null || true
# Rollback failed release so upgrade can proceed cleanly
if helm status minio -n minio 2>/dev/null | grep -q "STATUS: failed"; then
  helm rollback minio -n minio 2>/dev/null || true
fi
helm upgrade --install minio minio/minio \
  --namespace minio \
  --create-namespace \
  --values "${ROOT_DIR}/data/minio/minio-values.yaml" \
  --wait --timeout 300s

echo "Data layer ready (postgres + minio)"
