#!/usr/bin/env bash
# join-chain.sh — run on org2's cluster to join org1's Besu chain as a validator
#
# Usage:
#   bash scripts/join-chain.sh \
#     --chain-info chain-info.json \
#     --org1-ip <org1-host-ip> \
#     --node-name org2 \
#     --besu-nodeport 31545 \
#     --paladin-nodeport 31548
#
# What this does:
#   1. Deploys a Besu node on this cluster using org1's genesis (same chain)
#   2. Configures static-nodes to peer with org1's validators
#   3. Waits for Besu to sync
#   4. Installs paladin-operator (operator-only, no devnet chain creation)
#   5. Deploys Paladin CR pointing to org2's Besu via endpoint
#   6. Creates PaladinDomain/Registry CRs using org1's deployed contract addresses
#   7. Outputs org2's validator address for org1 to vote

set -euo pipefail

CHAIN_INFO=""
ORG1_IP=""
NODE_NAME="org2"
BESU_NODEPORT=31545
PALADIN_NODEPORT=31548
PALADIN_WS_NODEPORT=31549
NAMESPACE="paladin"
OPERATOR_VERSION="0.15.0"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --chain-info)        CHAIN_INFO="$2"; shift 2 ;;
    --org1-ip)           ORG1_IP="$2"; shift 2 ;;
    --node-name)         NODE_NAME="$2"; shift 2 ;;
    --besu-nodeport)     BESU_NODEPORT="$2"; shift 2 ;;
    --paladin-nodeport)  PALADIN_NODEPORT="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

PALADIN_WS_NODEPORT=$((PALADIN_NODEPORT + 1))

if [[ -z "$CHAIN_INFO" ]]; then
  echo "ERROR: --chain-info is required"
  echo "Usage: bash scripts/join-chain.sh --chain-info chain-info.json --org1-ip <ip>"
  exit 1
fi
if [[ ! -f "$CHAIN_INFO" ]]; then
  echo "ERROR: chain-info file not found: $CHAIN_INFO"
  exit 1
fi

log() {
  echo ""
  echo "════════════════════════════════════════════════"
  echo "  $*"
  echo "════════════════════════════════════════════════"
}

# Parse chain-info.json
CHAIN_ID=$(python3 -c "import json; d=json.load(open('$CHAIN_INFO')); print(d['chainId'])")
GENESIS_JSON=$(python3 -c "import json; d=json.load(open('$CHAIN_INFO')); print(d['genesis'])")
NOTO_ADDR=$(python3 -c "import json; d=json.load(open('$CHAIN_INFO')); print(d['contracts']['notoFactory'])")
PENTE_ADDR=$(python3 -c "import json; d=json.load(open('$CHAIN_INFO')); print(d['contracts']['penteFactory'])")
REGISTRY_ADDR=$(python3 -c "import json; d=json.load(open('$CHAIN_INFO')); print(d['contracts']['evmRegistry'])")

echo "Chain ID: $CHAIN_ID"
echo "Noto factory: $NOTO_ADDR"
echo "Pente factory: $PENTE_ADDR"
echo "EVM registry: $REGISTRY_ADDR"

# Build static-nodes.json from chain-info enodes
STATIC_NODES_JSON=$(python3 - <<PYEOF
import json, sys

with open("$CHAIN_INFO") as f:
    d = json.load(f)

enodes = d.get("enodes", [])
override_ip = "$ORG1_IP"

if override_ip:
    fixed = []
    for e in enodes:
        # Replace host part: enode://PUBKEY@HOST:PORT
        parts = e.split("@")
        if len(parts) == 2:
            host_port = parts[1]
            port = host_port.split(":")[1]
            fixed.append(f"{parts[0]}@{override_ip}:{port}")
        else:
            fixed.append(e)
    enodes = fixed

print(json.dumps(enodes, indent=2))
PYEOF
)

echo "Static nodes for org2's Besu:"
echo "$STATIC_NODES_JSON"

# ─── STEP 1: Create namespace ────────────────────────────────────────────────
log "STEP 1: Create namespace $NAMESPACE"
kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

