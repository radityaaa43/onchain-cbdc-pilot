import * as fs from "fs";
import * as path from "path";
import PaladinClient, { PenteFactory } from "@lfdecentralizedtrust/paladin-sdk";
import { JsonFragment } from "ethers";

const FROM      = "cbdc-pilot@node1";
const ENV_LOCAL = path.resolve(__dirname, "../.env.local");
function readEnv(k: string): string {
  for (const l of fs.readFileSync(ENV_LOCAL,"utf8").split("\n"))
    if (l.startsWith(`${k}=`)) return l.slice(k.length+1).trim();
  throw new Error(`Missing: ${k}`);
}

async function main() {
  const paladin = new PaladinClient({ url:"http://localhost:31548" });
  const g = await new PenteFactory(paladin,"pente").resumePrivacyGroup({ id: readEnv("PENTE_GROUP_ADDRESS") });
  if (!g) throw new Error("no group"); const group = g;

  const cb = readEnv("CONTRACT_CBTOKEN");

  async function tryCall(label: string, abi: JsonFragment) {
    try {
      const r = await group.call({ from:FROM, methodAbi:abi, to:cb, data:{} });
      console.log(`✓ ${label}: ${JSON.stringify(r)}`);
    } catch(e:any) {
      console.log(`✗ ${label}: ${e.message?.slice(0,100)}`);
    }
  }

  await tryCall("decimals(uint8)", { type:"function", name:"decimals", inputs:[], outputs:[{name:"",type:"uint8"}], stateMutability:"view" });
  await tryCall("paused(bool)", { type:"function", name:"paused", inputs:[], outputs:[{name:"",type:"bool"}], stateMutability:"view" });
  await tryCall("name(string)", { type:"function", name:"name", inputs:[], outputs:[{name:"",type:"string"}], stateMutability:"view" });
  await tryCall("symbol(string)", { type:"function", name:"symbol", inputs:[], outputs:[{name:"",type:"string"}], stateMutability:"view" });
}
main().catch(e=>{console.error(e.message);process.exit(1);});
