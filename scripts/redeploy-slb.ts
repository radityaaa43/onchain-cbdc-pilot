#!/usr/bin/env npx ts-node
/**
 * redeploy-slb.ts — Redeploy SecuritiesLendingService with fixed lendId computation.
 * Deploys new instance, wires roles, updates .env.local.
 *
 * Usage:
 *   cd /home/ubuntu/italog/onchain-cbdc-pilot
 *   npx ts-node scripts/redeploy-slb.ts
 */

import * as fs from "fs";
import * as path from "path";
import PaladinClient, { PenteFactory, PentePrivacyGroup } from "@lfdecentralizedtrust/paladin-sdk";
import { ethers, JsonFragment } from "ethers";

const PALADIN_URL = process.env.PALADIN_URL ?? "http://localhost:31548";
const FROM        = process.env.PENTE_FROM   ?? "cbdc-pilot@node1";
const WAIT_MS     = 300_000;

const ROOT      = path.resolve(__dirname, "..");
const ARTIFACTS = path.join(ROOT, "artifacts", "contracts");
const ENV_LOCAL = path.join(ROOT, ".env.local");

function artifact(relPath: string, name: string) {
  const p = path.join(ARTIFACTS, relPath, `${name}.json`);
  const a = JSON.parse(fs.readFileSync(p, "utf8"));
  return { abi: a.abi as ReadonlyArray<JsonFragment>, bytecode: a.bytecode as string };
}

function readEnv(key: string): string {
  for (const line of fs.readFileSync(ENV_LOCAL, "utf8").split("\n")) {
    if (line.startsWith(`${key}=`)) return line.slice(key.length + 1).trim();
  }
  throw new Error(`${key} not found in .env.local`);
}

function saveEnv(key: string, value: string) {
  let lines = fs.readFileSync(ENV_LOCAL, "utf8").split("\n");
  const idx = lines.findIndex(l => l.startsWith(`${key}=`));
  if (idx >= 0) lines[idx] = `${key}=${value}`;
  else lines.push(`${key}=${value}`);
  fs.writeFileSync(ENV_LOCAL, lines.join("\n"));
  console.log(`  saved ${key}=${value}`);
}

const GRANT_ROLE_ABI: JsonFragment = {
  type: "function", name: "grantRole",
  inputs: [{ name: "role", type: "bytes32" }, { name: "account", type: "address" }],
  outputs: [], stateMutability: "nonpayable",
};

async function grantRole(group: PentePrivacyGroup, contractAddr: string, roleHash: string, account: string, label: string) {
  console.log(`  grantRole ${label} → ${account.slice(0, 10)}...`);
  const r = await group.sendTransaction({
    from: FROM, methodAbi: GRANT_ROLE_ABI, to: contractAddr,
    data: { role: roleHash, account },
  }).waitForReceipt(WAIT_MS);
  if (!r?.success) throw new Error(`grantRole ${label} failed: ${JSON.stringify(r?.failureMessage ?? "timeout")}`);
  console.log(`  ✓ ${label}`);
}

async function main() {
  const paladin = new PaladinClient({ url: PALADIN_URL });
  const factory = new PenteFactory(paladin, "pente");

  const groupId = readEnv("PENTE_GROUP_ADDRESS");
  console.log(`Resuming Pente group: ${groupId}`);
  const group = await factory.resumePrivacyGroup({ id: groupId });
  if (!group) throw new Error("Group not found");

  const ADMIN_ADDR        = readEnv("PENTE_FROM_ADDR");
  const fiTokenAddr       = readEnv("CONTRACT_FIXED_INCOME_TOKEN");
  const lifecycleAddr     = readEnv("CONTRACT_LIFECYCLE_MANAGER");
  const cbTokenAddr       = readEnv("CONTRACT_CBTOKEN");

  console.log(`Admin:     ${ADMIN_ADDR}`);
  console.log(`FIToken:   ${fiTokenAddr}`);
  console.log(`Lifecycle: ${lifecycleAddr}`);
  console.log(`CBToken:   ${cbTokenAddr}`);

  // ── Deploy new SecuritiesLendingService ──────────────────────────────────
  const impl = artifact("service/fixed-income/SecuritiesLendingService.sol", "SecuritiesLendingService");
  console.log("\n[1/3] Deploying SecuritiesLendingService...");
  const slbAddr = await group.deploy({
    abi: impl.abi, bytecode: impl.bytecode, from: FROM, inputs: {},
  }).waitForDeploy(WAIT_MS);
  if (!slbAddr) throw new Error("SecuritiesLendingService deploy timed out");
  console.log(`  deployed: ${slbAddr}`);

  const initAbi = impl.abi.find((f: JsonFragment) => f.type === "function" && f.name === "initialize") as JsonFragment;
  console.log("  calling initialize...");
  const initR = await group.sendTransaction({
    from: FROM, methodAbi: initAbi, to: slbAddr,
    data: { token_: fiTokenAddr, lifecycle_: lifecycleAddr, cbToken_: cbTokenAddr, admin_: ADMIN_ADDR },
  }).waitForReceipt(WAIT_MS);
  if (!initR?.success) throw new Error(`initialize failed: ${JSON.stringify(initR?.failureMessage ?? "timeout")}`);
  console.log(`  initialized ✓`);

  // ── Grant roles ──────────────────────────────────────────────────────────
  console.log("\n[2/3] Granting roles...");
  const OPERATOR_ROLE          = ethers.id("OPERATOR_ROLE");
  const LIFECYCLE_MANAGER_ROLE = ethers.id("LIFECYCLE_MANAGER_ROLE");

  await grantRole(group, fiTokenAddr, OPERATOR_ROLE, slbAddr, "FIToken.OPERATOR → slbService");
  await grantRole(group, lifecycleAddr, LIFECYCLE_MANAGER_ROLE, slbAddr, "Lifecycle.LM → slbService");

  // ── Update .env.local ────────────────────────────────────────────────────
  console.log("\n[3/3] Updating .env.local...");
  saveEnv("CONTRACT_SECURITIES_LENDING_SERVICE", slbAddr);

  console.log(`
════════════════════════════════════════
  SecuritiesLendingService redeployed
  New address: ${slbAddr}
════════════════════════════════════════

Next steps:
  1. Kill API server, restart with updated .env.local
  2. Approve CBToken 100M to new address: ${slbAddr}
  3. Submit initiateLend
`);
}

main().catch(e => { console.error(e); process.exit(1); });