# ─── STEP 2: Deploy Besu (manual StatefulSet — joins org1's chain) ──────────
log "STEP 2: Deploy Besu node ($NODE_NAME) with org1's genesis"

BESU_NAME="besu-${NODE_NAME}"

# Genesis ConfigMap
kubectl apply -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: ${BESU_NAME}-genesis
  namespace: $NAMESPACE
  labels:
    app: besu
    app.kubernetes.io/name: $BESU_NAME
data:
  genesis.json: |
$(echo "$GENESIS_JSON" | sed 's/^/    /')
EOF

# Besu config ConfigMap (toml + static-nodes)
kubectl apply -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: $BESU_NAME
  namespace: $NAMESPACE
  labels:
    app: besu
    app.kubernetes.io/name: $BESU_NAME
data:
  pldconf.besu.toml: |
    Xdns-enabled = true
    Xdns-update-enabled = true
    data-path = '/data'
    discovery-enabled = false
    genesis-file = '/genesis/genesis.json'
    graphql-http-enabled = true
    graphql-http-host = '0.0.0.0'
    graphql-http-port = '8547'
    host-allowlist = ['*']
    logging = 'INFO'
    min-gas-price = 0
    p2p-host = '0.0.0.0'
    p2p-port = '30303'
    revert-reason-enabled = true
    rpc-http-api = ['ETH', 'NET', 'QBFT', 'WEB3', 'ADMIN', 'DEBUG', 'TXPOOL']
    rpc-http-enabled = true
    rpc-http-host = '0.0.0.0'
    rpc-http-port = '8545'
    rpc-ws-api = ['ETH', 'NET', 'QBFT', 'WEB3', 'ADMIN', 'DEBUG', 'TXPOOL']
    rpc-ws-enabled = true
    rpc-ws-host = '0.0.0.0'
    rpc-ws-port = '8546'
    static-nodes-file = '/config/static-nodes.json'
    tx-pool = 'SEQUENCED'
    tx-pool-limit-by-account-percentage = 1.0
  static-nodes.json: |
$(echo "$STATIC_NODES_JSON" | sed 's/^/    /')
EOF

# Besu StatefulSet (no node key Secret — Besu auto-generates key in /data)
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: ${BESU_NAME}-0
  namespace: $NAMESPACE
  labels:
    app: besu
    app.kubernetes.io/name: $BESU_NAME
    app.kubernetes.io/instance: $NODE_NAME
    app.kubernetes.io/part-of: paladin
spec:
  replicas: 1
  selector:
    matchLabels:
      app: besu
      app.kubernetes.io/name: $BESU_NAME
  serviceName: ""
  template:
    metadata:
      labels:
        app: besu
        app.kubernetes.io/name: $BESU_NAME
        app.kubernetes.io/instance: $NODE_NAME
        app.kubernetes.io/part-of: paladin
    spec:
      containers:
      - name: besu
        image: hyperledger/besu:latest
        imagePullPolicy: IfNotPresent
        args:
        - --config-file
        - /config/pldconf.besu.toml
        ports:
        - containerPort: 8545
          name: rpc-http
          protocol: TCP
        - containerPort: 8546
          name: rpc-ws
          protocol: TCP
        - containerPort: 8547
          name: graphql-http
          protocol: TCP
        - containerPort: 30303
          name: p2p-tcp
          protocol: TCP
        - containerPort: 30303
          name: p2p-udp
          protocol: UDP
        readinessProbe:
          tcpSocket:
            port: 8545
          initialDelaySeconds: 10
          periodSeconds: 5
        livenessProbe:
          exec:
            command: [sh, -c, pidof java]
          initialDelaySeconds: 3
          periodSeconds: 2
        volumeMounts:
        - name: config
          mountPath: /config
          readOnly: true
        - name: genesis
          mountPath: /genesis
          readOnly: true
        - name: data
          mountPath: /data
      volumes:
      - name: config
        configMap:
          name: $BESU_NAME
      - name: genesis
        configMap:
          name: ${BESU_NAME}-genesis
      - name: data
        persistentVolumeClaim:
          claimName: ${BESU_NAME}-data
  volumeClaimTemplates: []
