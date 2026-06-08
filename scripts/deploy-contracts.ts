#!/usr/bin/env npx ts-node
/**
 * deploy-contracts.ts — Deploy CBDC + Bond contracts to Paladin Pente privacy group.
 *
 * Idempotent: if CONTRACT_X is already set in .env.local, that step is skipped.
 * Delete a key from .env.local to re-deploy that contract.
 *
 * Deploy order (dependency-correct):
 *   1.  SettlementFailureService  (no deps)
 *   2.  CBToken                   (initialize: name_/symbol_/decimals_/admin_)
 *   3.  FixedIncomeToken          (initializeBasic: name_/symbol_/granularity_/chainId_/admin_)
 *   4.  LifecycleManager          (initialize: tokenAddress_/admin_)
 *   5.  BondMetadataRegistry      (constructor: admin — no initialize)
 *   6.  DVPService                (initialize: fixedIncomeToken_/lifecycleManager_/cbToken_/settlementFailureService_/admin_)
 *   7.  CBDCIssuanceService       (initialize: cbToken_/admin_)
 *   8.  CBDCTransferService       (initialize: cbToken_/admin_)
 *   9.  IssuanceService           (initialize: token_/lifecycle_/admin_)
 *  10.  DFABIComplianceService    (initialize: admin_)
 *  11.  ComplianceService         (initialize: admin_)
 *  12.  OracleService             (initialize: admin_)
 *  13.  PolicyEngineService       (initialize: policyRunner_/admin_)
 *  14.  ReportingService          (initialize: admin_)
 *  15.  ShariahComplianceService  (initialize: admin_)
 *  16.  CBDCBalanceLimitService   (initialize: admin_)
 *  17.  CBDCDailyLimitService     (initialize: admin_)
 *  18.  CBDCRedemptionService     (initialize: cbToken_/admin_)
 *  19.  NettingService            (initialize: cbToken_/admin_)
 *  20.  CouponCalculator          (constructor: no args)
 *  21.  CouponService             (initialize: token_/lifecycle_/cbToken_/returnCalculator_/admin_)
 *  22.  MaturityService           (initialize: lifecycleManager_/admin_)
 *  23.  MaturityOracle            (initialize: maturityService_/admin_)
 *  24.  RedemptionService         (initialize: token_/lifecycle_/cbToken_/maturityService_/admin_)
 *  25.  TransferService           (initialize: token_/lifecycle_/complianceService_/admin_)
 *  26.  CustodyService            (initialize: token_/admin_)
 *  27.  PledgeService             (initialize: token_/lifecycle_/admin_)
 *  28.  RepoService               (initialize: token_/lifecycle_/cbToken_/admin_)
 *  29.  SecuritiesLendingService  (initialize: token_/lifecycle_/cbToken_/admin_)
 *  30.  CorporateActionService    (initialize: token_/lifecycle_/cbToken_/admin_)
 *  31.  AssetRegistry             (constructor: no args)
 *  32.  TokenGatewayService       (initialize: assetRegistry_/admin_)
 *  33.  Role wiring
 *
 * Usage:
 *   npx ts-node scripts/deploy-contracts.ts
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
const CHAIN_ID    = parseInt(process.env.CHAIN_ID ?? "1337");
const WAIT_MS     = 300_000;

const ROOT      = path.resolve(__dirname, "..");
const ARTIFACTS = path.join(ROOT, "artifacts", "contracts");
const ENV_LOCAL = path.join(ROOT, ".env.local");

// ─── Artifact helpers ───────────────────────────────────────────────────────

function artifact(relPath: string, name: string) {
  const p = path.join(ARTIFACTS, relPath, `${name}.json`);
  const a = JSON.parse(fs.readFileSync(p, "utf8"));
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
    members: [FROM, "cbdc-pilot@node2"],
    evmVersion: "shanghai",
    endorsementType: "group_scoped_identities",
    externalCallsEnabled: false,
  }).waitForDeploy(WAIT_MS);

  if (!group) throw new Error("Pente group deploy timed out");
  saveEnv("PENTE_GROUP_ADDRESS", group.salt);  // salt = internal group ID needed for resume
  saveEnv("PENTE_GROUP_CONTRACT", group.address);
  console.log(`  group created: ${group.address} (id: ${group.salt})`);
  return group;
}

// ─── Group-scoped sender detection ───────────────────────────────────────────

// SenderProbe: constructor stores msg.sender in public `sender` storage slot.
// Compiled from: contract SenderProbe { address public sender; constructor() { sender = msg.sender; } }
const PROBE_BYTECODE = artifact("probe/SenderProbe.sol", "SenderProbe").bytecode;
const PROBE_ABI: ReadonlyArray<JsonFragment> = [
  { type: "constructor", inputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "sender", inputs: [], outputs: [{ name: "", type: "address" }], stateMutability: "view" },
];

async function detectGroupScopedAddr(group: PentePrivacyGroup): Promise<string> {
  const saved = readEnv("PENTE_FROM_ADDR");
  if (saved) {
    console.log(`  FROM group-scoped addr (cached): ${saved}`);
    return saved;
  }
  console.log("  Detecting group-scoped address of FROM...");
  const probeAddr = await group.deploy({
    abi: PROBE_ABI,
    bytecode: PROBE_BYTECODE,
    from: FROM,
    inputs: {},
  }).waitForDeploy(WAIT_MS);
  if (!probeAddr) throw new Error("SenderProbe deploy timed out");

  const result = await group.call({
    from: FROM,
    methodAbi: PROBE_ABI[1] as JsonFragment,
    to: probeAddr,
    data: {},
  }) as Record<string, string>;
  const addr = result["0"];
  console.log(`  FROM group-scoped addr: ${addr}`);
  saveEnv("PENTE_FROM_ADDR", addr);
  return addr;
}

// ─── Deploy helpers ──────────────────────────────────────────────────────────

/**
 * Deploy a contract with an initialize() call.
 * Deploys directly (no proxy) — Pente private EVM cannot chain state across
 * sequential txns needed for ERC1967Proxy constructor impl-code check.
 */
