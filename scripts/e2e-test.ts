#!/usr/bin/env npx ts-node
/**
 * End-to-end test: CBDC + Digital Bond (Fixed Income) flows
 * Covers: issuance, transfer, lifecycle transition, DVP settlement
 */
import * as fs from "fs";
import PaladinClient, { PenteFactory, PentePrivacyGroup } from "@lfdecentralizedtrust/paladin-sdk";
import { ethers, JsonFragment } from "ethers";

// ── Config ──────────────────────────────────────────────────────────────────

function readEnv(key: string): string {
  for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
    if (line.startsWith(`${key}=`)) return line.slice(key.length + 1).trim();
  }
  throw new Error(`Missing ${key} in .env.local`);
}

const PALADIN_URL    = "http://localhost:31548";
const FROM           = "cbdc-pilot@node1";
const WAIT_MS        = 300_000;

const ADMIN              = readEnv("PENTE_FROM_ADDR");
const GROUP_ID           = readEnv("PENTE_GROUP_ADDRESS");
const CBTOKEN            = readEnv("CONTRACT_CBTOKEN");
const FITOKEN            = readEnv("CONTRACT_FIXED_INCOME_TOKEN");
const LIFECYCLE          = readEnv("CONTRACT_LIFECYCLE_MANAGER");
const BOND_METADATA      = readEnv("CONTRACT_BOND_METADATA_REGISTRY");
const DVP                = readEnv("CONTRACT_DVP_SERVICE");
const CBDC_ISSUANCE      = readEnv("CONTRACT_CBDC_ISSUANCE_SERVICE");
const CBDC_TRANSFER      = readEnv("CONTRACT_CBDC_TRANSFER_SERVICE");
const BOND_ISSUANCE      = readEnv("CONTRACT_BOND_ISSUANCE_SERVICE");

// ERC1400 state constants (keccak256 of name, matches contract)
const PRIMARY_STATE   = ethers.id("PRIMARY");
const SECONDARY_STATE = ethers.id("SECONDARY");

// ── ABI fragments ───────────────────────────────────────────────────────────