EOF

# Besu PVC
kubectl apply -f - <<EOF
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: ${BESU_NAME}-data
  namespace: $NAMESPACE
spec:
  accessModes: [ReadWriteOnce]
  resources:
    requests:
      storage: 20Gi
EOF

# Besu Service (NodePort)
kubectl apply -f - <<EOF
apiVersion: v1
kind: Service
metadata:
  name: $BESU_NAME
  namespace: $NAMESPACE
  labels:
    app: besu
    app.kubernetes.io/name: $BESU_NAME
    app.kubernetes.io/instance: $NODE_NAME
    app.kubernetes.io/part-of: paladin
spec:
  type: NodePort
  selector:
    app: besu
    app.kubernetes.io/name: $BESU_NAME
  ports:
  - name: rpc-http
    port: 8545
    targetPort: 8545
    nodePort: $BESU_NODEPORT
    protocol: TCP
  - name: rpc-ws
    port: 8546
    targetPort: 8546
    nodePort: $((BESU_NODEPORT + 1))
    protocol: TCP
  - name: graphql-http
    port: 8547
    targetPort: 8547
    nodePort: $((BESU_NODEPORT + 2))
    protocol: TCP
  - name: p2p-tcp
    port: 30303
    targetPort: 30303
    nodePort: $((BESU_NODEPORT + 3))
    protocol: TCP
  - name: p2p-udp
    port: 30303
    targetPort: 30303
    nodePort: $((BESU_NODEPORT + 3))
    protocol: UDP
EOF

# ─── STEP 3: Wait for Besu to connect and sync ───────────────────────────────
log "STEP 3: Wait for Besu to sync with org1's chain"

echo "Waiting for Besu pod to start (max 5 min)..."
for i in $(seq 1 60); do
  PHASE=$(kubectl get pod -n "$NAMESPACE" -l "app.kubernetes.io/name=${BESU_NAME}" \
    --no-headers -o custom-columns=STATUS:.status.phase 2>/dev/null | head -1 || true)
  [[ "$PHASE" == "Running" ]] && echo "  Besu pod Running" && break
  echo "  [$i/60] pod: ${PHASE:-pending}..."; sleep 5
done

echo "Waiting for Besu to sync blocks from org1 (max 5 min)..."
for i in $(seq 1 60); do
  BLOCK_HEX=$(curl -sf --max-time 3 -X POST "http://localhost:${BESU_NODEPORT}" \
    -H 'Content-Type: application/json' \
    -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
    2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('result','0x0'))" 2>/dev/null || echo "0x0")
  BLOCK_NUM=$(python3 -c "print(int('$BLOCK_HEX', 16))" 2>/dev/null || echo 0)
  PEERS=$(curl -sf --max-time 3 -X POST "http://localhost:${BESU_NODEPORT}" \
    -H 'Content-Type: application/json' \
    -d '{"jsonrpc":"2.0","method":"net_peerCount","params":[],"id":1}' \
    2>/dev/null | python3 -c "import sys,json; print(int(json.load(sys.stdin).get('result','0x0'),16))" 2>/dev/null || echo 0)
  echo "  [$i/60] block=$BLOCK_NUM peers=$PEERS"
  [[ "$BLOCK_NUM" -gt 0 && "$PEERS" -gt 0 ]] && echo "  Besu synced." && break
  sleep 5
done

# Get org2's Besu node info (enode + address)
echo ""
echo "Getting org2 Besu node info..."
NODE_INFO=$(curl -sf --max-time 5 -X POST "http://localhost:${BESU_NODEPORT}" \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"admin_nodeInfo","params":[],"id":1}' 2>/dev/null || echo "{}")

ORG2_ENODE=$(echo "$NODE_INFO" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('result',{}).get('enode',''))" 2>/dev/null || echo "")
ORG2_NODE_ID=$(echo "$ORG2_ENODE" | sed 's/enode:\/\///' | cut -d@ -f1)

