#!/usr/bin/env bash
# new-org.sh — clone this repo and configure it for a new org (separate cluster)
#
# Usage:
#   bash scripts/new-org.sh --name <org-name> [options]
#
# Options:
#   --name <name>          org name (required, e.g. org2)
#   --domain <domain>      ingress domain (default: <name>.cluster.local)
#   --email <email>        ACME/contact email (default: admin@<name>.example)
#   --dir <path>           destination dir (default: ~/italog/<name>)
#   --chain-id <n>         besu chainId (default: same as source 1337)
#   --besu-port <n>        besu baseNodePort (default: 31545 — OK on separate cluster)
#   --paladin-port <n>     paladin baseNodePort (default: 31548 — OK on separate cluster)
#   --node-count <n>       number of Besu+Paladin nodes (default: 4)
#
# On separate clusters (each org = own k3s), same NodePorts are fine.
# On same host: offset ports per org, e.g. org2: --besu-port 31845 --paladin-port 31848

set -euo pipefail

ORG_NAME=""
ORG_DOMAIN=""
ORG_EMAIL=""
DEST_DIR=""
CHAIN_ID=""
BESU_PORT=""
PALADIN_PORT=""
NODE_COUNT=""
CHAIN_INFO_FILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --name)         ORG_NAME="$2"; shift 2 ;;
    --domain)       ORG_DOMAIN="$2"; shift 2 ;;
    --email)        ORG_EMAIL="$2"; shift 2 ;;
    --dir)          DEST_DIR="$2"; shift 2 ;;
    --chain-id)     CHAIN_ID="$2"; shift 2 ;;
    --besu-port)    BESU_PORT="$2"; shift 2 ;;
    --paladin-port) PALADIN_PORT="$2"; shift 2 ;;
    --node-count)   NODE_COUNT="$2"; shift 2 ;;
    --chain-info)   CHAIN_INFO_FILE="$2"; shift 2 ;;  # join org1's chain as validator
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

if [[ -z "$ORG_NAME" ]]; then
  echo "ERROR: --name is required"
  echo "Usage: bash scripts/new-org.sh --name <org-name> [options]"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SOURCE_REMOTE="$(git -C "$SOURCE_DIR" remote get-url origin 2>/dev/null || true)"

ORG_DOMAIN="${ORG_DOMAIN:-${ORG_NAME}.cluster.local}"
ORG_EMAIL="${ORG_EMAIL:-admin@${ORG_NAME}.example}"
DEST_DIR="${DEST_DIR:-$HOME/italog/$ORG_NAME}"

echo ""
echo "════════════════════════════════════════════════"
echo "  New org: $ORG_NAME"
echo "  Domain:  $ORG_DOMAIN"
echo "  Dest:    $DEST_DIR"
echo "  Source:  $SOURCE_REMOTE (if available, else local copy)"
echo "════════════════════════════════════════════════"
echo ""

if [[ -d "$DEST_DIR" ]]; then
  echo "ERROR: destination already exists: $DEST_DIR"
  echo "Remove it first or use --dir to choose a different path."
  exit 1
fi

# Clone: prefer git clone from remote, fall back to local copy
if [[ -n "$SOURCE_REMOTE" ]]; then
  echo "Cloning from $SOURCE_REMOTE ..."
  git clone "$SOURCE_REMOTE" "$DEST_DIR"
else
  echo "No remote configured — copying from $SOURCE_DIR ..."
  cp -r "$SOURCE_DIR" "$DEST_DIR"
  git -C "$DEST_DIR" remote remove origin 2>/dev/null || true
fi

echo ""
echo "Patching config.yaml for $ORG_NAME ..."

python3 - "$DEST_DIR/config.yaml" "$ORG_NAME" "$ORG_DOMAIN" "$ORG_EMAIL" \
  "${CHAIN_ID:-}" "${BESU_PORT:-}" "${PALADIN_PORT:-}" "${NODE_COUNT:-}" <<'PYEOF'
import sys, yaml

