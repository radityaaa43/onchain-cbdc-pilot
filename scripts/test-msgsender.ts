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

// Minimal contract: stores msg.sender on construction, has getSender() view
const BYTECODE = "0x6080604052336000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555060bc806100516000396000f3fe6080604052348015600f57600080fd5b506004361060285760003560e01c80635e01eb5a14602d575b600080fd5b6033604f565b604051808273ffffffffffffffffffffffffffffffffffffffff16815260200191505060405180910390f35b60008054906101000a900473ffffffffffffffffffffffffffffffffffffffff1681565b";
const ABI: ReadonlyArray<JsonFragment> = [
  { type: "constructor", inputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "getSender", inputs: [], outputs: [{ name: "", type: "address" }], stateMutability: "view" },
];

// Actually simpler: use grantRole and check receipt success field
const GET_SENDER_ABI: JsonFragment = { type:"function", name:"getSender", inputs:[], outputs:[{name:"",type:"address"}], stateMutability:"view" };

async function main() {
  const paladin = new PaladinClient({ url: "http://localhost:31548" });
  const group = await new PenteFactory(paladin,"pente").resumePrivacyGroup({ id: readEnv("PENTE_GROUP_ADDRESS") });
  if (!group) throw new Error("group not found");

  // Deploy minimal msg.sender reader
  console.log("Deploying MsgSenderReader...");
  const addr = await group.deploy({
    abi: ABI,
    bytecode: BYTECODE,
    from: FROM,
    inputs: {},
  }).waitForDeploy(60_000);
  console.log("  deployed:", addr);

  if (!addr) throw new Error("deploy failed");

  // Call getSender
  const result = await group.call({
    from: FROM,
    methodAbi: GET_SENDER_ABI,
    to: addr,
    data: {},
  });
  console.log("msg.sender in Pente EVM:", result);
}

main().catch(e => { console.error(e.message); process.exit(1); });