echo "  org2 enode: $ORG2_ENODE"
echo "  org2 node ID (pubkey): $ORG2_NODE_ID"

# Derive Ethereum address from node ID (keccak256 of pubkey)
ORG2_VALIDATOR_ADDR=$(python3 - <<PYEOF 2>/dev/null || echo "")
import sys

node_id = "$ORG2_NODE_ID"
if not node_id:
    sys.exit(0)

try:
    from eth_hash.auto import keccak
    pubkey_bytes = bytes.fromhex(node_id)
    addr = "0x" + keccak(pubkey_bytes).hex()[24:]
    print(addr)
except ImportError:
    try:
        from Crypto.Hash import keccak as _keccak
        pubkey_bytes = bytes.fromhex(node_id)
        k = _keccak.new(digest_bits=256)
        k.update(pubkey_bytes)
        addr = "0x" + k.hexdigest()[24:]
        print(addr)
    except ImportError:
        # fallback: cannot compute without keccak lib
        pass
PYEOF

if [[ -z "$ORG2_VALIDATOR_ADDR" ]]; then
  echo ""
  echo "  NOTE: keccak library not available for address derivation."
  echo "  Org2 validator address must be computed from node ID:"
  echo "    node_id = $ORG2_NODE_ID"
  echo "  Run on any machine with eth_hash/web3:"
  echo "    python3 -c \"from eth_hash.auto import keccak; print('0x' + keccak(bytes.fromhex('$ORG2_NODE_ID')).hex()[24:])\""
  ORG2_VALIDATOR_ADDR="<compute-from-node-id-above>"
fi

# ─── STEP 4: Install paladin-operator (operator-only, no devnet chain) ───────
log "STEP 4: Install paladin-operator (mode: none — operator only)"

helm repo add lfdt-paladin https://lfdt-paladin.github.io/paladin --force-update 2>/dev/null
helm repo update lfdt-paladin 2>/dev/null

helm upgrade --install paladin-operator lfdt-paladin/paladin-operator \
  --namespace "$NAMESPACE" \
  --version "$OPERATOR_VERSION" \
  --set mode="" \
  --set installCRDs=true \
  --set operator.nodeSelector."kubernetes\\.io/arch"=amd64 \
  --wait --timeout 120s

kubectl wait deployment/paladin-operator \
  --namespace "$NAMESPACE" --for=condition=Available --timeout=120s

# ─── STEP 5: Create PaladinDomain CRs (org1's contract addresses) ────────────
log "STEP 5: Create PaladinDomain CRs (using org1's deployed contracts)"

kubectl apply -f - <<EOF
apiVersion: core.paladin.io/v1alpha1
kind: PaladinDomain
metadata:
  name: noto
  namespace: $NAMESPACE
  labels:
    paladin.io/domain-name: noto
spec:
  plugin:
    library: /app/domains/libnoto.so
    type: c-shared
  configJSON: |
    {
      "factoryVersion": 1
    }
  registryAddress: "$NOTO_ADDR"
---
apiVersion: core.paladin.io/v1alpha1
kind: PaladinDomain
metadata:
  name: pente
  namespace: $NAMESPACE
  labels:
    paladin.io/domain-name: pente
spec:
  plugin:
    class: io.kaleido.paladin.pente.domain.PenteDomainFactory
    library: /app/domains/pente.jar
    type: jar
  configJSON: |
    {}
  registryAddress: "$PENTE_ADDR"
EOF

# ─── STEP 6: Create PaladinRegistry CR (org1's evm-registry contract) ────────
log "STEP 6: Create PaladinRegistry CR (org1's evm-registry)"

kubectl apply -f - <<EOF
apiVersion: core.paladin.io/v1alpha1
kind: PaladinRegistry
metadata:
  name: evm-registry
  namespace: $NAMESPACE
  labels:
    paladin.io/registry-name: evm-registry
spec:
  type: evm
  plugin:
    library: /app/registries/libevm.so
    type: c-shared
  configJSON: |
    {}
  evm:
    contractAddress: "$REGISTRY_ADDR"
    smartContractDeployment: ""
  transports:
    enabled: true
