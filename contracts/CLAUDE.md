# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Layout

This directory (`italog/contracts/`) is the **contract source root**. The Hardhat project lives at `~/cbdc/contract/` — that's where you run all tooling commands. The `contracts/` subdirectory there is entirely symlinks pointing back here.

```
~/italog/contracts/   ← you are here (source of truth)
~/cbdc/contract/      ← Hardhat project (compile, test, deploy)
  contracts/          ← symlinks: asset→, service→, library→, interfaces→, ...
  test/               ← all tests live here
```

## Commands

Run from `~/cbdc/contract/`:

```bash
# Always use local binary — global hardhat (v3) is incompatible
node_modules/.bin/hardhat compile
node_modules/.bin/hardhat test
node_modules/.bin/hardhat test test/CBToken.test.ts          # single file
node_modules/.bin/hardhat test test/services/RepoService.test.ts
node_modules/.bin/hardhat test test/e2e/DigitalBond.e2e.ts  # full e2e
node_modules/.bin/hardhat coverage
```

Solidity 0.8.28, `evmVersion: cancun` (OZ v5 needs `mcopy`). Optimizer: 200 runs, `viaIR: true`.

## Architecture

Two parallel systems sharing one token infrastructure:

| System | Token | Standard |
|---|---|---|
| Wholesale CBDC | `CBToken` | ERC20 UUPS |
| Digital Bond / Fixed Income | `FixedIncomeToken` | ERC1400 UUPS |

They meet at: **DVPService** (atomic bond ↔ CBDC swap), **CouponService** (CBDC coupon payout), **RepoService / SecuritiesLendingService** (CBDC collateral escrow).

## UUPS Pattern (every upgradeable contract)

```solidity
/// @custom:oz-upgrades-unsafe-allow constructor
constructor() { _disableInitializers(); }

function initialize(...) external initializer { ... }
function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
uint256[50] private __gap;
```

Contracts inheriting non-upgradeable `ReentrancyGuard` need `unsafeAllow: ["constructor"]` in `upgrades.deployProxy`.

## FixedIncomeToken — Critical Mechanics

### Partition encoding

`partition = keccak256(abi.encodePacked(bondId, state))` where `state` is `keccak256("PRIMARY")`, etc.

Every partition must be registered in `_partitionToBondId` before `_decodePartition` resolves it. This happens automatically on first `issueByPartition` — but **`data` must be the `bondId` (bytes32)**, not `"0x"`.

### First issuance (mandatory pattern)

```solidity
bytes memory data = abi.encode(bondId);  // bytes32 bondId as first 32 bytes
token.issueByPartition(partition, holder, amount, data);
```

After issuance, call `lifecycle.registerHolder(bondId, holder)` so the holder appears in bulk maturity/default sweeps.

### Cross-partition transfer (lifecycle transitions)

`operatorTransferByPartition` detects a state change when `data[0..31] == bytes32(0xffff...ffff)` (PARTITION_CHANGE_FLAG). `data[32..63]` is the destination partition. `LifecycleManager.transition()` encodes this automatically — don't build the sentinel manually.

### Multi-bond accounting bypass

ERC20 internal `_totalSupply` and `_balances` are always 0. All accounting uses `_balancesByBondAndPartition[bondId][state][holder]`. `balanceOf()` and `totalSupply()` aggregate across all bonds × partitions — keep bond/holder counts bounded in permissioned deployments.

## Lifecycle State Machine

```
PRIMARY   → SECONDARY, DEFAULTED
SECONDARY → SECONDARY (cross-holder), REPO, PLEDGED, LENT, LOCKED, MATURED, DEFAULTED
REPO      → SECONDARY, DEFAULTED
PLEDGED   → SECONDARY, DEFAULTED
LENT      → SECONDARY, DEFAULTED
LOCKED    → SECONDARY, DEFAULTED
MATURED   → DEFAULTED
DEFAULTED → (terminal)
```

`LifecycleManager.transition(bondId, holder, amount, from, to, data)` — requires `LIFECYCLE_MANAGER_ROLE`.  
`LifecycleManager.crossHolderTransition(bondId, from, to, amount, fromState, toState)` — used by `PledgeService.enforcePledge` to transfer title to pledgee.

`getState` resolution priority: `DEFAULTED > MATURED > LENT > REPO > PLEDGED > LOCKED > SECONDARY > PRIMARY`.

## CBDC Policy Chain

`CBToken._update()` calls `_firstPolicy.check(from, to, amount)` on every non-mint/burn transfer. Policies **revert to block** — return values ignored. Chain linked via `setNextPolicy`.

Two tiers determined by `AuthenticatedPolicy`:
- **Anonymous**: `AuthenticatedPolicy` → `AnonymousTxAmountLimit` → `AnonymousDailySpendingLimit` → `AnonymousWeeklySpendingLimit` → `BalanceLimitPolicy`
- **Authenticated** (bank KYC, TTL 90d): skips anonymous limits → `WeeklySpendingLimitPolicy` → `BalanceLimitPolicy`

`AuthenticatedPolicy` — sender must have active auth (`bank != 0`, `timestamp + 90d > now`); recipient must have been authenticated at least once (timestamp > 0, no TTL). Banks authenticate via `authenticate(wallet)`.

