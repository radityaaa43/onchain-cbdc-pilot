#!/usr/bin/env bash
# vote-add-validator.sh — run on org1 to add org2's Besu node as QBFT validator
#
# Usage:
#   bash scripts/vote-add-validator.sh --address 0xABC... [--besu-port 31545]
#
# Casts qbft_proposeValidatorVote on ALL current org1 validators.
# With 1 current validator (node1), 1 vote is enough.
# With N validators, need ceil((N+1)/2) votes — this script votes from all.

set -euo pipefail

VALIDATOR_ADDR=""
BESU_BASE_PORT=31545
NODE_COUNT=4

while [[ $# -gt 0 ]]; do
  case "$1" in
    --address)    VALIDATOR_ADDR="$2"; shift 2 ;;
    --besu-port)  BESU_BASE_PORT="$2"; shift 2 ;;
    --node-count) NODE_COUNT="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

if [[ -z "$VALIDATOR_ADDR" ]]; then
  echo "ERROR: --address is required (org2's validator address from join-chain.sh output)"
  echo "Usage: bash scripts/vote-add-validator.sh --address 0x..."
  exit 1
fi

echo ""
echo "Adding validator: $VALIDATOR_ADDR"
echo ""

# Get current validators
echo "Current QBFT validators:"
curl -sf -X POST "http://localhost:${BESU_BASE_PORT}" \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"qbft_getValidatorsByBlockNumber","params":["latest"],"id":1}' \
  | python3 -c "import sys,json; [print(f'  {v}') for v in json.load(sys.stdin).get('result',[])]"

# Check if already a validator
ALREADY=$(curl -sf -X POST "http://localhost:${BESU_BASE_PORT}" \
  -H 'Content-Type: application/json' \
  -d "{\"jsonrpc\":\"2.0\",\"method\":\"qbft_getValidatorsByBlockNumber\",\"params\":[\"latest\"],\"id\":1}" \
  | python3 -c "import sys,json; vs=json.load(sys.stdin).get('result',[]); print('yes' if '$VALIDATOR_ADDR'.lower() in [v.lower() for v in vs] else 'no')" 2>/dev/null || echo "no")

if [[ "$ALREADY" == "yes" ]]; then
  echo ""
  echo "$VALIDATOR_ADDR is already a validator. Nothing to do."
  exit 0
fi

echo ""
echo "Casting votes from all reachable org1 nodes..."
echo ""

VOTE_COUNT=0
for n in $(seq 1 "$NODE_COUNT"); do
  PORT=$((BESU_BASE_PORT + (n-1)*100))
  echo -n "  node$n (port $PORT): "
  RESULT=$(curl -sf --max-time 5 -X POST "http://localhost:$PORT" \
    -H 'Content-Type: application/json' \
    -d "{\"jsonrpc\":\"2.0\",\"method\":\"qbft_proposeValidatorVote\",\"params\":[\"$VALIDATOR_ADDR\", true],\"id\":1}" \
    2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print('OK' if d.get('result') else d.get('error',{}).get('message','FAIL'))" 2>/dev/null || echo "UNREACHABLE")
  echo "$RESULT"
  [[ "$RESULT" == "OK" ]] && VOTE_COUNT=$((VOTE_COUNT + 1))
done

echo ""
echo "Votes cast: $VOTE_COUNT"
echo ""
echo "Waiting for validator to appear in QBFT set (max 2 min)..."

for i in $(seq 1 24); do
  VALIDATORS=$(curl -sf --max-time 5 -X POST "http://localhost:${BESU_BASE_PORT}" \
    -H 'Content-Type: application/json' \
    -d '{"jsonrpc":"2.0","method":"qbft_getValidatorsByBlockNumber","params":["latest"],"id":1}' \
    2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('result',[]))" 2>/dev/null || echo "[]")

  IS_VALIDATOR=$(python3 -c "
vs = $VALIDATORS
target = '$VALIDATOR_ADDR'.lower()
print('yes' if any(v.lower() == target for v in vs) else 'no')
" 2>/dev/null || echo "no")

  if [[ "$IS_VALIDATOR" == "yes" ]]; then
    echo "  SUCCESS: $VALIDATOR_ADDR is now a QBFT validator!"
    echo ""
    echo "Active validators:"
    python3 -c "vs = $VALIDATORS; [print(f'  {v}') for v in vs]"
    echo ""
    echo "org2 is now a validator on org1's chain."
    exit 0
  fi

  echo "  [$i/24] not yet in validator set..."; sleep 5
done

echo ""
echo "WARNING: $VALIDATOR_ADDR not yet in validator set after 2 min."
echo "This can happen if:"
echo "  - Insufficient votes (need ceil((N+1)/2) of $VOTE_COUNT current validators)"
echo "  - org2's Besu is not yet fully synced"
echo "  - Network connectivity issue between org1 and org2"
echo ""
echo "Check current validators:"
echo "  curl -s -X POST http://localhost:${BESU_BASE_PORT} \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"jsonrpc\":\"2.0\",\"method\":\"qbft_getValidatorsByBlockNumber\",\"params\":[\"latest\"],\"id\":1}'"