EOF

# ─── STEP 7: Create Paladin CR (endpoint type → org2's Besu via svc URL) ────
log "STEP 7: Create Paladin CR for $NODE_NAME (endpoint → besu-${NODE_NAME})"

PALADIN_NAME="${NODE_NAME}-node"
BESU_SVC_URL="http://${BESU_NAME}.${NAMESPACE}.svc:8545"
BESU_WS_URL="ws://${BESU_NAME}.${NAMESPACE}.svc:8546"

kubectl apply -f - <<EOF
apiVersion: core.paladin.io/v1alpha1
kind: Paladin
metadata:
  name: $PALADIN_NAME
  namespace: $NAMESPACE
  labels:
    app.kubernetes.io/name: $PALADIN_NAME
    app.kubernetes.io/instance: $NODE_NAME
    app.kubernetes.io/part-of: paladin
    app: paladin
spec:
  baseLedgerEndpoint:
    type: endpoint
    endpoint:
      jsonrpc: "$BESU_SVC_URL"
      ws: "$BESU_WS_URL"
  config: |
    log:
      level: info
    publicTxManager:
      gasLimit:
        gasEstimateFactor: 2.0
  database:
    migrationMode: auto
    mode: sidecarPostgres
  domains:
  - labelSelector:
      matchLabels:
        paladin.io/domain-name: noto
  - labelSelector:
      matchLabels:
        paladin.io/domain-name: pente
  registries:
  - labelSelector:
      matchLabels:
        paladin.io/registry-name: evm-registry
  secretBackedSigners:
  - name: signer-1
    type: autoHDWallet
    derivationType: bip32
    keySelector: .*
    secret: ${PALADIN_NAME}.keys
  service:
    type: NodePort
    ports:
    - name: rpc-http
      port: 8548
      nodePort: $PALADIN_NODEPORT
      protocol: TCP
    - name: rpc-ws
      port: 8549
      nodePort: $PALADIN_WS_NODEPORT
      protocol: TCP
  transports:
  - name: grpc
    plugin:
      library: /app/transports/libgrpc.so
      type: c-shared
    configJSON: |
      {
        "port": 9000,
        "address": "0.0.0.0"
      }
    ports:
    - name: transport-grpc
      port: 9000
      protocol: TCP
      targetPort: 9000
    tls:
      certName: paladin-${PALADIN_NAME}-mtls
      issuer: selfsigned-issuer
      secretName: paladin-${PALADIN_NAME}-mtls
EOF

# ─── STEP 8: Wait for Paladin to be ready ────────────────────────────────────
log "STEP 8: Wait for Paladin $PALADIN_NAME to be Ready"

for i in $(seq 1 36); do
  PHASE=$(kubectl get paladin "$PALADIN_NAME" -n "$NAMESPACE" \
    -o jsonpath='{.status.phase}' 2>/dev/null || echo "")
  echo "  [$i/36] Paladin phase: ${PHASE:-unknown}..."
  [[ "$PHASE" == "Ready" ]] && break
  sleep 10
done

PALADIN_NAME_CHECK=$(curl -sf --max-time 5 -X POST "http://localhost:${PALADIN_NODEPORT}" \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"transport_nodeName","params":[]}' \
  2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('result',''))" 2>/dev/null || echo "")

echo "  Paladin node name: ${PALADIN_NAME_CHECK:-not ready yet}"

# ─── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════"
echo "  JOIN CHAIN COMPLETE — $NODE_NAME"
echo "════════════════════════════════════════════════"
echo ""
echo "org2 Besu is syncing org1's chain (chainId=$CHAIN_ID)"
echo ""
echo "org2 validator address: $ORG2_VALIDATOR_ADDR"
echo "org2 enode:             $ORG2_ENODE"
echo ""
echo "NEXT STEP — on org1's machine, run:"
echo "  bash scripts/vote-add-validator.sh --address $ORG2_VALIDATOR_ADDR"
echo ""
echo "After vote succeeds, org2 will produce blocks as a QBFT validator."
echo ""
