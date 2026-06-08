#!/usr/bin/env npx ts-node
import * as fs from "fs";
import * as path from "path";
import PaladinClient, { PenteFactory } from "@lfdecentralizedtrust/paladin-sdk";
import { JsonFragment } from "ethers";

const PALADIN_URL = "http://localhost:31548";
const FROM        = "cbdc-pilot@node1";
const WAIT_MS     = 60_000;
const ENV_LOCAL   = "/home/ubuntu/italog/onchain-cbdc-pilot/.env.local";
const ARTIFACTS   = "/home/ubuntu/italog/onchain-cbdc-pilot/artifacts/contracts";

function readEnv(key: string): string {
  for (const line of fs.readFileSync(ENV_LOCAL, "utf8").split("\n"))
    if (line.startsWith(`${key}=`)) return line.slice(key.length + 1).trim();
  throw new Error(`Missing env: ${key}`);
}

function getAbi(relPath: string, name: string): ReadonlyArray<JsonFragment> {
  const p = path.join(ARTIFACTS, relPath, `${name}.json`);
  return JSON.parse(fs.readFileSync(p, "utf8")).abi;
}

async function callView(group: any, abi: ReadonlyArray<JsonFragment>, contractAddr: string, fn: string, inputs: Record<string,unknown> = {}): Promise<any> {
  const methodAbi = abi.find((f: any) => f.type === "function" && f.name === fn) as JsonFragment;
  if (!methodAbi) throw new Error(`${fn} not in ABI`);
  const result = await group.call({
    from: FROM,
    methodAbi,
    to: contractAddr,
    data: inputs,
  });
  return result;
}

async function main() {
  const paladin = new PaladinClient({ url: PALADIN_URL });
  const factory = new PenteFactory(paladin, "pente");
  const group = await factory.resumePrivacyGroup({ id: readEnv("PENTE_GROUP_ADDRESS") });
  if (!group) throw new Error("group not found");

  const results: {contract: string, check: string, ok: boolean, value?: any}[] = [];

  async function check(contract: string, checkName: string, fn: () => Promise<any>) {
    try {
      const val = await fn();
      results.push({ contract, check: checkName, ok: true, value: val });
    } catch (e: any) {
      results.push({ contract, check: checkName, ok: false, value: e.message?.slice(0,80) });
    }
  }

  // CBToken
  const cbAbi = getAbi("asset/cbdc/CBToken.sol", "CBToken");
  const cbAddr = readEnv("CONTRACT_CBTOKEN");
  await check("CBToken", "name()", () => callView(group, cbAbi, cbAddr, "name"));
  await check("CBToken", "symbol()", () => callView(group, cbAbi, cbAddr, "symbol"));
  await check("CBToken", "totalSupply()", () => callView(group, cbAbi, cbAddr, "totalSupply"));

  // FixedIncomeToken
  const fiAbi = getAbi("asset/fixed-income/FixedIncomeToken.sol", "FixedIncomeToken");
  const fiAddr = readEnv("CONTRACT_FIXED_INCOME_TOKEN");
  await check("FixedIncomeToken", "name()", () => callView(group, fiAbi, fiAddr, "name"));
  await check("FixedIncomeToken", "symbol()", () => callView(group, fiAbi, fiAddr, "symbol"));

  // LifecycleManager — check token address
  const lcAbi = getAbi("asset/fixed-income/LifecycleManager.sol", "LifecycleManager");
  const lcAddr = readEnv("CONTRACT_LIFECYCLE_MANAGER");
  await check("LifecycleManager", "token()", () => callView(group, lcAbi, lcAddr, "token"));

  // SettlementFailureService
  const sfsAbi = getAbi("service/asset-support/SettlementFailureService.sol", "SettlementFailureService");
  const sfsAddr = readEnv("CONTRACT_SETTLEMENT_FAILURE_SERVICE");
  await check("SettlementFailureService", "DEFAULT_ADMIN_ROLE()", () => callView(group, sfsAbi, sfsAddr, "DEFAULT_ADMIN_ROLE"));

  // DVPService
  const dvpAbi = getAbi("service/asset-support/DVPService.sol", "DVPService");
  const dvpAddr = readEnv("CONTRACT_DVP_SERVICE");
  await check("DVPService", "cbToken()", () => callView(group, dvpAbi, dvpAddr, "cbToken"));
  await check("DVPService", "fixedIncomeToken()", () => callView(group, dvpAbi, dvpAddr, "fixedIncomeToken"));

  // CBDCIssuanceService
  const issuAbi = getAbi("service/cbdc/CBDCIssuanceService.sol", "CBDCIssuanceService");
  const issuAddr = readEnv("CONTRACT_CBDC_ISSUANCE_SERVICE");
  await check("CBDCIssuanceService", "cbToken()", () => callView(group, issuAbi, issuAddr, "cbToken"));

  // CBDCTransferService
  const xferAbi = getAbi("service/cbdc/CBDCTransferService.sol", "CBDCTransferService");
  const xferAddr = readEnv("CONTRACT_CBDC_TRANSFER_SERVICE");
  await check("CBDCTransferService", "cbToken()", () => callView(group, xferAbi, xferAddr, "cbToken"));

  // IssuanceService (bond)
  const bondIssAbi = getAbi("service/fixed-income/IssuanceService.sol", "IssuanceService");
  const bondIssAddr = readEnv("CONTRACT_BOND_ISSUANCE_SERVICE");
  await check("IssuanceService", "token()", () => callView(group, bondIssAbi, bondIssAddr, "token"));
  await check("IssuanceService", "lifecycle()", () => callView(group, bondIssAbi, bondIssAddr, "lifecycle"));

  // Print results
  console.log("\n════════ CONTRACT VERIFICATION ════════");
  let passed = 0, failed = 0;
  for (const r of results) {
    const icon = r.ok ? "✓" : "✗";
    const val  = r.ok ? JSON.stringify(r.value) : `ERR: ${r.value}`;
    console.log(`${icon} ${r.contract}.${r.check} → ${val}`);
    r.ok ? passed++ : failed++;
  }
  console.log(`\n${passed} passed, ${failed} failed`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
