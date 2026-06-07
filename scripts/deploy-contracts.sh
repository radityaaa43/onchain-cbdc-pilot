#!/usr/bin/env bash
# deploy-contracts.sh — Deploy CBDC+Bond contracts to Paladin Pente privacy group.
# Requires: node, npm, Paladin running at PALADIN_URL (default: localhost:31548)
#
# Usage:
#   bash scripts/deploy-contracts.sh
#   PALADIN_URL=http://localhost:31548 PENTE_FROM=cbdc-pilot@node1 bash scripts/deploy-contracts.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "$ROOT_DIR"

# Load config-derived vars if available
if [[ -f "${SCRIPT_DIR}/render.sh" ]]; then
  source "${SCRIPT_DIR}/render.sh" 2>/dev/null || true
fi

export PALADIN_URL="${PALADIN_URL:-http://localhost:${BESU_BASE_NODE_PORT:-31548}}"
export PENTE_FROM="${PENTE_FROM:-cbdc-pilot@node1}"
export ADMIN_ADDR="${ADMIN_ADDR:-0x75a99473917701038e854ef6999c76cd947c9f9e}"
export CHAIN_ID="${BESU_CHAIN_ID:-1337}"

echo "========================================"
echo "  Deploy CBDC Contracts → Pente"
echo "========================================"
echo "  Paladin:  $PALADIN_URL"
echo "  From:     $PENTE_FROM"
echo "  Admin:    $ADMIN_ADDR"
echo "  ChainId:  $CHAIN_ID"
echo ""

# Check Paladin reachable — Paladin is JSON-RPC only, no REST /api/v1/
PALADIN_NODE=$(curl -sf --max-time 5 -X POST "${PALADIN_URL}" \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"transport_nodeName","params":[]}' \
  2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('result','?'))" 2>/dev/null || true)
if [[ -z "$PALADIN_NODE" || "$PALADIN_NODE" == "?" ]]; then
  echo "ERROR: Paladin not reachable at ${PALADIN_URL}" >&2
  echo "       Wait for Besu+Paladin to be Ready, then retry." >&2
  exit 1
fi
echo "Paladin OK. Node: ${PALADIN_NODE}"

# Install paladin-sdk if not present
if [[ ! -d "${ROOT_DIR}/node_modules/@lfdecentralizedtrust/paladin-sdk" ]]; then
  echo "Installing @lfdecentralizedtrust/paladin-sdk..."
  npm install --save-dev "@lfdecentralizedtrust/paladin-sdk@^1.0.0-rc.10" 2>&1
fi

# Compile contracts if artifacts missing
if [[ ! -f "${ROOT_DIR}/artifacts/contracts/asset/cbdc/CBToken.sol/CBToken.json" ]]; then
  echo "Compiling contracts..."
  node_modules/.bin/hardhat compile
fi

# Run deploy script
echo ""
echo "Deploying contracts..."
node_modules/.bin/ts-node scripts/deploy-contracts.ts

echo ""
echo "Done. Contract addresses saved to .env.local"
