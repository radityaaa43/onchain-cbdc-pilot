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

function getAbi(rel: string, name: string): ReadonlyArray<JsonFragment> {
  return JSON.parse(fs.readFileSync(path.join(ARTIFACTS,rel,`${name}.json`),"utf8")).abi;
}

const HAS_ROLE_ABI: JsonFragment = {
  type:"function", name:"hasRole",
  inputs:[{name:"role",type:"bytes32"},{name:"account",type:"address"}],
  outputs:[{name:"",type:"bool"}], stateMutability:"view"
};

async function main() {
  const paladin = new PaladinClient({ url: "http://localhost:31548" });
  const g = await new PenteFactory(paladin,"pente").resumePrivacyGroup({ id: readEnv("PENTE_GROUP_ADDRESS") });
  if (!g) throw new Error("group not found");
  const group = g;

  const ADMIN = "0xd61f35111dd2df020909ea2c2332ba8f84b22996";
  const DEFAULT_ADMIN = ethers.ZeroHash;
  const MINTER        = ethers.id("MINTER_ROLE");
  const SETTLEMENT    = ethers.id("SETTLEMENT_ROLE");
  const OPERATOR      = ethers.id("OPERATOR_ROLE");

  const cbAddr  = readEnv("CONTRACT_CBTOKEN");
  const dvpAddr = readEnv("CONTRACT_DVP_SERVICE");
  const issuAddr= readEnv("CONTRACT_CBDC_ISSUANCE_SERVICE");
  const xferAddr= readEnv("CONTRACT_CBDC_TRANSFER_SERVICE");
  const fiAddr  = readEnv("CONTRACT_FIXED_INCOME_TOKEN");
  const lcAddr  = readEnv("CONTRACT_LIFECYCLE_MANAGER");

  async function hr(label: string, contract: string, role: string, account: string): Promise<void> {
    try {
      const r = await group.call({ from:FROM, methodAbi:HAS_ROLE_ABI, to:contract, data:{role,account} });
      const ok = r?.["0"] === true || r === true;
      console.log(`${ok?"✓":"✗"} ${label}: hasRole → ${ok}`);
    } catch(e:any) {
      console.log(`✗ ${label}: ERROR ${e.message?.slice(0,60)}`);
    }
  }

  console.log("\n── ADMIN ROLES ──");
  await hr("CBToken.DEFAULT_ADMIN(admin)",         cbAddr,  DEFAULT_ADMIN, ADMIN);
  await hr("DVPService.DEFAULT_ADMIN(admin)",       dvpAddr, DEFAULT_ADMIN, ADMIN);
  await hr("IssuanceService.DEFAULT_ADMIN(admin)",  issuAddr,DEFAULT_ADMIN, ADMIN);
  await hr("FixedIncomeToken.DEFAULT_ADMIN(admin)", fiAddr,  DEFAULT_ADMIN, ADMIN);

  console.log("\n── SERVICE ROLES ──");
  await hr("CBToken.MINTER(issuanceService)",  cbAddr,  MINTER,     issuAddr);
  await hr("CBToken.MINTER(transferService)",  cbAddr,  MINTER,     xferAddr);
  await hr("DVP.SETTLEMENT(admin)",            dvpAddr, SETTLEMENT, ADMIN);
  await hr("FIToken.OPERATOR(lifecycle)",      fiAddr,  OPERATOR,   lcAddr);
}

main().catch(e=>{console.error(e.message);process.exit(1);});