const ABI: Record<string, JsonFragment> = {
  // CBToken
  balanceOf:    { name: "balanceOf",    type: "function", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
  approve:      { name: "approve",      type: "function", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }], stateMutability: "nonpayable" },
  allowance:    { name: "allowance",    type: "function", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },

  // CBDCIssuanceService
  issue:        { name: "issue",        type: "function", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }], stateMutability: "nonpayable" },
  getIssuedTotal: { name: "getIssuedTotal", type: "function", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },

  // CBDCTransferService
  transfer:     { name: "transfer",     type: "function", inputs: [{ name: "from", type: "address" }, { name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }], stateMutability: "nonpayable" },

  // FixedIncomeToken
  computePartition: { name: "computePartition", type: "function", inputs: [{ name: "bondId", type: "bytes32" }, { name: "state", type: "bytes32" }], outputs: [{ type: "bytes32" }], stateMutability: "pure" },
  balanceOfByBond:  { name: "balanceOfByBond",  type: "function", inputs: [{ name: "bondId", type: "bytes32" }, { name: "state", type: "bytes32" }, { name: "holder", type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },

  // LifecycleManager
  registerBond:    { name: "registerBond",   type: "function", inputs: [{ name: "bond", type: "address" }, { name: "maturityDate", type: "uint256" }], outputs: [{ name: "bondId", type: "bytes32" }], stateMutability: "nonpayable" },
  getLastBondId:   { name: "getLastBondId",  type: "function", inputs: [], outputs: [{ type: "bytes32" }], stateMutability: "view" },
  transition:      { name: "transition",     type: "function", inputs: [{ name: "bondId", type: "bytes32" }, { name: "holder", type: "address" }, { name: "amount", type: "uint256" }, { name: "fromState", type: "bytes32" }, { name: "toState", type: "bytes32" }, { name: "data", type: "bytes" }], outputs: [], stateMutability: "nonpayable" },
  isMatured:       { name: "isMatured",      type: "function", inputs: [{ name: "bondId", type: "bytes32" }], outputs: [{ type: "bool" }], stateMutability: "view" },

  // IssuanceService
  issueBond:       { name: "issueBond",      type: "function", inputs: [{ name: "bondId", type: "bytes32" }, { name: "investor", type: "address" }, { name: "amount", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  getIssuedBond:   { name: "getIssuedTotal", type: "function", inputs: [{ name: "bondId", type: "bytes32" }], outputs: [{ type: "uint256" }], stateMutability: "view" },

  // DVPService
  initiateDVP:     { name: "initiateDVP", type: "function", inputs: [
    { name: "bondId",       type: "bytes32" },
    { name: "bondSeller",   type: "address" },
    { name: "bondBuyer",    type: "address" },
    { name: "bondAmount",   type: "uint256" },
    { name: "bondPartition",type: "bytes32" },
    { name: "cbdcPayer",    type: "address" },
    { name: "cbdcPayee",    type: "address" },
    { name: "cbdcAmount",   type: "uint256" },
    { name: "model",        type: "uint8"   },
  ], outputs: [{ name: "settlementId", type: "bytes32" }], stateMutability: "nonpayable" },
  confirmDVP:      { name: "confirmDVP",     type: "function", inputs: [{ name: "settlementId", type: "bytes32" }], outputs: [], stateMutability: "nonpayable" },
  getDVPStatus:    { name: "getDVPStatus",   type: "function", inputs: [{ name: "settlementId", type: "bytes32" }], outputs: [{ name: "s", type: "tuple", components: [
    { name: "settlementId",     type: "bytes32" },
    { name: "bondId",           type: "bytes32" },
    { name: "bondSeller",       type: "address" },
    { name: "bondBuyer",        type: "address" },
    { name: "bondAmount",       type: "uint256" },
    { name: "bondPartition",    type: "bytes32" },
    { name: "cbdcPayer",        type: "address" },
    { name: "cbdcPayee",        type: "address" },
    { name: "cbdcAmount",       type: "uint256" },
    { name: "model",            type: "uint8"   },
    { name: "status",           type: "uint8"   },
    { name: "createdAt",        type: "uint256" },
    { name: "settlementDeadline", type: "uint256" },
    { name: "sellerAffirmed",   type: "bool"    },
    { name: "buyerAffirmed",    type: "bool"    },
    { name: "failureReason",    type: "string"  },
  ]}], stateMutability: "view" },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

let pass = 0, fail = 0;

function check(label: string, actual: any, expected: any) {
  const a = String(actual), e = String(expected);
  if (a === e) {
    console.log(`  ✓ ${label}: ${a}`);
    pass++;
  } else {
    console.log(`  ✗ ${label}: got ${a}, expected ${e}`);
    fail++;
  }
}

async function tx(group: PentePrivacyGroup, to: string, fn: string, data: Record<string, any>) {
  const future = group.sendTransaction({ from: FROM, to, methodAbi: ABI[fn], data });
  const receipt = await future.waitForReceipt(WAIT_MS, true);
  if (!receipt?.success) throw new Error(`TX failed: ${fn} → ${JSON.stringify(receipt?.failureMessage)}`);
  return receipt;
}

async function call(group: PentePrivacyGroup, to: string, fn: string, data: Record<string, any> = {}) {
  return group.call({ from: FROM, to, methodAbi: ABI[fn], data }) as Promise<Record<string, any>>;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const paladin = new PaladinClient({ url: PALADIN_URL });
  const pente   = new PenteFactory(paladin, "pente");
  const group   = await pente.resumePrivacyGroup({ id: GROUP_ID });
  if (!group) throw new Error("Privacy group not found");

  console.log(`\n════ E2E Test: CBDC + Digital Bond ════`);
  console.log(`Admin: ${ADMIN}\n`);

  // ─── 1. CBDC Issuance ──────────────────────────────────────────────────────
  console.log("─── 1. CBDC Issuance ───");
  const CBDC_AMOUNT = 1_000_000; // 1M (decimals=2 → 10,000.00 DRUP)
  await tx(group, CBDC_ISSUANCE, "issue", { to: ADMIN, amount: CBDC_AMOUNT });
  const balRes = await call(group, CBTOKEN, "balanceOf", { account: ADMIN });
  check("CBToken.balanceOf(ADMIN) >= 1M", Number(balRes["0"]) >= CBDC_AMOUNT, true);
  const totalIssued = await call(group, CBDC_ISSUANCE, "getIssuedTotal");
  check("CBDCIssuanceService.getIssuedTotal() >= 1M", Number(totalIssued["0"]) >= CBDC_AMOUNT, true);

  // ─── 2. CBDC Transfer (operator-mediated) ──────────────────────────────────
  console.log("\n─── 2. CBDC Transfer ───");
  const TRANSFER_AMT = 100_000;
  await tx(group, CBTOKEN, "approve", { spender: CBDC_TRANSFER, amount: TRANSFER_AMT });
  const allowRes = await call(group, CBTOKEN, "allowance", { owner: ADMIN, spender: CBDC_TRANSFER });
  check("CBToken.allowance(ADMIN, transferService)", Number(allowRes["0"]), TRANSFER_AMT);
  await tx(group, CBDC_TRANSFER, "transfer", { from: ADMIN, to: ADMIN, amount: TRANSFER_AMT });
  const balAfter = await call(group, CBTOKEN, "balanceOf", { account: ADMIN });
  check("CBToken.balanceOf(ADMIN) after self-transfer >= 1M", Number(balAfter["0"]) >= CBDC_AMOUNT, true);
  console.log("  ✓ CBDCTransferService.transfer executed (self-transfer → balance unchanged)");

  // ─── 3. Bond Registration ──────────────────────────────────────────────────
  console.log("\n─── 3. Bond Registration ───");
  const MATURITY = Math.floor(Date.now() / 1000) + 365 * 24 * 3600; // 1 year from now
  await tx(group, LIFECYCLE, "registerBond", { bond: BOND_METADATA, maturityDate: MATURITY });
  const bondIdRes = await call(group, LIFECYCLE, "getLastBondId");
  const bondId = (bondIdRes["0"] ?? bondIdRes["bondId"]) as string;
  if (!bondId || bondId === "0x" + "0".repeat(64)) throw new Error(`getLastBondId returned zero/undefined: ${JSON.stringify(bondIdRes)}`);
  console.log(`  ✓ LifecycleManager.getLastBondId() non-zero: ${bondId}`);
  console.log(`  bondId: ${bondId}`);

  // ─── 4. Bond Issuance ──────────────────────────────────────────────────────
  console.log("\n─── 4. Bond Issuance ───");
  const BOND_AMOUNT = 10_000;
  await tx(group, BOND_ISSUANCE, "issueBond", { bondId, investor: ADMIN, amount: BOND_AMOUNT });
  const primaryBal = await call(group, FITOKEN, "balanceOfByBond", { bondId, state: PRIMARY_STATE, holder: ADMIN });
  check("FIToken.balanceOfByBond(PRIMARY)", Number(primaryBal["0"]), BOND_AMOUNT);
  const issuedBond = await call(group, BOND_ISSUANCE, "getIssuedBond", { bondId });
  check("IssuanceService.getIssuedTotal(bondId)", Number(issuedBond["0"]), BOND_AMOUNT);

  // ─── 5. Lifecycle Transition: PRIMARY → SECONDARY ─────────────────────────
  console.log("\n─── 5. Lifecycle Transition PRIMARY → SECONDARY ───");
  await tx(group, LIFECYCLE, "transition", {
    bondId, holder: ADMIN, amount: BOND_AMOUNT,
    fromState: PRIMARY_STATE, toState: SECONDARY_STATE, data: "0x",
  });
  const primaryAfter = await call(group, FITOKEN, "balanceOfByBond", { bondId, state: PRIMARY_STATE, holder: ADMIN });
  const secondaryBal = await call(group, FITOKEN, "balanceOfByBond", { bondId, state: SECONDARY_STATE, holder: ADMIN });
  check("FIToken PRIMARY balance after transition", Number(primaryAfter["0"]), 0);
  check("FIToken SECONDARY balance after transition", Number(secondaryBal["0"]), BOND_AMOUNT);

  // ─── 6. DVP Settlement ─────────────────────────────────────────────────────
  console.log("\n─── 6. DVP Settlement (ADMIN self-DVP) ───");
  const DVP_BOND_AMT = 1_000;
  const DVP_CBDC_AMT = 50_000;
  const SECURITIES_FIRST = 0;

  // Compute secondary partition for DVP
  const partRes = await call(group, FITOKEN, "computePartition", { bondId, state: SECONDARY_STATE });
  const secondaryPartition = partRes["0"] as string;
  console.log(`  secondary partition: ${secondaryPartition}`);

  // Approve DVPService to spend ADMIN's CBDC
  await tx(group, CBTOKEN, "approve", { spender: DVP, amount: DVP_CBDC_AMT });
  const dvpAllowance = await call(group, CBTOKEN, "allowance", { owner: ADMIN, spender: DVP });
  check("CBToken.allowance(ADMIN, DVP)", Number(dvpAllowance["0"]), DVP_CBDC_AMT);

  // Initiate DVP
  const dvpReceipt = await tx(group, DVP, "initiateDVP", {
    bondId,
    bondSeller:    ADMIN,
    bondBuyer:     ADMIN,
    bondAmount:    DVP_BOND_AMT,
    bondPartition: secondaryPartition,
    cbdcPayer:     ADMIN,
    cbdcPayee:     ADMIN,
    cbdcAmount:    DVP_CBDC_AMT,
    model:         SECURITIES_FIRST,
  });

  // Extract settlementId from DVPSettlementInitiated event (topic[1])
  const logs = (dvpReceipt as any)?.domainReceipt?.receipt?.logs ?? [];
  if (logs.length === 0) throw new Error("No logs in DVP initiate receipt");
  const settlementId = logs[0].topics[1] as string;
  console.log(`  settlementId: ${settlementId}`);
  check("settlementId non-zero", settlementId !== "0x" + "0".repeat(64), true);

  // Confirm DVP
  const confirmReceipt = await tx(group, DVP, "confirmDVP", { settlementId });
  if (!confirmReceipt?.success) throw new Error("confirmDVP failed");

  // Verify status = CONFIRMED (1)
  const dvpStatus = await call(group, DVP, "getDVPStatus", { settlementId });
  const settlement = (dvpStatus["s"] ?? dvpStatus["0"]) as any;
  const statusVal = settlement?.status;
  check("DVP status = CONFIRMED(1)", String(statusVal), "1");

  // ─── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n════ Results: ${pass} passed, ${fail} failed ════`);
  if (fail > 0) process.exit(1);
}

main().catch(e => {
  console.error("FATAL:", e.message ?? e);
  process.exit(1);
});
