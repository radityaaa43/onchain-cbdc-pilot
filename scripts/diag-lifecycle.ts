#!/usr/bin/env npx ts-node
import * as fs from "fs";
import PaladinClient, { PenteFactory } from "@lfdecentralizedtrust/paladin-sdk";
import { JsonFragment, ethers } from "ethers";

function readEnv(key: string): string {
  for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
    if (line.startsWith(`${key}=`)) return line.slice(key.length + 1).trim();
  }
  return "";
}

const PALADIN_URL = "http://localhost:31548";
const FROM        = "cbdc-pilot@node1";
const WAIT_MS     = 120_000;

const ADMIN       = readEnv("PENTE_FROM_ADDR");
const GROUP_ID    = readEnv("PENTE_GROUP_ADDRESS");
const LIFECYCLE   = readEnv("CONTRACT_LIFECYCLE_MANAGER");
const BOND_META   = readEnv("CONTRACT_BOND_METADATA_REGISTRY");
const FITOKEN     = readEnv("CONTRACT_FIXED_INCOME_TOKEN");

const LIFECYCLE_MANAGER_ROLE = ethers.id("LIFECYCLE_MANAGER_ROLE");
const DEFAULT_ADMIN_ROLE     = "0x0000000000000000000000000000000000000000000000000000000000000000";

const ABI: Record<string, JsonFragment> = {
  hasRole:       { name: "hasRole",       type: "function", inputs: [{ name: "role", type: "bytes32" }, { name: "account", type: "address" }], outputs: [{ type: "bool" }], stateMutability: "view" },
  bondCounter:   { name: "_bondCounter",  type: "function", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
  getActiveBonds:{ name: "getActiveBonds",type: "function", inputs: [], outputs: [{ type: "bytes32[]" }], stateMutability: "view" },
  registerBondV2:{ name: "registerBondV2",type: "function", inputs: [{ name: "bond", type: "address" }, { name: "maturityDate", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  getLastBondId: { name: "getLastBondId", type: "function", inputs: [], outputs: [{ name: "bondId", type: "bytes32" }], stateMutability: "view" },
  token:         { name: "token",         type: "function", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" },
};

async function main() {
  const paladin = new PaladinClient({ url: PALADIN_URL });
  const pente   = new PenteFactory(paladin, "pente");
  const group   = await pente.resumePrivacyGroup({ id: GROUP_ID });
  if (!group) throw new Error("Group not found");

  const call = (to: string, fn: string, data: Record<string, any> = {}) =>
    group.call({ from: FROM, to, methodAbi: ABI[fn], data }) as Promise<Record<string, any>>;

  console.log(`\n── LifecycleManager Diagnostics ──`);
  console.log(`ADMIN:     ${ADMIN}`);
  console.log(`LIFECYCLE: ${LIFECYCLE}`);

  // 1. Check roles
  const hasLM  = await call(LIFECYCLE, "hasRole", { role: LIFECYCLE_MANAGER_ROLE, account: ADMIN });
  const hasDA  = await call(LIFECYCLE, "hasRole", { role: DEFAULT_ADMIN_ROLE, account: ADMIN });
  console.log(`\nhasRole(LIFECYCLE_MANAGER_ROLE, ADMIN): ${hasLM["0"]}`);
  console.log(`hasRole(DEFAULT_ADMIN_ROLE, ADMIN):     ${hasDA["0"]}`);

  // 2. Check token reference
  const tokenAddr = await call(LIFECYCLE, "token");
  console.log(`token() in LifecycleManager: ${tokenAddr["0"]}`);
  console.log(`expected FixedIncomeToken:   ${FITOKEN}`);

  // 3. Try registerBondV2
  if (hasLM["0"] === false) {
    console.log("\nADMIN lacks LIFECYCLE_MANAGER_ROLE — re-initialize needed");
    return;
  }

  const MATURITY = Math.floor(Date.now() / 1000) + 365 * 24 * 3600;
  console.log(`\nCalling registerBondV2(bond=${BOND_META}, maturity=${MATURITY})...`);

  const future  = group.sendTransaction({ from: FROM, to: LIFECYCLE, methodAbi: ABI["registerBondV2"], data: { bond: BOND_META, maturityDate: MATURITY } });
  const receipt = await future.waitForReceipt(WAIT_MS, true);
  console.log(`receipt.success:        ${receipt?.success}`);
  console.log(`receipt.failureMessage: ${receipt?.failureMessage}`);
  console.log(`receipt full:           ${JSON.stringify(receipt, null, 2).slice(0, 500)}`);

  if (!receipt?.success) {
    console.log("registerBondV2 FAILED");
    return;
  }

  const bondId = await call(LIFECYCLE, "getLastBondId");
  console.log(`getLastBondId(): ${bondId["0"]}`);
}

main().catch(e => { console.error("ERROR:", e.message ?? e); process.exit(1); });
