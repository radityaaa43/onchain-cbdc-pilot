#!/usr/bin/env npx ts-node
/**
 * deploy-contracts.ts — Deploy CBDC + Bond contracts to Paladin Pente privacy group.
 *
 * Deploy order (dependency-correct):
 *   1.  SettlementFailureService  (no deps)
 *   2.  CBToken                   (proxy: impl → proxy → initializeBasic)
 *   3.  LifecycleManager          (needs FixedIncomeToken, deploy after step 4)
 *   4.  FixedIncomeToken          (proxy: impl → proxy → initializeBasic)
 *   3b. LifecycleManager          (needs FixedIncomeToken address)
 *   5.  BondMetadataRegistry      (no deps)
 *   6.  DVPService                (needs CBToken + FixedIncomeToken + LifecycleManager + SettlementFailureService)
 *   7.  CBDCIssuanceService        (needs CBToken)
 *   8.  CBDCTransferService        (needs CBToken)
 *   9.  IssuanceService            (needs FixedIncomeToken + LifecycleManager)
 *  10.  Role wiring
 *
 * Usage:
 *   npx ts-node scripts/deploy-contracts.ts [--paladin-url URL] [--from IDENTITY]
 *
 * Env / defaults:
 *   PALADIN_URL   http://localhost:31548
 *   PENTE_FROM    cbdc-pilot@node1
 *   ADMIN_ADDR    0x75a99473917701038e854ef6999c76cd947c9f9e  (Besu dev acct)
 *   CHAIN_ID      1337
 */

import * as fs from "fs";
import * as path from "path";
import PaladinClient, {
  PenteFactory,
  PentePrivacyGroup,
} from "@lfdecentralizedtrust/paladin-sdk";
import { ethers, JsonFragment } from "ethers";

// ─── Config ────────────────────────────────────────────────────────────────

const PALADIN_URL = process.env.PALADIN_URL ?? "http://localhost:31548";
const FROM        = process.env.PENTE_FROM   ?? "cbdc-pilot@node1";
const ADMIN_ADDR  = process.env.ADMIN_ADDR   ?? "0x75a99473917701038e854ef6999c76cd947c9f9e";
const CHAIN_ID    = parseInt(process.env.CHAIN_ID ?? "1337");
const WAIT_MS     = 120_000;

const ROOT        = path.resolve(__dirname, "..");
const ARTIFACTS   = path.join(ROOT, "artifacts", "contracts");
const OZ_ARTIFACTS = path.join(ROOT, "artifacts", "@openzeppelin");
const ENV_LOCAL   = path.join(ROOT, ".env.local");

// ─── Artifact helpers ───────────────────────────────────────────────────────

