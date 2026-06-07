#!/usr/bin/env bash
set -euo pipefail

NS=${VAULT_NAMESPACE:-vault}
VAULT_ADDR_INTERNAL="http://127.0.0.1:8200"
KEYS_FILE="vault-keys.json"

echo "[vault] Looking for pod in namespace: $NS"
POD=$(kubectl get pods -l app.kubernetes.io/name=vault -n "$NS" \
  --no-headers -o custom-columns=":metadata.name" 2>/dev/null | head -1)

if [[ -z "$POD" ]]; then
  echo "[vault] ERROR: No vault pod found in namespace $NS" >&2
  exit 1
fi
echo "[vault] Pod: $POD"

# Check initialized state
INIT_STATUS=$(kubectl exec "$POD" -n "$NS" -- sh -c \
  "VAULT_ADDR=$VAULT_ADDR_INTERNAL vault status -format=json 2>/dev/null || echo '{}'" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(str(d.get('initialized','false')).lower())" 2>/dev/null || echo "false")

if [[ "$INIT_STATUS" != "true" ]]; then
  echo "[vault] Initializing (1 key share, threshold 1)..."
  kubectl exec "$POD" -n "$NS" -- sh -c \
    "VAULT_ADDR=$VAULT_ADDR_INTERNAL vault operator init -key-shares=1 -key-threshold=1 -format=json" \
    > "$KEYS_FILE"
  echo "[vault] Keys saved to $KEYS_FILE"
else
  echo "[vault] Already initialized. Using existing $KEYS_FILE"
  if [[ ! -f "$KEYS_FILE" ]]; then
    echo "[vault] ERROR: vault initialized but $KEYS_FILE missing — cannot unseal" >&2
    exit 1
  fi
fi

# Unseal if sealed
SEAL_STATUS=$(kubectl exec "$POD" -n "$NS" -- sh -c \
  "VAULT_ADDR=$VAULT_ADDR_INTERNAL vault status -format=json 2>/dev/null || echo '{}'" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(str(d.get('sealed','true')).lower())" 2>/dev/null || echo "true")

if [[ "$SEAL_STATUS" == "true" ]]; then
  UNSEAL_KEY=$(python3 -c "import json; d=json.load(open('$KEYS_FILE')); print(d['unseal_keys_b64'][0])")
  echo "[vault] Unsealing..."
  kubectl exec "$POD" -n "$NS" -- sh -c \
    "VAULT_ADDR=$VAULT_ADDR_INTERNAL vault operator unseal $UNSEAL_KEY"
  echo "[vault] Unsealed."
else
  echo "[vault] Already unsealed."
fi

ROOT_TOKEN=$(python3 -c "import json; print(json.load(open('$KEYS_FILE'))['root_token'])")
echo ""
echo "[vault] Ready. Root token: ${ROOT_TOKEN:0:8}..."
echo "  VAULT_TOKEN=$ROOT_TOKEN"
