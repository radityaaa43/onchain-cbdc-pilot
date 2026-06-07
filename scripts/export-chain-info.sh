#!/usr/bin/env bash
# export-chain-info.sh — run on org1 to export chain info for org2 to join
#
# Usage:
#   bash scripts/export-chain-info.sh --host <org1-external-ip> > chain-info.json
#   bash scripts/export-chain-info.sh --host 10.0.0.1 --output chain-info.json
#
# Exports:
#   - genesis.json (exact content — org2 must use same genesis)
#   - Besu P2P enodes with real host:port (NodePorts)
#   - Contract addresses (noto-factory, pente-factory, evm-registry)
#   - Current QBFT validators
#   - Paladin node transport endpoints

set -euo pipefail

ORG1_HOST="localhost"
OUTPUT=""
BESU_BASE_PORT=31545
NODE_COUNT=4

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host)        ORG1_HOST="$2"; shift 2 ;;
    --output|-o)   OUTPUT="$2"; shift 2 ;;
    --besu-port)   BESU_BASE_PORT="$2"; shift 2 ;;
    --node-count)  NODE_COUNT="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

echo "Exporting chain info from org1 (host=$ORG1_HOST) ..." >&2

# Genesis
GENESIS_CM=$(kubectl get configmap besu-testnet-genesis -n paladin -o jsonpath='{.data.genesis\.json}' 2>/dev/null) || {
  echo "ERROR: ConfigMap besu-testnet-genesis not found in namespace paladin" >&2
  exit 1
}

# Enodes with actual NodePort P2P addresses
ENODES_JSON=$(python3 - <<PYEOF
import json, subprocess, sys

host = "$ORG1_HOST"
node_count = $NODE_COUNT
base = $BESU_BASE_PORT
enodes = []

for n in range(1, node_count + 1):
    rpc_port = base + (n - 1) * 100
    # Get enode from admin_nodeInfo
    try:
        result = subprocess.run(
            ["curl", "-sf", "--max-time", "5", "-X", "POST", f"http://localhost:{rpc_port}",
             "-H", "Content-Type: application/json",
             "-d", '{"jsonrpc":"2.0","method":"admin_nodeInfo","params":[],"id":1}'],
            capture_output=True, text=True, check=True
        )
        data = json.loads(result.stdout)
        enode = data["result"]["enode"]
    except Exception as e:
        print(f"WARN: could not get enode for node{n}: {e}", file=sys.stderr)
        continue

    # Get P2P NodePort
    try:
        result2 = subprocess.run(
            ["kubectl", "get", "svc", f"besu-node{n}", "-n", "paladin",
             "-o", "jsonpath={.spec.ports[?(@.name=='p2p-tcp')].nodePort}"],
            capture_output=True, text=True, check=True
        )
        p2p_nodeport = result2.stdout.strip()
    except Exception:
        p2p_nodeport = str(30303 + (n - 1) * 100)

    # Replace 0.0.0.0:30303 with real host:nodeport
    enode_fixed = enode.split("@")[0] + f"@{host}:{p2p_nodeport}"
    # Remove discport param if present
    enode_fixed = enode_fixed.split("?")[0]
    enodes.append(enode_fixed)

print(json.dumps(enodes))
PYEOF
)

# Contract addresses
NOTO_ADDR=$(kubectl get palaindomain.core.paladin.io noto -n paladin \
  -o jsonpath='{.status.registryAddress}' 2>/dev/null || echo "")
PENTE_ADDR=$(kubectl get palaindomain.core.paladin.io pente -n paladin \
  -o jsonpath='{.status.registryAddress}' 2>/dev/null || echo "")
REGISTRY_ADDR=$(kubectl get paladinregistry.core.paladin.io evm-registry -n paladin \
  -o jsonpath='{.status.contractAddress}' 2>/dev/null || echo "")

[[ -z "$NOTO_ADDR" ]]     && echo "WARN: noto registryAddress not found" >&2
[[ -z "$PENTE_ADDR" ]]    && echo "WARN: pente registryAddress not found" >&2
[[ -z "$REGISTRY_ADDR" ]] && echo "WARN: evm-registry contractAddress not found" >&2

# QBFT validators
VALIDATORS_JSON=$(curl -sf --max-time 5 -X POST "http://localhost:${BESU_BASE_PORT}" \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"qbft_getValidatorsByBlockNumber","params":["latest"],"id":1}' \
  2>/dev/null | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin).get('result',[])))" \
  2>/dev/null || echo "[]")

# Chain ID
CHAIN_ID=$(echo "$GENESIS_CM" | python3 -c "import sys,json; print(json.load(sys.stdin)['config']['chainId'])" 2>/dev/null || echo "1337")

# Paladin transport NodePorts
PALADIN_JSON=$(python3 - <<PYEOF
import json

host = "$ORG1_HOST"
node_count = $NODE_COUNT
base_port = 31548
nodes = {}
for n in range(1, node_count + 1):
    port = base_port + (n - 1) * 100
    nodes[f"node{n}"] = f"http://{host}:{port}"
print(json.dumps(nodes))
PYEOF
)

# Assemble final JSON
RESULT=$(python3 - <<PYEOF
import json

genesis = json.loads("""${GENESIS_CM}""") if False else None

# Read genesis as string (will be embedded as string, not parsed)
genesis_str = '''${GENESIS_CM}'''

out = {
    "chainId": $CHAIN_ID,
    "genesis": genesis_str,
    "enodes": $ENODES_JSON,
    "validators": $VALIDATORS_JSON,
    "contracts": {
        "notoFactory": "$NOTO_ADDR",
        "penteFactory": "$PENTE_ADDR",
        "evmRegistry": "$REGISTRY_ADDR"
    },
    "paladin": $PALADIN_JSON
}

print(json.dumps(out, indent=2))
PYEOF
)

if [[ -n "$OUTPUT" ]]; then
  echo "$RESULT" > "$OUTPUT"
  echo "Exported to $OUTPUT" >&2
else
  echo "$RESULT"
fi

echo "" >&2
echo "Transfer chain-info.json to org2's machine, then run:" >&2
echo "  bash scripts/join-chain.sh --chain-info chain-info.json --org1-ip $ORG1_HOST" >&2