function loadArtifact(relPath: string, name: string) {
  const p = path.join(ARTIFACTS, relPath, `${name}.json`);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function loadOzArtifact(relPath: string, name: string) {
  const p = path.join(OZ_ARTIFACTS, relPath, `${name}.json`);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function artifact(relPath: string, name: string) {
  const a = loadArtifact(relPath, name);
  return { abi: a.abi as ReadonlyArray<JsonFragment>, bytecode: a.bytecode as string };
}

// ─── .env.local helpers ─────────────────────────────────────────────────────

function saveEnv(key: string, value: string) {
  let lines: string[] = [];
  if (fs.existsSync(ENV_LOCAL)) {
    lines = fs.readFileSync(ENV_LOCAL, "utf8").split("\n");
  }
  const idx = lines.findIndex(l => l.startsWith(`${key}=`));
  if (idx >= 0) {
    lines[idx] = `${key}=${value}`;
  } else {
    lines.push(`${key}=${value}`);
  }
  fs.writeFileSync(ENV_LOCAL, lines.join("\n"));
  console.log(`  saved ${key}=${value}`);
}

function readEnv(key: string): string | undefined {
  if (!fs.existsSync(ENV_LOCAL)) return undefined;
  for (const line of fs.readFileSync(ENV_LOCAL, "utf8").split("\n")) {
    if (line.startsWith(`${key}=`)) return line.slice(key.length + 1).trim();
  }
  return undefined;
}

// ─── Pente group ─────────────────────────────────────────────────────────────

async function getOrCreateGroup(paladin: PaladinClient): Promise<PentePrivacyGroup> {
  const factory = new PenteFactory(paladin, "pente");

  const existingId = readEnv("PENTE_GROUP_ADDRESS");
  if (existingId) {
    console.log(`Resuming existing Pente group: ${existingId}`);
    const g = await factory.resumePrivacyGroup({ id: existingId });
    if (!g) throw new Error(`Group ${existingId} not found — delete PENTE_GROUP_ADDRESS from .env.local to re-create`);
    return g;
  }

  console.log("Creating new Pente privacy group...");
  const group = await factory.newPrivacyGroup({
    members: [FROM],
    evmVersion: "cancun",
    endorsementType: "group_scoped_identities",
    externalCallsEnabled: false,
  }).waitForDeploy(WAIT_MS);

  if (!group) throw new Error("Pente group deploy timed out");
  saveEnv("PENTE_GROUP_ADDRESS", group.address);
  console.log(`  group created: ${group.address}`);
  return group;
}

// ─── UUPS proxy deploy helper ────────────────────────────────────────────────
// Pattern: deploy impl (no args) → deploy ERC1967Proxy(_logic=impl, _data="") → call initialize on proxy

const PROXY_ART = loadOzArtifact(
  "contracts/proxy/ERC1967/ERC1967Proxy.sol",
  "ERC1967Proxy"
);

async function deployProxy(
  group: PentePrivacyGroup,
  implRelPath: string,
  implName: string,
  initFn: string,
  initInputs: Record<string, unknown>,
  label: string
): Promise<string> {
  const impl = artifact(implRelPath, implName);

  // 1. Deploy implementation
  console.log(`  [${label}] deploying implementation...`);
  const implAddr = await group.deploy({
    abi: impl.abi,
    bytecode: impl.bytecode,
    from: FROM,
    inputs: {},
  }).waitForDeploy(WAIT_MS);
  if (!implAddr) throw new Error(`${label} impl deploy timed out`);
  console.log(`  [${label}] impl: ${implAddr}`);

  // 2. Deploy ERC1967Proxy (empty _data — no init in constructor)
  console.log(`  [${label}] deploying proxy...`);
  const proxyAddr = await group.deploy({
    abi: PROXY_ART.abi as ReadonlyArray<JsonFragment>,
    bytecode: PROXY_ART.bytecode as string,
    from: FROM,
    inputs: { _logic: implAddr, _data: "0x" },
  }).waitForDeploy(WAIT_MS);
  if (!proxyAddr) throw new Error(`${label} proxy deploy timed out`);
  console.log(`  [${label}] proxy: ${proxyAddr}`);

  // 3. Call initialize on proxy
  const initAbi = impl.abi.find(
    (f: JsonFragment) => f.type === "function" && f.name === initFn
  ) as JsonFragment;
  if (!initAbi) throw new Error(`${label}: function ${initFn} not found in ABI`);

  console.log(`  [${label}] calling ${initFn}...`);
  await group.sendTransaction({
    from: FROM,
    methodAbi: initAbi,
    to: proxyAddr,
    data: initInputs,
  }).waitForReceipt(WAIT_MS);

  console.log(`  [${label}] ready at proxy: ${proxyAddr}`);
  return proxyAddr;
}

// ─── Role grant helper ────────────────────────────────────────────────────────

const GRANT_ROLE_ABI: JsonFragment = {
  type: "function",
  name: "grantRole",
  inputs: [
    { name: "role", type: "bytes32" },
    { name: "account", type: "address" },
  ],
  outputs: [],
  stateMutability: "nonpayable",
};

async function grantRole(
  group: PentePrivacyGroup,
  contractAddr: string,
  roleHash: string,
  account: string,
  label: string
) {
  console.log(`  grantRole ${label} → ${account.slice(0, 10)}...`);
  await group.sendTransaction({
    from: FROM,
    methodAbi: GRANT_ROLE_ABI,
    to: contractAddr,
    data: { role: roleHash, account },
  }).waitForReceipt(WAIT_MS);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nPaladin URL:  ${PALADIN_URL}`);
  console.log(`From:         ${FROM}`);
  console.log(`Admin:        ${ADMIN_ADDR}`);
  console.log(`ChainId:      ${CHAIN_ID}\n`);

  const paladin = new PaladinClient({ url: PALADIN_URL });
  const group   = await getOrCreateGroup(paladin);

  // ─── 1. SettlementFailureService ─────────────────────────────────────────
  console.log("\n[1/9] SettlementFailureService");
  const sfsAddr = await deployProxy(
    group,
    "service/asset-support/SettlementFailureService.sol",
    "SettlementFailureService",
    "initialize",
    { admin_: ADMIN_ADDR },
    "SettlementFailureService"
  );
  saveEnv("CONTRACT_SETTLEMENT_FAILURE_SERVICE", sfsAddr);

  // ─── 2. CBToken ───────────────────────────────────────────────────────────
  console.log("\n[2/9] CBToken (Wholesale CBDC)");
  const cbTokenAddr = await deployProxy(
    group,
    "asset/cbdc/CBToken.sol",
    "CBToken",
    "initialize",
    { name_: "Digital Rupiah", symbol_: "DRUP", decimals_: 2, admin_: ADMIN_ADDR },
    "CBToken"
  );
  saveEnv("CONTRACT_CBTOKEN", cbTokenAddr);

  // ─── 3. FixedIncomeToken ──────────────────────────────────────────────────
  console.log("\n[3/9] FixedIncomeToken (Digital Bond)");
  const fiTokenAddr = await deployProxy(
    group,
    "asset/fixed-income/FixedIncomeToken.sol",
    "FixedIncomeToken",
    "initializeBasic",   // ← Pente-compatible initializer (no dynamic arrays)
    { name_: "Digital Bond", symbol_: "DBON", granularity_: "1", chainId_: CHAIN_ID, admin_: ADMIN_ADDR },
    "FixedIncomeToken"
  );
  saveEnv("CONTRACT_FIXED_INCOME_TOKEN", fiTokenAddr);

  // ─── 4. LifecycleManager ──────────────────────────────────────────────────
  console.log("\n[4/9] LifecycleManager");
  const lifecycleAddr = await deployProxy(
    group,
    "asset/fixed-income/LifecycleManager.sol",
    "LifecycleManager",
    "initialize",
    { token_: fiTokenAddr, admin_: ADMIN_ADDR },
    "LifecycleManager"
  );
  saveEnv("CONTRACT_LIFECYCLE_MANAGER", lifecycleAddr);

  // ─── 5. BondMetadataRegistry ──────────────────────────────────────────────
  console.log("\n[5/9] BondMetadataRegistry");
  const metaAddr = await deployProxy(
    group,
    "asset/fixed-income/BondMetadataRegistry.sol",
    "BondMetadataRegistry",
    "initialize",
    { admin_: ADMIN_ADDR },
    "BondMetadataRegistry"
  );
  saveEnv("CONTRACT_BOND_METADATA_REGISTRY", metaAddr);

  // ─── 6. DVPService ────────────────────────────────────────────────────────
  console.log("\n[6/9] DVPService (CPMI-IOSCO atomic settlement)");
  const dvpAddr = await deployProxy(
    group,
    "service/asset-support/DVPService.sol",
    "DVPService",
    "initialize",
    {
      fixedIncomeToken_:       fiTokenAddr,
      lifecycleManager_:       lifecycleAddr,
      cbToken_:                cbTokenAddr,
      settlementFailureService_: sfsAddr,
      admin_:                  ADMIN_ADDR,
    },
    "DVPService"
  );
  saveEnv("CONTRACT_DVP_SERVICE", dvpAddr);

  // ─── 7. CBDCIssuanceService ────────────────────────────────────────────────
  console.log("\n[7/9] CBDCIssuanceService");
  const issuanceAddr = await deployProxy(
    group,
    "service/cbdc/CBDCIssuanceService.sol",
    "CBDCIssuanceService",
    "initialize",
    { cbToken_: cbTokenAddr, admin_: ADMIN_ADDR },
    "CBDCIssuanceService"
  );
  saveEnv("CONTRACT_CBDC_ISSUANCE_SERVICE", issuanceAddr);

  // ─── 8. CBDCTransferService ────────────────────────────────────────────────
  console.log("\n[8/9] CBDCTransferService");
  const transferAddr = await deployProxy(
    group,
    "service/cbdc/CBDCTransferService.sol",
    "CBDCTransferService",
    "initialize",
    { cbToken_: cbTokenAddr, admin_: ADMIN_ADDR },
    "CBDCTransferService"
  );
  saveEnv("CONTRACT_CBDC_TRANSFER_SERVICE", transferAddr);

  // ─── 9. IssuanceService (bond) ────────────────────────────────────────────
  console.log("\n[9/9] IssuanceService (bond)");
  const bondIssuanceAddr = await deployProxy(
    group,
    "service/fixed-income/IssuanceService.sol",
    "IssuanceService",
    "initialize",
    { token_: fiTokenAddr, lifecycle_: lifecycleAddr, admin_: ADMIN_ADDR },
    "IssuanceService"
  );
  saveEnv("CONTRACT_BOND_ISSUANCE_SERVICE", bondIssuanceAddr);

  // ─── Role wiring ──────────────────────────────────────────────────────────
  console.log("\n[roles] Wiring RBAC...");

  const MINTER_ROLE           = ethers.id("MINTER_ROLE");
  const BURNER_ROLE           = ethers.id("BURNER_ROLE");
  const OPERATOR_ROLE         = ethers.id("OPERATOR_ROLE");
  const ISSUER_ROLE           = ethers.id("ISSUER_ROLE");
  const LIFECYCLE_MANAGER_ROLE = ethers.id("LIFECYCLE_MANAGER_ROLE");
  const SETTLEMENT_ROLE       = ethers.id("SETTLEMENT_ROLE");

  // CBToken: IssuanceService gets MINTER_ROLE + BURNER_ROLE
  await grantRole(group, cbTokenAddr, MINTER_ROLE, issuanceAddr, "CBToken.MINTER → issuanceService");
  await grantRole(group, cbTokenAddr, BURNER_ROLE, issuanceAddr, "CBToken.BURNER → issuanceService");
  // CBToken: TransferService gets MINTER_ROLE (for operator transfers via mint+burn)
  await grantRole(group, cbTokenAddr, MINTER_ROLE, transferAddr, "CBToken.MINTER → transferService");

  // FixedIncomeToken: roles for lifecycle, dvp, bondIssuance
  await grantRole(group, fiTokenAddr, OPERATOR_ROLE,         lifecycleAddr,    "FIToken.OPERATOR → lifecycle");
  await grantRole(group, fiTokenAddr, OPERATOR_ROLE,         dvpAddr,          "FIToken.OPERATOR → dvp");
  await grantRole(group, fiTokenAddr, ISSUER_ROLE,           bondIssuanceAddr, "FIToken.ISSUER → bondIssuance");

  // LifecycleManager: roles
  await grantRole(group, lifecycleAddr, LIFECYCLE_MANAGER_ROLE, bondIssuanceAddr, "Lifecycle.LM → bondIssuance");
  await grantRole(group, lifecycleAddr, LIFECYCLE_MANAGER_ROLE, dvpAddr,          "Lifecycle.LM → dvp");

  // DVPService: SETTLEMENT_ROLE to admin (CB operator)
  await grantRole(group, dvpAddr, SETTLEMENT_ROLE, ADMIN_ADDR, "DVP.SETTLEMENT → admin");

  // ─── Summary ───────────────────────────────────────────────────────────────
  console.log("\n════════════════════════════════════════");
  console.log("  CBDC CONTRACTS DEPLOYED");
  console.log("════════════════════════════════════════");
  console.log(`  Pente group:              ${group.address}`);
  console.log(`  CBToken (DRUP):           ${cbTokenAddr}`);
  console.log(`  FixedIncomeToken (DBON):  ${fiTokenAddr}`);
  console.log(`  LifecycleManager:         ${lifecycleAddr}`);
  console.log(`  BondMetadataRegistry:     ${metaAddr}`);
  console.log(`  DVPService:               ${dvpAddr}`);
  console.log(`  CBDCIssuanceService:      ${issuanceAddr}`);
  console.log(`  CBDCTransferService:      ${transferAddr}`);
  console.log(`  IssuanceService (bond):   ${bondIssuanceAddr}`);
  console.log("\nAll addresses saved to .env.local");
}

main().catch(e => { console.error(e); process.exit(1); });