config_path = sys.argv[1]
org_name    = sys.argv[2]
org_domain  = sys.argv[3]
org_email   = sys.argv[4]
chain_id    = sys.argv[5]
besu_port   = sys.argv[6]
paladin_port = sys.argv[7]
node_count  = sys.argv[8]

with open(config_path) as f:
    c = yaml.safe_load(f)

c["org"]["name"]   = org_name
c["org"]["domain"] = org_domain
c["org"]["email"]  = org_email

if chain_id:
    c["besu"]["chainId"] = int(chain_id)
if besu_port:
    c["besu"]["baseNodePort"] = int(besu_port)
if paladin_port:
    c["paladin"]["baseNodePort"] = int(paladin_port)
if node_count:
    c["besu"]["nodeCount"] = int(node_count)

# standalone by default
chain_info_file = "$CHAIN_INFO_FILE"
if chain_info_file:
    c["crossOrg"]["mode"] = "shared-chain-group"
else:
    c["crossOrg"]["mode"] = "standalone"
c["crossOrg"]["peers"] = []

with open(config_path, "w") as f:
    yaml.dump(c, f, default_flow_style=False, allow_unicode=True, sort_keys=False)

print("  config.yaml updated.")
PYEOF

# Copy chain-info.json if provided (join-chain mode)
if [[ -n "$CHAIN_INFO_FILE" ]]; then
  if [[ ! -f "$CHAIN_INFO_FILE" ]]; then
    echo "ERROR: --chain-info file not found: $CHAIN_INFO_FILE"
    exit 1
  fi
  cp "$CHAIN_INFO_FILE" "$DEST_DIR/chain-info.json"
  echo "  chain-info.json copied → $DEST_DIR/chain-info.json"
fi

echo ""
echo "Committing config to local repo ..."
COMMIT_FILES=(config.yaml)
[[ -n "$CHAIN_INFO_FILE" ]] && COMMIT_FILES+=(chain-info.json)
git -C "$DEST_DIR" add "${COMMIT_FILES[@]}"
git -C "$DEST_DIR" commit -m "chore: configure org ${ORG_NAME}"

echo ""
echo "════════════════════════════════════════════════"
echo "  DONE — org '$ORG_NAME' scaffolded at $DEST_DIR"
echo "════════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo ""
echo "  1. Push to a new GitHub repo (optional but required for ArgoCD GitOps):"
echo "       gh repo create radityaaa43/${ORG_NAME}-cbdc --private"
echo "       git -C $DEST_DIR remote set-url origin <new-repo-url>"
echo "       git -C $DEST_DIR push -u origin main"
echo ""
echo "  2. Point kubectl at the new cluster:"
echo "       export KUBECONFIG=/path/to/${ORG_NAME}-kubeconfig"
echo ""
echo "  3. Bootstrap:"
if [[ -n "$CHAIN_INFO_FILE" ]]; then
  echo "       cd $DEST_DIR && bash bootstrap.sh --chain-info chain-info.json --org1-ip <org1-ip>"
  echo ""
  echo "  4. After bootstrap, on org1 machine — vote to add org2 as validator:"
  echo "       bash scripts/vote-add-validator.sh --address <org2-validator-addr-from-join-chain-output>"
else
  echo "       cd $DEST_DIR && bash bootstrap.sh"
fi
echo ""
echo "  NodePorts (on new cluster — no conflict):"
BPORT="${BESU_PORT:-31545}"
PPORT="${PALADIN_PORT:-31548}"
NC="${NODE_COUNT:-4}"
for i in $(seq 1 "$NC"); do
  echo "    besu-node${i}:    http://<cluster-ip>:$((BPORT + (i-1)*100))"
  echo "    paladin-node${i}: http://<cluster-ip>:$((PPORT + (i-1)*100))"
done
echo ""
echo "  Same-host NodePort offsets (if multiple orgs on one machine):"
echo "    org1 (default):  --besu-port 31545 --paladin-port 31548"
echo "    org2:            --besu-port 31945 --paladin-port 31948"
echo "    org3:            --besu-port 32345 --paladin-port 32348"
echo ""
