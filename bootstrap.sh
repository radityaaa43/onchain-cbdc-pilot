#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# onchain-cbdc-pilot bootstrap
# Usage: bash bootstrap.sh [--skip-contracts]
# Requires: kubectl, helm, git, python3+pyyaml, curl
# ─────────────────────────────────────────────────────────────────────────────

SKIP_CONTRACTS=false
for arg in "$@"; do
  case $arg in
    --skip-contracts) SKIP_CONTRACTS=true ;;
  esac
done

log() {
  echo ""
  echo "════════════════════════════════════════════════"
  echo "  $*"
  echo "════════════════════════════════════════════════"
}

wait_app_synced() {
  local app="$1"
  local timeout="${2:-300}"
  echo "Waiting for ArgoCD app '$app' (${timeout}s max)..."
  local end=$((SECONDS + timeout))
  while [[ $SECONDS -lt $end ]]; do
    STATUS=$(kubectl get application "$app" -n argocd \
      -o jsonpath='{.status.sync.status}' 2>/dev/null || echo "")
    HEALTH=$(kubectl get application "$app" -n argocd \
      -o jsonpath='{.status.health.status}' 2>/dev/null || echo "")
    if [[ "$STATUS" == "Synced" && "$HEALTH" == "Healthy" ]]; then
      echo "  '$app' Synced/Healthy"; return 0
    fi
    echo "  '$app' sync=$STATUS health=$HEALTH ..."; sleep 10
  done
  echo "  WARNING: '$app' not Synced/Healthy within ${timeout}s (continuing)"
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ─── Pre-flight ───────────────────────────────────────────────────────────────
log "PRE-FLIGHT: render config.yaml → derived manifests"
bash scripts/render.sh --write

git add -A
if ! git diff --cached --quiet; then
  git commit -m "chore: rendered manifests from config.yaml"
  git push origin HEAD 2>/dev/null || true
fi

ORG_NAME=$(python3 -c "import yaml; c=yaml.safe_load(open('config.yaml')); print(c['org']['name'])")
ORG_DOMAIN=$(python3 -c "import yaml; c=yaml.safe_load(open('config.yaml')); print(c['org']['domain'])")
NODE_COUNT=$(python3 -c "import yaml; c=yaml.safe_load(open('config.yaml')); print(c['besu'].get('nodeCount',1))")
BESU_BASE_PORT=$(python3 -c "import yaml; c=yaml.safe_load(open('config.yaml')); print(c['besu'].get('baseNodePort',31545))")
PALADIN_BASE_PORT=$(python3 -c "import yaml; c=yaml.safe_load(open('config.yaml')); print(c['paladin'].get('baseNodePort',31548))")

echo "Org: $ORG_NAME  Domain: $ORG_DOMAIN  Nodes: $NODE_COUNT"

# ─── STEP 1: cert-manager ─────────────────────────────────────────────────────
log "STEP 1: cert-manager"
helm repo add jetstack https://charts.jetstack.io --force-update 2>/dev/null
helm repo update jetstack 2>/dev/null
helm upgrade --install cert-manager jetstack/cert-manager \
  --namespace cert-manager --create-namespace \
  --version v1.16.3 --set crds.enabled=true \
  --wait --timeout 300s

kubectl wait deployment/cert-manager-webhook \
  --namespace cert-manager --for=condition=Available --timeout=120s

kubectl apply -f platform/cert-manager/cluster-issuers.yaml

# ─── STEP 2: traefik ──────────────────────────────────────────────────────────
log "STEP 2: traefik"
kubectl apply -f platform/traefik/traefik-config.yaml

# ─── STEP 3: ArgoCD ───────────────────────────────────────────────────────────
log "STEP 3: ArgoCD"
bash platform/argocd/install.sh
kubectl apply -f platform/argocd/root-app.yaml

# Prevent StatefulSet terminatingReplicas ComparisonError globally
kubectl patch configmap argocd-cm -n argocd --type merge \
  -p '{"data":{"resource.customizations":"apps/StatefulSet:\n  ignoreDifferences: |\n    jsonPointers:\n    - /status/terminatingReplicas\n"}}' \
  2>/dev/null || true

# ─── STEP 4: Vault ────────────────────────────────────────────────────────────
log "STEP 4: Vault — deploy and unseal"
kubectl apply -f secrets/vault/vault-app.yaml

echo "Waiting for vault pod (max 5 min)..."
for i in $(seq 1 60); do
  STATUS=$(kubectl get pod -n vault -l app.kubernetes.io/name=vault \
    --no-headers -o custom-columns=STATUS:.status.phase 2>/dev/null | head -1)
  if [[ "$STATUS" == "Running" ]]; then echo "  vault Running"; break; fi
  echo "  [$i/60] vault: ${STATUS:-pending}..."; sleep 5
done

bash secrets/vault/unseal-init.sh

kubectl wait pod --selector app.kubernetes.io/name=vault \
  --namespace vault --for=condition=Ready --timeout=120s 2>/dev/null || true

# ─── STEP 5: data layer ───────────────────────────────────────────────────────
log "STEP 5: data layer (postgres + minio)"
bash scripts/deploy-data.sh

# ─── STEP 6: kafka ────────────────────────────────────────────────────────────
log "STEP 6: kafka"
kubectl apply -f data/kafka/kafka-operator-app.yaml
wait_app_synced strimzi-kafka-operator 300

echo "Waiting for kafka namespace..."
for i in $(seq 1 30); do
  kubectl get namespace kafka &>/dev/null && echo "  kafka ns ready" && break
  echo "  [$i/30] waiting..."; sleep 5
done

kubectl wait deployment/strimzi-cluster-operator \
  --namespace kafka --for=condition=Available --timeout=300s

kubectl apply -f data/kafka/kafka-cluster-app.yaml

echo "Waiting for Kafka cluster Ready (max 10 min)..."
for i in $(seq 1 60); do
  READY=$(kubectl get kafka kafka -n kafka \
    -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null || echo "")
  if [[ "$READY" == "True" ]]; then echo "  Kafka Ready"; break; fi
  echo "  [$i/60] Kafka: ${READY:-pending}..."; sleep 10
done

kubectl wait deployment/kafka-entity-operator \
  --namespace kafka --for=condition=Available --timeout=120s 2>/dev/null || true

kubectl apply -f data/kafka/kafka-topics.yaml

# ─── STEP 7: chain (Besu QBFT + Paladin) ─────────────────────────────────────
log "STEP 7: chain — Besu QBFT + Paladin (nodeCount=${NODE_COUNT})"
kubectl apply -f chain/paladin-app.yaml

echo "Waiting for Besu pod (max 5 min)..."
for i in $(seq 1 30); do
  BESU_POD=$(kubectl get pod -n paladin -l app=besu --no-headers -o name 2>/dev/null | head -1 || true)
  [[ -n "$BESU_POD" ]] && break
  echo "  [$i/30] waiting for besu pod..."; sleep 10
done

echo "Waiting for Besu to produce blocks (max 5 min)..."
for i in $(seq 1 60); do
  BLOCK_HEX=$(curl -sf --max-time 3 -X POST "http://localhost:${BESU_BASE_PORT}" \
    -H 'Content-Type: application/json' \
    -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
    2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('result','0x0'))" 2>/dev/null || echo "0x0")
  BLOCK_NUM=$(python3 -c "print(int('$BLOCK_HEX', 16))" 2>/dev/null || echo 0)
  echo "  [$i/60] block: $BLOCK_NUM"
  [[ "$BLOCK_NUM" -gt 0 ]] && echo "  Besu producing blocks." && break
  sleep 5
done

# Apply additional node CRs for nodeCount > 1 (idempotent)
if [[ "$NODE_COUNT" -gt 1 ]]; then
  echo "Applying Besu+Paladin CRs for node2-${NODE_COUNT}..."
  kubectl apply -f chain/crds/nodes.yaml

  echo "Waiting for all Paladin nodes Ready (max 5 min)..."
  for i in $(seq 1 30); do
    READY_COUNT=$(kubectl get paladin -n paladin \
      -o jsonpath='{.items[*].status.phase}' 2>/dev/null | tr ' ' '\n' | grep -c "Ready" || echo 0)
    echo "  [$i/30] Paladin Ready: ${READY_COUNT}/${NODE_COUNT}"
    [[ "$READY_COUNT" -ge "$NODE_COUNT" ]] && break
    sleep 10
  done

  # Fix race: Paladin may crash if its Besu wasn't ready on first start
  for node in $(seq 2 "$NODE_COUNT"); do
    POD_STATE=$(kubectl get pod "paladin-node${node}-0" -n paladin \
      -o jsonpath='{.status.containerStatuses[?(@.name=="paladin")].state.waiting.reason}' 2>/dev/null || true)
    if [[ "$POD_STATE" == "CrashLoopBackOff" ]]; then
      echo "  Restarting paladin-node${node}-0 (CrashLoopBackOff — besu race)"
      kubectl delete pod "paladin-node${node}-0" -n paladin --grace-period=0 --force 2>/dev/null || true
    fi
  done
fi

# Verify Paladin node1 JSON-RPC reachable
echo "Verifying Paladin node1 JSON-RPC..."
for i in $(seq 1 12); do
  PALADIN_NODE=$(curl -sf --max-time 3 -X POST "http://localhost:${PALADIN_BASE_PORT}" \
    -H 'Content-Type: application/json' \
    -d '{"jsonrpc":"2.0","id":1,"method":"transport_nodeName","params":[]}' \
    2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('result',''))" 2>/dev/null || true)
  [[ -n "$PALADIN_NODE" ]] && echo "  Paladin node1 ready: $PALADIN_NODE" && break
  echo "  [$i/12] Paladin not ready yet..."; sleep 10
done

# ─── STEP 8: event bridge ─────────────────────────────────────────────────────
log "STEP 8: Event Bridge (Paladin → Kafka)"
kubectl apply -f event-bridge/event-bridge-app.yaml
kubectl wait deployment/cbdc-event-bridge \
  --namespace paladin --for=condition=Available --timeout=120s

# ─── STEP 9: monitoring ───────────────────────────────────────────────────────
log "STEP 9: monitoring (Prometheus + Loki)"
kubectl apply -f platform/argocd/apps/monitoring.yaml
kubectl apply -f platform/argocd/apps/loki.yaml

# ─── STEP 10: CBDC contracts ──────────────────────────────────────────────────
if [[ "$SKIP_CONTRACTS" == "false" ]]; then
  log "STEP 10: Deploy CBDC contracts (Pente)"
  if command -v node &>/dev/null && command -v npm &>/dev/null; then
    bash scripts/deploy-contracts.sh
  else
    echo "  SKIP: node/npm not installed. Run manually: bash scripts/deploy-contracts.sh"
  fi
else
  log "STEP 10: CBDC contracts — SKIPPED (--skip-contracts)"
fi

# ─── Done ─────────────────────────────────────────────────────────────────────
log "BOOTSTRAP COMPLETE"
echo ""
echo "  Org:   ${ORG_NAME}.${ORG_DOMAIN}"
echo "  Nodes: ${NODE_COUNT} Besu QBFT + ${NODE_COUNT} Paladin"
echo ""
echo "Endpoints (localhost NodePorts):"
for node in $(seq 1 "$NODE_COUNT"); do
  BPORT=$((BESU_BASE_PORT + (node - 1) * 100))
  PPORT=$((PALADIN_BASE_PORT + (node - 1) * 100))
  echo "  besu-node${node}:    http://localhost:${BPORT}  (eth JSON-RPC)"
  echo "  paladin-node${node}: http://localhost:${PPORT}  (paladin JSON-RPC)"
done
echo ""
echo "Kafka topics:  cbdc.tx.confirmed  cbdc.mint  cbdc.transfer  cbdc.audit"
echo ""
echo "All ArgoCD apps: kubectl get applications -n argocd"
echo ""
