#!/usr/bin/env bash
set -euo pipefail

NAMESPACE=minio
SECRET_NAME=minio-credentials

kubectl get namespace "$NAMESPACE" >/dev/null 2>&1 || kubectl create namespace "$NAMESPACE"

if [[ -z "${MINIO_ROOT_PASSWORD:-}" ]]; then
  MINIO_ROOT_PASSWORD="$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 24)"
fi
export MINIO_ROOT_PASSWORD

kubectl create secret generic "$SECRET_NAME" \
  --namespace "$NAMESPACE" \
  --from-literal=rootUser=minioadmin \
  --from-literal=rootPassword="$MINIO_ROOT_PASSWORD" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD}" >> .env.local
echo "MinIO secret '${SECRET_NAME}' applied in namespace '${NAMESPACE}'."
echo "Console: kubectl port-forward svc/minio 9001:9001 -n minio"
