#!/usr/bin/env npx ts-node
import * as fs from "fs";
import PaladinClient, { PenteFactory } from "@lfdecentralizedtrust/paladin-sdk";
import { JsonFragment } from "ethers";

function readEnv(key: string): string {
  for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
    if (line.startsWith(`${key}=`)) return line.slice(key.length + 1).trim();
  }
  throw new Error(`Missing ${key} in .env.local`);
}

const PALADIN_URL    = "http://localhost:31548";
const FROM           = "cbdc-pilot@node1";
const GROUP_ID       = readEnv("PENTE_GROUP_ADDRESS");
const CBTOKEN        = readEnv("CONTRACT_CBTOKEN");
const FITOKEN        = readEnv("CONTRACT_FIXED_INCOME_TOKEN");

const NAME_ABI:    JsonFragment = { name: "name",     type: "function", inputs: [], outputs: [{ name: "", type: "string" }], stateMutability: "view" };
const SYMBOL_ABI:  JsonFragment = { name: "symbol",   type: "function", inputs: [], outputs: [{ name: "", type: "string" }], stateMutability: "view" };
const DECIMAL_ABI: JsonFragment = { name: "decimals", type: "function", inputs: [], outputs: [{ name: "", type: "uint8"  }], stateMutability: "view" };

async function main() {
  const paladin = new PaladinClient({ url: PALADIN_URL });
  const pente   = new PenteFactory(paladin, "pente");
  const group   = await pente.resumePrivacyGroup({ id: GROUP_ID });
  if (!group) throw new Error("Group not found");

  const cbName   = await group.call({ from: FROM, methodAbi: NAME_ABI,    to: CBTOKEN, data: {} }) as any;
  const cbSymbol = await group.call({ from: FROM, methodAbi: SYMBOL_ABI,  to: CBTOKEN, data: {} }) as any;
  const cbDec    = await group.call({ from: FROM, methodAbi: DECIMAL_ABI, to: CBTOKEN, data: {} }) as any;
  console.log(`CBToken:  name=${JSON.stringify(cbName)} symbol=${JSON.stringify(cbSymbol)} decimals=${JSON.stringify(cbDec)}`);

  const fiName   = await group.call({ from: FROM, methodAbi: NAME_ABI,   to: FITOKEN, data: {} }) as any;
  const fiSymbol = await group.call({ from: FROM, methodAbi: SYMBOL_ABI, to: FITOKEN, data: {} }) as any;
  console.log(`FIToken:  name=${JSON.stringify(fiName)} symbol=${JSON.stringify(fiSymbol)}`);
}
main().catch(e => { console.error("ERROR:", e.message ?? e); process.exit(1); });
