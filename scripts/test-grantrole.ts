import * as fs from "fs";
import * as path from "path";
import PaladinClient, { PenteFactory } from "@lfdecentralizedtrust/paladin-sdk";
import { ethers, JsonFragment } from "ethers";

const FROM      = "cbdc-pilot@node1";
const WAIT_MS   = 60_000;
const ENV_LOCAL = path.resolve(__dirname, "../.env.local");
const ARTIFACTS = path.resolve(__dirname, "../artifacts/contracts");

function readEnv(k: string): string {
  for (const l of fs.readFileSync(ENV_LOCAL,"utf8").split("\n"))
    if (l.startsWith(`${k}=`)) return l.slice(k.length+1).trim();
  throw new Error(`Missing: ${k}`);
}

const HAS_ROLE_ABI: JsonFragment = { type:"function", name:"hasRole", inputs:[{name:"role",type:"bytes32"},{name:"account",type:"address"}], outputs:[{name:"",type:"bool"}], stateMutability:"view" };
const GRANT_ROLE_ABI: JsonFragment = { type:"function", name:"grantRole", inputs:[{name:"role",type:"bytes32"},{name:"account",type:"address"}], outputs:[], stateMutability:"nonpayable" };
const DEFAULT_ADMIN_ABI: JsonFragment = { type:"function", name:"DEFAULT_ADMIN_ROLE", inputs:[], outputs:[{name:"",type:"bytes32"}], stateMutability:"view" };

async function main() {
  const paladin = new PaladinClient({ url: "http://localhost:31548" });
  const group = await new PenteFactory(paladin,"pente").resumePrivacyGroup({ id: readEnv("PENTE_GROUP_ADDRESS") });
  if (!group) throw new Error("group not found");

  const cbAddr  = readEnv("CONTRACT_CBTOKEN");
  const issuAddr= readEnv("CONTRACT_CBDC_ISSUANCE_SERVICE");
  const ADMIN   = "0x65e195242fE41023991d5DeFa8a9ffEA748e4f75";
  const MINTER  = ethers.id("MINTER_ROLE");

  // 1. Confirm DEFAULT_ADMIN_ROLE value from contract
  const darVal = await group.call({ from:FROM, methodAbi:DEFAULT_ADMIN_ABI, to:cbAddr, data:{} });
  console.log("DEFAULT_ADMIN_ROLE constant:", darVal);

  // 2. Confirm admin has DEFAULT_ADMIN
  const adminHasDA = await group.call({ from:FROM, methodAbi:HAS_ROLE_ABI, to:cbAddr, data:{ role:ethers.ZeroHash, account:ADMIN } });
  console.log("admin hasRole(DEFAULT_ADMIN):", adminHasDA);

  // 3. Try grantRole and explicitly track the receipt
  console.log("\nCalling grantRole(MINTER_ROLE, issuanceService)...");
  const pending = group.sendTransaction({
    from: FROM,
    methodAbi: GRANT_ROLE_ABI,
    to: cbAddr,
    data: { role: MINTER, account: issuAddr },
  });

  const receipt = await pending.waitForReceipt(WAIT_MS);
  console.log("Receipt:", JSON.stringify(receipt, null, 2));

  // 4. Check role after
  const hasAfter = await group.call({ from:FROM, methodAbi:HAS_ROLE_ABI, to:cbAddr, data:{ role:MINTER, account:issuAddr } });
  console.log("hasRole(MINTER, issuanceService) after grantRole:", hasAfter);
}

main().catch(e => { console.error(e); process.exit(1); });