async function deployWithInit(
  group: PentePrivacyGroup,
  implRelPath: string,
  implName: string,
  initFn: string,
  initInputs: Record<string, unknown>,
  label: string
): Promise<string> {
  const impl = artifact(implRelPath, implName);

  console.log(`  [${label}] deploying...`);
  const contractAddr = await group.deploy({
    abi: impl.abi,
    bytecode: impl.bytecode,
    from: FROM,
    inputs: {},
  }).waitForDeploy(WAIT_MS);
  if (!contractAddr) throw new Error(`${label} deploy timed out`);
  console.log(`  [${label}] deployed: ${contractAddr}`);

  const initAbi = impl.abi.find(
    (f: JsonFragment) => f.type === "function" && f.name === initFn
  ) as JsonFragment;
  if (!initAbi) throw new Error(`${label}: function ${initFn} not found in ABI`);

  console.log(`  [${label}] calling ${initFn}...`);
  const initReceipt = await group.sendTransaction({
    from: FROM,
    methodAbi: initAbi,
    to: contractAddr,
    data: initInputs,
  }).waitForReceipt(WAIT_MS);
  if (!initReceipt?.success) throw new Error(`${label}: ${initFn} failed: ${JSON.stringify(initReceipt?.failureMessage ?? "timeout/no receipt")}`);

  console.log(`  [${label}] ready: ${contractAddr}`);
  return contractAddr;
}

/**
 * Deploy a contract via constructor args (no separate initialize call).
 */
async function deployWithConstructor(
  group: PentePrivacyGroup,
  implRelPath: string,
  implName: string,
  constructorInputs: Record<string, unknown>,
  label: string
): Promise<string> {
  const impl = artifact(implRelPath, implName);

  console.log(`  [${label}] deploying...`);
  const contractAddr = await group.deploy({
    abi: impl.abi,
    bytecode: impl.bytecode,
    from: FROM,
    inputs: constructorInputs,
  }).waitForDeploy(WAIT_MS);
  if (!contractAddr) throw new Error(`${label} deploy timed out`);
  console.log(`  [${label}] deployed: ${contractAddr}`);
  return contractAddr;
}

/**
 * Resume from .env.local if already deployed, otherwise deploy.
 */
