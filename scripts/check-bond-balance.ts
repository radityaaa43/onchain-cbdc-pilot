#!/usr/bin/env npx ts-node
/**
 * check-bond-balance.ts — Read partition balances for a bondId/holder across
 * PRIMARY/SECONDARY/LENT/PLEDGED/DEFAULTED states via Pente group.call.
 */
import * as fs from "fs";
import * as path from "path";
import PaladinClient, { PenteFactory } from "@lfdecentralizedtrust/paladin-sdk";
import { ethers, JsonFragment } from "ethers";

const PALADIN_URL = process.env.PALADIN_URL ?? "http://localhost:31548";
const FROM        = process.env.PENTE_FROM   ?? "cbdc-pilot@node1";
const ROOT        = path.resolve(__dirname, "..");
const ENV_LOCAL   = path.join(ROOT, ".env.local");

const BOND_ID = process.env.BOND_ID ?? "0x538a3cb76ec8bdbadb72334099ded15c9141d34329dc0b5d15f32d8501c18667";

function readEnv(key: string): string {
  for (const line of fs.readFileSync(ENV_LOCAL, "utf8").split("\n"))
    if (line.startsWith(`${key}=`)) return line.slice(key.length + 1).trim();
  throw new Error(`${key} not found`);
}

const BAL_ABI: JsonFragment = {
  name: "balanceOfByBond", type: "function", stateMutability: "view",
  inputs: [{ name: "bondId", type: "bytes32" }, { name: "state", type: "bytes32" }, { name: "holder", type: "address" }],
  outputs: [{ type: "uint256" }],
};

async function main() {
  const paladin = new PaladinClient({ url: PALADIN_URL });
  const factory = new PenteFactory(paladin, "pente");
  const group = await factory.resumePrivacyGroup({ id: readEnv("PENTE_GROUP_ADDRESS") });
  if (!group) throw new Error("group not found");

  const fiToken = readEnv("CONTRACT_FIXED_INCOME_TOKEN");
  const holder  = readEnv("PENTE_FROM_ADDR");

  console.log(`bondId: ${BOND_ID}`);
  console.log(`holder: ${holder}`);
  console.log(`FIToken: ${fiToken}\n`);

  for (const state of ["PRIMARY", "SECONDARY", "LENT", "PLEDGED", "DEFAULTED", "REPO"]) {
    const stateHash = ethers.id(state);
    try {
      const res = await group.call({
        from: FROM, methodAbi: BAL_ABI, to: fiToken,
        data: { bondId: BOND_ID, state: stateHash, holder },
      }) as Record<string, string>;
      console.log(`  ${state.padEnd(10)} = ${res["0"]}`);
    } catch (e: any) {
      console.log(`  ${state.padEnd(10)} = ERROR: ${e?.message?.slice(0, 80)}`);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
