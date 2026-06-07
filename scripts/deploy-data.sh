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
# Skip upgrade if pod already running — post-upgrade hook is broken on this chart version
MINIO_READY=$(kubectl get pods -n minio -l release=minio \
  --no-headers -o custom-columns=STATUS:.status.phase 2>/dev/null | head -1)
if [[ "$MINIO_READY" == "Running" ]]; then
  echo "MinIO pod already Running — skipping helm upgrade"
else
  kubectl create namespace minio --dry-run=client -o yaml | kubectl apply -f -
  helm upgrade --install minio minio/minio \
    --namespace minio \
    --values "${ROOT_DIR}/data/minio/minio-values.yaml" \
    --wait --timeout 300s
fi

echo "Data layer ready (postgres + minio)"