async function deployOrResume(
  envKey: string,
  label: string,
  deployFn: () => Promise<string>
): Promise<string> {
  const existing = readEnv(envKey);
  if (existing) {
    console.log(`  [${label}] already deployed (resuming): ${existing}`);
    return existing;
  }
  const addr = await deployFn();
  saveEnv(envKey, addr);
  return addr;
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
  const roleReceipt = await group.sendTransaction({
    from: FROM,
    methodAbi: GRANT_ROLE_ABI,
    to: contractAddr,
    data: { role: roleHash, account },
  }).waitForReceipt(WAIT_MS);
  if (!roleReceipt?.success) throw new Error(`grantRole ${label} failed: ${JSON.stringify(roleReceipt?.failureMessage ?? "timeout/no receipt")}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nPaladin URL:  ${PALADIN_URL}`);
  console.log(`From:         ${FROM}`);
  console.log(`ChainId:      ${CHAIN_ID}\n`);

  const paladin = new PaladinClient({ url: PALADIN_URL });
  const group   = await getOrCreateGroup(paladin);

  // Detect group-scoped address of FROM (differs per Pente group due to group_scoped_identities)
  const ADMIN_ADDR = await detectGroupScopedAddr(group);
  console.log(`Admin (group-scoped): ${ADMIN_ADDR}`);

  // ─── 1. SettlementFailureService ─────────────────────────────────────────
  console.log("\n[1/32] SettlementFailureService");
  const sfsAddr = await deployOrResume(
    "CONTRACT_SETTLEMENT_FAILURE_SERVICE",
    "SettlementFailureService",
    () => deployWithInit(
      group,
      "service/asset-support/SettlementFailureService.sol",
      "SettlementFailureService",
      "initialize",
      { admin_: ADMIN_ADDR },
      "SettlementFailureService"
    )
  );

  // ─── 2. CBToken ───────────────────────────────────────────────────────────
  console.log("\n[2/32] CBToken (Wholesale CBDC)");
  const cbTokenAddr = await deployOrResume(
    "CONTRACT_CBTOKEN",
    "CBToken",
    () => deployWithInit(
      group,
      "asset/cbdc/CBToken.sol",
      "CBToken",
      "initialize",
      { name_: "Digital Rupiah", symbol_: "DRUP", decimals_: 2, admin_: ADMIN_ADDR },
      "CBToken"
    )
  );

  // ─── 3. FixedIncomeToken ──────────────────────────────────────────────────
  console.log("\n[3/32] FixedIncomeToken (Digital Bond)");
  const fiTokenAddr = await deployOrResume(
    "CONTRACT_FIXED_INCOME_TOKEN",
    "FixedIncomeToken",
    () => deployWithInit(
      group,
      "asset/fixed-income/FixedIncomeToken.sol",
      "FixedIncomeToken",
      "initializeBasic",
      { name_: "Digital Bond", symbol_: "DBON", granularity_: "1", chainId_: CHAIN_ID, admin_: ADMIN_ADDR },
      "FixedIncomeToken"
    )
  );

  // ─── 4. LifecycleManager ──────────────────────────────────────────────────
  console.log("\n[4/32] LifecycleManager");
  const lifecycleAddr = await deployOrResume(
    "CONTRACT_LIFECYCLE_MANAGER",
    "LifecycleManager",
    () => deployWithInit(
      group,
      "asset/fixed-income/LifecycleManager.sol",
      "LifecycleManager",
      "initialize",
      { tokenAddress_: fiTokenAddr, admin_: ADMIN_ADDR },
      "LifecycleManager"
    )
  );

  // ─── 5. BondMetadataRegistry ──────────────────────────────────────────────
  // Constructor takes `admin` (no initialize function)
  console.log("\n[5/32] BondMetadataRegistry");
  const metaAddr = await deployOrResume(
    "CONTRACT_BOND_METADATA_REGISTRY",
    "BondMetadataRegistry",
    () => deployWithConstructor(
      group,
      "asset/fixed-income/BondMetadataRegistry.sol",
      "BondMetadataRegistry",
      { admin: ADMIN_ADDR },
      "BondMetadataRegistry"
    )
  );

  // ─── 6. DVPService ────────────────────────────────────────────────────────
  console.log("\n[6/32] DVPService (CPMI-IOSCO atomic settlement)");
  const dvpAddr = await deployOrResume(
    "CONTRACT_DVP_SERVICE",
    "DVPService",
    () => deployWithInit(
      group,
      "service/asset-support/DVPService.sol",
      "DVPService",
      "initialize",
      {
        fixedIncomeToken_:         fiTokenAddr,
        lifecycleManager_:         lifecycleAddr,
        cbToken_:                  cbTokenAddr,
        settlementFailureService_: sfsAddr,
        admin_:                    ADMIN_ADDR,
      },
      "DVPService"
    )
  );

  // ─── 7. CBDCIssuanceService ────────────────────────────────────────────────
  console.log("\n[7/32] CBDCIssuanceService");
  const issuanceAddr = await deployOrResume(
    "CONTRACT_CBDC_ISSUANCE_SERVICE",
    "CBDCIssuanceService",
    () => deployWithInit(
      group,
      "service/cbdc/CBDCIssuanceService.sol",
      "CBDCIssuanceService",
      "initialize",
      { cbToken_: cbTokenAddr, admin_: ADMIN_ADDR },
      "CBDCIssuanceService"
    )
  );

  // ─── 8. CBDCTransferService ────────────────────────────────────────────────
  console.log("\n[8/32] CBDCTransferService");
  const transferAddr = await deployOrResume(
    "CONTRACT_CBDC_TRANSFER_SERVICE",
    "CBDCTransferService",
    () => deployWithInit(
      group,
      "service/cbdc/CBDCTransferService.sol",
      "CBDCTransferService",
      "initialize",
      { cbToken_: cbTokenAddr, admin_: ADMIN_ADDR },
      "CBDCTransferService"
    )
  );

  // ─── 9. IssuanceService (bond) ────────────────────────────────────────────
  console.log("\n[9/32] IssuanceService (bond)");
  const bondIssuanceAddr = await deployOrResume(
    "CONTRACT_BOND_ISSUANCE_SERVICE",
    "IssuanceService",
    () => deployWithInit(
      group,
      "service/fixed-income/IssuanceService.sol",
      "IssuanceService",
      "initialize",
      { token_: fiTokenAddr, lifecycle_: lifecycleAddr, admin_: ADMIN_ADDR },
      "IssuanceService"
    )
  );

  // ─── 10. DFABIComplianceService ───────────────────────────────────────────
  console.log("\n[10/32] DFABIComplianceService");
  const dfabiComplianceAddr = await deployOrResume(
    "CONTRACT_DFABI_COMPLIANCE_SERVICE",
    "DFABIComplianceService",
    () => deployWithInit(
      group,
      "service/fixed-income/DFABIComplianceService.sol",
      "DFABIComplianceService",
      "initialize",
      { admin_: ADMIN_ADDR },
      "DFABIComplianceService"
    )
  );

  // ─── 11. ComplianceService ────────────────────────────────────────────────
  console.log("\n[11/32] ComplianceService");
  const complianceAddr = await deployOrResume(
    "CONTRACT_COMPLIANCE_SERVICE",
    "ComplianceService",
    () => deployWithInit(
      group,
      "service/asset-support/ComplianceService.sol",
      "ComplianceService",
      "initialize",
      { admin_: ADMIN_ADDR },
      "ComplianceService"
    )
  );

  // ─── 12. OracleService ────────────────────────────────────────────────────
  console.log("\n[12/32] OracleService");
  const oracleAddr = await deployOrResume(
    "CONTRACT_ORACLE_SERVICE",
    "OracleService",
    () => deployWithInit(
      group,
      "service/asset-support/OracleService.sol",
      "OracleService",
      "initialize",
      { admin_: ADMIN_ADDR },
      "OracleService"
    )
  );

  // ─── 13. PolicyEngineService ──────────────────────────────────────────────
  console.log("\n[13/32] PolicyEngineService");
  const policyEngineAddr = await deployOrResume(
    "CONTRACT_POLICY_ENGINE_SERVICE",
    "PolicyEngineService",
    () => deployWithInit(
      group,
      "service/asset-support/PolicyEngineService.sol",
      "PolicyEngineService",
      "initialize",
      { policyRunner_: ethers.ZeroAddress, admin_: ADMIN_ADDR },
      "PolicyEngineService"
    )
  );

  // ─── 14. ReportingService ─────────────────────────────────────────────────
  console.log("\n[14/32] ReportingService");
  const reportingAddr = await deployOrResume(
    "CONTRACT_REPORTING_SERVICE",
    "ReportingService",
    () => deployWithInit(
      group,
      "service/asset-support/ReportingService.sol",
      "ReportingService",
      "initialize",
      { admin_: ADMIN_ADDR },
      "ReportingService"
    )
  );

  // ─── 15. ShariahComplianceService ─────────────────────────────────────────
  console.log("\n[15/32] ShariahComplianceService");
  const shariahAddr = await deployOrResume(
    "CONTRACT_SHARIAH_COMPLIANCE_SERVICE",
    "ShariahComplianceService",
    () => deployWithInit(
      group,
      "service/asset-support/ShariahComplianceService.sol",
      "ShariahComplianceService",
      "initialize",
      { admin_: ADMIN_ADDR },
      "ShariahComplianceService"
    )
  );

  // ─── 16. CBDCBalanceLimitService ──────────────────────────────────────────
  console.log("\n[16/32] CBDCBalanceLimitService");
  const balanceLimitAddr = await deployOrResume(
    "CONTRACT_CBDC_BALANCE_LIMIT_SERVICE",
    "CBDCBalanceLimitService",
    () => deployWithInit(
      group,
      "service/cbdc/CBDCBalanceLimitService.sol",
      "CBDCBalanceLimitService",
      "initialize",
      { admin_: ADMIN_ADDR },
      "CBDCBalanceLimitService"
    )
  );

  // ─── 17. CBDCDailyLimitService ────────────────────────────────────────────
  console.log("\n[17/32] CBDCDailyLimitService");
  const dailyLimitAddr = await deployOrResume(
    "CONTRACT_CBDC_DAILY_LIMIT_SERVICE",
    "CBDCDailyLimitService",
    () => deployWithInit(
      group,
      "service/cbdc/CBDCDailyLimitService.sol",
      "CBDCDailyLimitService",
      "initialize",
      { admin_: ADMIN_ADDR },
      "CBDCDailyLimitService"
    )
  );

  // ─── 18. CBDCRedemptionService ────────────────────────────────────────────
  console.log("\n[18/32] CBDCRedemptionService");
  const cbdcRedemptionAddr = await deployOrResume(
    "CONTRACT_CBDC_REDEMPTION_SERVICE",
    "CBDCRedemptionService",
    () => deployWithInit(
      group,
      "service/cbdc/CBDCRedemptionService.sol",
      "CBDCRedemptionService",
      "initialize",
      { cbToken_: cbTokenAddr, admin_: ADMIN_ADDR },
      "CBDCRedemptionService"
    )
  );

  // ─── 19. NettingService ───────────────────────────────────────────────────
  console.log("\n[19/32] NettingService");
  const nettingAddr = await deployOrResume(
    "CONTRACT_NETTING_SERVICE",
    "NettingService",
    () => deployWithInit(
      group,
      "service/asset-support/NettingService.sol",
      "NettingService",
      "initialize",
      { cbToken_: cbTokenAddr, admin_: ADMIN_ADDR },
      "NettingService"
    )
  );

  // ─── 20. CouponCalculator (no-arg constructor) ────────────────────────────
  console.log("\n[20/32] CouponCalculator");
  const couponCalculatorAddr = await deployOrResume(
    "CONTRACT_COUPON_CALCULATOR",
    "CouponCalculator",
    () => deployWithConstructor(
      group,
      "asset/fixed-income/calculators/CouponCalculator.sol",
      "CouponCalculator",
      {},
      "CouponCalculator"
    )
  );

  // ─── 21. CouponService ────────────────────────────────────────────────────
  console.log("\n[21/32] CouponService");
  const couponServiceAddr = await deployOrResume(
    "CONTRACT_COUPON_SERVICE",
    "CouponService",
    () => deployWithInit(
      group,
      "service/fixed-income/CouponService.sol",
      "CouponService",
      "initialize",
      {
        token_:            fiTokenAddr,
        lifecycle_:        lifecycleAddr,
        cbToken_:          cbTokenAddr,
        returnCalculator_: couponCalculatorAddr,
        admin_:            ADMIN_ADDR,
      },
      "CouponService"
    )
  );

  // ─── 22. MaturityService ──────────────────────────────────────────────────
  console.log("\n[22/32] MaturityService");
  const maturityServiceAddr = await deployOrResume(
    "CONTRACT_MATURITY_SERVICE",
    "MaturityService",
    () => deployWithInit(
      group,
      "service/fixed-income/MaturityService.sol",
      "MaturityService",
      "initialize",
      { lifecycleManager_: lifecycleAddr, admin_: ADMIN_ADDR },
      "MaturityService"
    )
  );

  // ─── 23. MaturityOracle ───────────────────────────────────────────────────
  console.log("\n[23/32] MaturityOracle");
  const maturityOracleAddr = await deployOrResume(
    "CONTRACT_MATURITY_ORACLE",
    "MaturityOracle",
    () => deployWithInit(
      group,
      "service/fixed-income/MaturityOracle.sol",
      "MaturityOracle",
      "initialize",
      { maturityService_: maturityServiceAddr, admin_: ADMIN_ADDR },
      "MaturityOracle"
    )
  );

  // ─── 24. RedemptionService (bond) ─────────────────────────────────────────
  console.log("\n[24/32] RedemptionService (bond)");
  const redemptionServiceAddr = await deployOrResume(
    "CONTRACT_BOND_REDEMPTION_SERVICE",
    "RedemptionService",
    () => deployWithInit(
      group,
      "service/fixed-income/RedemptionService.sol",
      "RedemptionService",
      "initialize",
      {
        token_:          fiTokenAddr,
        lifecycle_:      lifecycleAddr,
        cbToken_:        cbTokenAddr,
        maturityService_: maturityServiceAddr,
        admin_:          ADMIN_ADDR,
      },
      "RedemptionService"
    )
  );

  // ─── 25. TransferService (bond) ───────────────────────────────────────────
  console.log("\n[25/32] TransferService (bond)");
  const bondTransferAddr = await deployOrResume(
    "CONTRACT_TRANSFER_SERVICE",
    "TransferService",
    () => deployWithInit(
      group,
      "service/fixed-income/TransferService.sol",
      "TransferService",
      "initialize",
      {
        token_:             fiTokenAddr,
        lifecycle_:         lifecycleAddr,
        complianceService_: dfabiComplianceAddr,
        admin_:             ADMIN_ADDR,
      },
      "TransferService"
    )
  );

  // ─── 26. CustodyService ───────────────────────────────────────────────────
  console.log("\n[26/32] CustodyService");
  const custodyAddr = await deployOrResume(
    "CONTRACT_CUSTODY_SERVICE",
    "CustodyService",
    () => deployWithInit(
      group,
      "service/fixed-income/CustodyService.sol",
      "CustodyService",
      "initialize",
      { token_: fiTokenAddr, admin_: ADMIN_ADDR },
      "CustodyService"
    )
  );

  // ─── 27. PledgeService ────────────────────────────────────────────────────
  console.log("\n[27/32] PledgeService");
  const pledgeAddr = await deployOrResume(
    "CONTRACT_PLEDGE_SERVICE",
    "PledgeService",
    () => deployWithInit(
      group,
      "service/fixed-income/PledgeService.sol",
      "PledgeService",
      "initialize",
      { token_: fiTokenAddr, lifecycle_: lifecycleAddr, admin_: ADMIN_ADDR },
      "PledgeService"
    )
  );

  // ─── 28. RepoService ──────────────────────────────────────────────────────
  console.log("\n[28/32] RepoService");
  const repoAddr = await deployOrResume(
    "CONTRACT_REPO_SERVICE",
    "RepoService",
    () => deployWithInit(
      group,
      "service/fixed-income/RepoService.sol",
      "RepoService",
      "initialize",
      { token_: fiTokenAddr, lifecycle_: lifecycleAddr, cbToken_: cbTokenAddr, admin_: ADMIN_ADDR },
      "RepoService"
    )
  );

  // ─── 29. SecuritiesLendingService ─────────────────────────────────────────
  console.log("\n[29/32] SecuritiesLendingService");
  const slbAddr = await deployOrResume(
    "CONTRACT_SECURITIES_LENDING_SERVICE",
    "SecuritiesLendingService",
    () => deployWithInit(
      group,
      "service/fixed-income/SecuritiesLendingService.sol",
      "SecuritiesLendingService",
      "initialize",
      { token_: fiTokenAddr, lifecycle_: lifecycleAddr, cbToken_: cbTokenAddr, admin_: ADMIN_ADDR },
      "SecuritiesLendingService"
    )
  );

  // ─── 30. CorporateActionService ───────────────────────────────────────────
  console.log("\n[30/32] CorporateActionService");
  const corpActionAddr = await deployOrResume(
    "CONTRACT_CORPORATE_ACTION_SERVICE",
    "CorporateActionService",
    () => deployWithInit(
      group,
      "service/fixed-income/CorporateActionService.sol",
      "CorporateActionService",
      "initialize",
      { token_: fiTokenAddr, lifecycle_: lifecycleAddr, cbToken_: cbTokenAddr, admin_: ADMIN_ADDR },
      "CorporateActionService"
    )
  );

  // ─── 31. AssetRegistry (no-arg constructor) ───────────────────────────────
  console.log("\n[31/32] AssetRegistry");
  const assetRegistryAddr = await deployOrResume(
    "CONTRACT_ASSET_REGISTRY",
    "AssetRegistry",
    () => deployWithConstructor(
      group,
      "asset/AssetRegistry.sol",
      "AssetRegistry",
      {},
      "AssetRegistry"
    )
  );

  // ─── 32. TokenGatewayService ──────────────────────────────────────────────
  console.log("\n[32/32] TokenGatewayService");
  const tokenGatewayAddr = await deployOrResume(
    "CONTRACT_CBDC_TOKEN_GATEWAY_SERVICE",
    "TokenGatewayService",
    () => deployWithInit(
      group,
      "service/asset-support/TokenGatewayService.sol",
      "TokenGatewayService",
      "initialize",
      { assetRegistry_: assetRegistryAddr, admin_: ADMIN_ADDR },
      "TokenGatewayService"
    )
  );

  // ─── Role wiring ──────────────────────────────────────────────────────────
  console.log("\n[roles] Wiring RBAC...");

  const MINTER_ROLE            = ethers.id("MINTER_ROLE");
  const BURNER_ROLE            = ethers.id("BURNER_ROLE");
  const OPERATOR_ROLE          = ethers.id("OPERATOR_ROLE");
  const ISSUER_ROLE            = ethers.id("ISSUER_ROLE");
  const LIFECYCLE_MANAGER_ROLE = ethers.id("LIFECYCLE_MANAGER_ROLE");
  const SETTLEMENT_ROLE        = ethers.id("SETTLEMENT_ROLE");
  const REDEEMER_ROLE          = ethers.id("REDEEMER_ROLE");

  // CBToken: IssuanceService gets MINTER_ROLE + BURNER_ROLE
  await grantRole(group, cbTokenAddr, MINTER_ROLE, issuanceAddr,         "CBToken.MINTER → cbdcIssuance");
  await grantRole(group, cbTokenAddr, BURNER_ROLE, issuanceAddr,         "CBToken.BURNER → cbdcIssuance");
  // CBToken: CBDCTransferService gets MINTER_ROLE (operator transfers via mint+burn)
  await grantRole(group, cbTokenAddr, MINTER_ROLE, transferAddr,         "CBToken.MINTER → cbdcTransfer");
  // CBToken: CouponService needs to transfer CBDC for coupon payments
  await grantRole(group, cbTokenAddr, MINTER_ROLE, couponServiceAddr,    "CBToken.MINTER → couponService");
  // CBToken: RedemptionService needs to transfer CBDC for bond redemption payouts
  await grantRole(group, cbTokenAddr, MINTER_ROLE, redemptionServiceAddr,"CBToken.MINTER → redemptionService");
  // CBToken: CBDCRedemptionService needs REDEEMER_ROLE (it manages CBDC redemptions)
  await grantRole(group, cbTokenAddr, REDEEMER_ROLE, cbdcRedemptionAddr, "CBToken.REDEEMER → cbdcRedemption");

  // FixedIncomeToken: lifecycle, dvp, bondIssuance, transferService, pledgeService, repoService, slbService, corpAction, redemptionService
  await grantRole(group, fiTokenAddr, OPERATOR_ROLE, lifecycleAddr,      "FIToken.OPERATOR → lifecycle");
  await grantRole(group, fiTokenAddr, OPERATOR_ROLE, dvpAddr,            "FIToken.OPERATOR → dvp");
  await grantRole(group, fiTokenAddr, ISSUER_ROLE,   bondIssuanceAddr,   "FIToken.ISSUER → bondIssuance");
  await grantRole(group, fiTokenAddr, OPERATOR_ROLE, bondTransferAddr,   "FIToken.OPERATOR → transferService");
  await grantRole(group, fiTokenAddr, OPERATOR_ROLE, pledgeAddr,         "FIToken.OPERATOR → pledgeService");
  await grantRole(group, fiTokenAddr, OPERATOR_ROLE, repoAddr,           "FIToken.OPERATOR → repoService");
  await grantRole(group, fiTokenAddr, OPERATOR_ROLE, slbAddr,            "FIToken.OPERATOR → slbService");
  await grantRole(group, fiTokenAddr, OPERATOR_ROLE, corpActionAddr,     "FIToken.OPERATOR → corpActionService");
  await grantRole(group, fiTokenAddr, OPERATOR_ROLE, redemptionServiceAddr, "FIToken.OPERATOR → redemptionService");

  // LifecycleManager: bondIssuance + dvp + maturityService + redemptionService + pledgeService + repoService + slbService + corpAction + transferService
  await grantRole(group, lifecycleAddr, LIFECYCLE_MANAGER_ROLE, bondIssuanceAddr,    "Lifecycle.LM → bondIssuance");
  await grantRole(group, lifecycleAddr, LIFECYCLE_MANAGER_ROLE, dvpAddr,             "Lifecycle.LM → dvp");
  await grantRole(group, lifecycleAddr, LIFECYCLE_MANAGER_ROLE, maturityServiceAddr, "Lifecycle.LM → maturityService");
  await grantRole(group, lifecycleAddr, LIFECYCLE_MANAGER_ROLE, redemptionServiceAddr, "Lifecycle.LM → redemptionService");
  await grantRole(group, lifecycleAddr, LIFECYCLE_MANAGER_ROLE, pledgeAddr,          "Lifecycle.LM → pledgeService");
  await grantRole(group, lifecycleAddr, LIFECYCLE_MANAGER_ROLE, repoAddr,            "Lifecycle.LM → repoService");
  await grantRole(group, lifecycleAddr, LIFECYCLE_MANAGER_ROLE, slbAddr,             "Lifecycle.LM → slbService");
  await grantRole(group, lifecycleAddr, LIFECYCLE_MANAGER_ROLE, corpActionAddr,      "Lifecycle.LM → corpActionService");
  await grantRole(group, lifecycleAddr, LIFECYCLE_MANAGER_ROLE, bondTransferAddr,    "Lifecycle.LM → transferService");

  // DVPService: SETTLEMENT_ROLE to admin (CB operator)
  await grantRole(group, dvpAddr, SETTLEMENT_ROLE, ADMIN_ADDR, "DVP.SETTLEMENT → admin");

  // ─── Summary ───────────────────────────────────────────────────────────────
  console.log("\n════════════════════════════════════════");
  console.log("  CBDC CONTRACTS DEPLOYED");
  console.log("════════════════════════════════════════");
  console.log(`  Pente group:                   ${group.address}`);
  console.log(`  CBToken (DRUP):                ${cbTokenAddr}`);
  console.log(`  FixedIncomeToken (DBON):       ${fiTokenAddr}`);
  console.log(`  LifecycleManager:              ${lifecycleAddr}`);
  console.log(`  BondMetadataRegistry:          ${metaAddr}`);
  console.log(`  DVPService:                    ${dvpAddr}`);
  console.log(`  CBDCIssuanceService:           ${issuanceAddr}`);
  console.log(`  CBDCTransferService:           ${transferAddr}`);
  console.log(`  IssuanceService (bond):        ${bondIssuanceAddr}`);
  console.log(`  DFABIComplianceService:        ${dfabiComplianceAddr}`);
  console.log(`  ComplianceService:             ${complianceAddr}`);
  console.log(`  OracleService:                 ${oracleAddr}`);
  console.log(`  PolicyEngineService:           ${policyEngineAddr}`);
  console.log(`  ReportingService:              ${reportingAddr}`);
  console.log(`  ShariahComplianceService:      ${shariahAddr}`);
  console.log(`  CBDCBalanceLimitService:       ${balanceLimitAddr}`);
  console.log(`  CBDCDailyLimitService:         ${dailyLimitAddr}`);
  console.log(`  CBDCRedemptionService:         ${cbdcRedemptionAddr}`);
  console.log(`  NettingService:                ${nettingAddr}`);
  console.log(`  CouponCalculator:              ${couponCalculatorAddr}`);
  console.log(`  CouponService:                 ${couponServiceAddr}`);
  console.log(`  MaturityService:               ${maturityServiceAddr}`);
  console.log(`  MaturityOracle:                ${maturityOracleAddr}`);
  console.log(`  RedemptionService (bond):      ${redemptionServiceAddr}`);
  console.log(`  TransferService (bond):        ${bondTransferAddr}`);
  console.log(`  CustodyService:                ${custodyAddr}`);
  console.log(`  PledgeService:                 ${pledgeAddr}`);
  console.log(`  RepoService:                   ${repoAddr}`);
  console.log(`  SecuritiesLendingService:      ${slbAddr}`);
  console.log(`  CorporateActionService:        ${corpActionAddr}`);
  console.log(`  AssetRegistry:                 ${assetRegistryAddr}`);
  console.log(`  TokenGatewayService:           ${tokenGatewayAddr}`);
  console.log("\nAll addresses saved to .env.local");
}

main().catch(e => { console.error(e); process.exit(1); });