Spending limits use **lazy bucket reset**: day/week number compared on each `check`; `spent` resets to 0 when the bucket advances.

## Service Contract Wiring

After deploying a service, always wire roles manually:

```solidity
// Fixed income service setup pattern
lifecycle.grantRole(LIFECYCLE_MANAGER_ROLE, service.address);
token.grantRole(OPERATOR_ROLE, service.address);       // if it calls operatorTransferByPartition
token.grantRole(ISSUER_ROLE, issuanceService.address); // if it mints

// CBDC service setup pattern
cbToken.grantRole(MINTER_ROLE, cbdcIssuanceService.address);
cbToken.grantRole(BURNER_ROLE, cbdcRedemptionService.address);
```

## Key Service Flows

### DVP Settlement

```
DVPService.confirmDVP(id):
  token.operatorTransferByPartition(SECONDARY, seller → buyer)  // bond leg
  cbToken.safeTransferFrom(buyer → seller, cbdcAmount)          // cash leg
```
Requires: buyer pre-approves DVPService on CBToken. Seller's bond in SECONDARY partition.

### Coupon Distribution

`CouponService.payCouponBatch(bondId)` — rate cascade: `couponRatesByBond[bondId]` → `bondTerms().interestRateBps` → default 500bps. Eligible supply = PRIMARY + SECONDARY + REPO + PLEDGED + LENT + LOCKED (MATURED/DEFAULTED excluded). Pro-rated per holder. Uses CEI — state updated before `safeTransfer`.

### Repo (ICMA GMRA)

```
initiateRepo:    purchasePrice = marketPrice * (10000 - haircut) / 10000
                 cbToken: buyer → seller (purchasePrice)
                 bond: SECONDARY → REPO
unwindRepo:      cbToken: seller → buyer (repurchasePrice = purchasePrice + interest)
                 bond: REPO → SECONDARY
```
`terminateRepoEarly` requires both `sellerConsents` and `buyerConsents`. `initiateMarginCall` enabled only when `marginCallThreshold > 0`.

### Securities Lending (ISLA GMSLA)

SLB haircut = overcollateralization **above** 100% (haircut=200 → 102% collateral). Contrast repo haircut = discount below 100%.

```
initiateLend:    collateral = amount * (10000 + haircut) / 10000
                 cbToken: borrower → this (escrow)
                 bond: SECONDARY → LENT
returnSecurities: fee = amount * feeRateBps * daysLent / 10000
                  cbToken: this → borrower (collateral - fee), this → lender (fee)
                  bond: LENT → SECONDARY
defaultOnLoan:   forfeits entire collateral to lender; bond → DEFAULTED
```

## Errors

All errors in `library/Errors.sol`. Tests use `.revertedWithCustomError(contract, "ErrorName")`. No `require(condition, "string")` anywhere.

## Test Structure

```
test/
├── helpers/
│   ├── constants.ts    # role hashes, partition hashes, BOND_ID_1/2, amounts
│   └── fixtures.ts     # deployFixedIncomeStack, deployCBToken, deployCBDCStack
├── services/           # per-service unit tests
│   ├── RepoService.test.ts
│   ├── CouponService.test.ts
│   └── ...
├── e2e/
│   ├── DigitalBond.e2e.ts    # full bond lifecycle end-to-end
│   └── WholesaleCBDC.e2e.ts
├── CBToken.test.ts
├── FixedIncomeToken.test.ts
├── LifecycleManager.test.ts
└── Policy.test.ts
```

Standard service test setup:
```typescript
const { token, lifecycle } = await deployFixedIncomeStack(admin);
// deploy service, wire roles
await lifecycle.grantRole(LIFECYCLE_MANAGER_ROLE, service.address);
// issue into PRIMARY (data must be bondId)
await token.issueByPartition(computePartition(BOND_ID_1, PRIMARY), holder.address, THOUSAND, BOND_ID_1);
// transition to SECONDARY before most service tests
await lifecycle.connect(admin).transition(BOND_ID_1, holder.address, THOUSAND, PRIMARY, SECONDARY, "0x");
```

All constants (`BOND_ID_1`, `PRIMARY`, `OPERATOR_ROLE`, etc.) from `test/helpers/constants.ts`.

## Known Gotchas

- **`requestId` collision**: `CBDCRedemptionService.requestRedemption` uses `keccak256(user, amount, block.timestamp)` — two identical calls in the same block overwrite each other.
- **`CBDCDailyLimitService.checkAndRecordSpend`** has no access control — any address can call it and drain an account's daily allowance.
- **30/360 day count** (index 2 in all calculators) behaves identically to ACT/360 — 30-day month normalization is missing.
- **Sukuk approval not atomic**: `SecuritiesTokenFactory.createSukukToken` validates `shariahBoard != address(0)` but does not call `ShariahComplianceService.approveSukuk` — must be done in a separate tx.
- **DVP ↔ SettlementFailure**: `DVPService` references `ISettlementFailureService` but never calls it — the failure reporting integration is a stub.
- **`PolicyEngineService._policyRules`**: populated but unreachable from `checkTransfer` — only `policyRunner` is consulted.
- **`allowanceByPartition`**: mapping exists and is readable but no `approveByPartition` function is present.
