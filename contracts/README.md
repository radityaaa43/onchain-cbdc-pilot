# Italog Smart Contracts

Smart contract layer untuk infrastruktur **Wholesale CBDC** dan **Digital Bond (Fixed Income)** Bank Indonesia. Dibangun di atas EVM-compatible blockchain (Hyperledger Besu QBFT) dengan dukungan privacy layer via Hyperledger Paladin.

---

## Gambaran Sistem

Platform ini mengimplementasikan dua aset digital yang saling terhubung:

| Aset | Standar | Deskripsi |
|---|---|---|
| **CBToken** (Wholesale CBDC) | ERC20 + UUPS | Mata uang digital bank sentral; digunakan sebagai *cash leg* pada seluruh alur settlement |
| **FixedIncomeToken** (Digital Bond) | ERC1400 + UUPS | Security token multi-seri untuk SBN, SRBI, SBSN, SPN, dan instrumen syariah (Sukuk) |

Kedua aset dihubungkan melalui mekanisme **DVP (Delivery vs. Payment)** atomik, dengan dukungan penuh untuk repo, securities lending, pledge, kustodi, dan corporate actions.

---

## Struktur Direktori

```
contracts/
├── asset/
│   ├── cbdc/
│   │   └── CBToken.sol                    # Wholesale CBDC token
│   ├── fixed-income/
│   │   ├── FixedIncomeToken.sol            # ERC1400 multi-bond security token
│   │   ├── ICMATypes.sol                   # ICMA Bond Data Taxonomy v1.2 + BI extensions
│   │   ├── BondMetadataRegistry.sol        # Metadata registri per seri obligasi
│   │   ├── LifecycleManager.sol            # State machine 8 status lifecycle obligasi
│   │   └── calculators/
│   │       ├── CouponCalculator.sol        # Fixed/floating/zero coupon
│   │       ├── ProfitSharingCalculator.sol # Sukuk Mudharabah/Wakalah
│   │       └── RentalYieldCalculator.sol   # Sukuk Ijarah
│   ├── identity/
│   │   └── EthereumDIDRegistry.sol        # uPort ethr-DID registry
│   ├── policy/
│   │   ├── IPolicy.sol                     # Interface chain-of-responsibility policy
│   │   └── rules/
│   │       ├── AuthenticatedPolicy.sol     # Gating KYC/bank authentication (TTL 90 hari)
│   │       ├── BalanceLimitPolicy.sol      # Batas saldo maksimum penerima
│   │       ├── AnonymousTransactionAmountLimitPolicy.sol
│   │       ├── AnonymousDailySpendingLimitPolicy.sol
│   │       ├── AnonymousWeeklySpendingLimitPolicy.sol
│   │       └── WeeklySpendingLimitPolicy.sol
│   └── AssetRegistry.sol                  # Registry seluruh aset yang dideploy
│
├── service/
│   ├── cbdc/
│   │   ├── CBDCIssuanceService.sol
│   │   ├── CBDCRedemptionService.sol
│   │   ├── CBDCTransferService.sol
│   │   ├── CBDCBalanceLimitService.sol
│   │   └── CBDCDailyLimitService.sol
│   ├── fixed-income/
│   │   ├── IssuanceService.sol
│   │   ├── RedemptionService.sol
│   │   ├── TransferService.sol
│   │   ├── CouponService.sol
│   │   ├── MaturityService.sol
│   │   ├── MaturityOracle.sol
│   │   ├── RepoService.sol                # ICMA GMRA
│   │   ├── SecuritiesLendingService.sol   # ISLA GMSLA
│   │   ├── PledgeService.sol
│   │   ├── CustodyService.sol
│   │   ├── CorporateActionService.sol
│   │   └── DFABIComplianceService.sol
│   └── asset-support/
│       ├── DVPService.sol                 # CPMI-IOSCO DVP
│       ├── NettingService.sol             # CPMI-IOSCO Principle 5
│       ├── SettlementFailureService.sol   # CSDR Article 7
│       ├── ComplianceService.sol
│       ├── PolicyEngineService.sol
│       ├── OracleService.sol
│       ├── ReportingService.sol
│       ├── ShariahComplianceService.sol
│       ├── TokenGatewayService.sol
│       ├── CashTokenFactory.sol
│       └── SecuritiesTokenFactory.sol
│
├── library/
│   ├── CBAccessControl.sol               # Role definitions
│   ├── Errors.sol                        # Custom errors (~100 error types)
│   └── PolicyRunner.sol                  # Abstract base policy chain executor
│
├── interfaces/                           # 31 interface contracts
│   ├── asset/
│   └── service/
│
├── universal-token/                      # ERC1400 framework
│   ├── IERC1400.sol
│   ├── extensions/
│   ├── interfaces/
│   ├── roles/
│   └── tools/
│
└── tools/
    └── DomainAware.sol                   # EIP-712 domain separator
```

---

## Arsitektur Layer

```
┌──────────────────────────────────────────────────────────────┐
│  INTERFACE LAYER  (31 interfaces)                            │
├──────────────────────────────────────────────────────────────┤
│  SERVICE LAYER                                               │
│  CBDC (5) │ Fixed Income (13) │ Asset Support (8)           │
├──────────────────────────────────────────────────────────────┤
│  ASSET / TOKEN LAYER                                         │
│  CBToken (ERC20)  │  FixedIncomeToken (ERC1400)             │
│  BondMetadataRegistry  │  AssetRegistry                     │
├──────────────────────────────────────────────────────────────┤
│  LIBRARY / INFRASTRUCTURE LAYER                              │
│  CBAccessControl │ Errors │ PolicyRunner │ LifecycleManager  │
│  ICMATypes │ ReturnCalculators │ EthereumDIDRegistry         │
└──────────────────────────────────────────────────────────────┘
```

---

## CBToken — Wholesale CBDC

### Desain Token

- **Standar:** ERC20 Upgradeable (UUPS/ERC1967)
- **Desimal:** Konfigurabel saat inisialisasi (mendukung IDR 2dp)
- **Pausable:** Seluruh transfer diblokir saat `pause()`
- **Policy hook:** `_update()` override memanggil `IPolicy.check(from, to, amount)` pada setiap transfer non-mint/burn

### Alur Issuance

```
ISSUER_ROLE → CBDCIssuanceService.issue(to, amount)
  → CBToken.mint(to, amount)
  → policy chain DILEWATI (from == address(0))
```

### Alur Redemption

```
// Path A: request + process (2-step)
REDEEMER_ROLE → requestRedemption(user, amount) → processRedemption(requestId)

// Path B: direct burn (1-step)
REDEEMER_ROLE → redeem(account, amount)
```

### Alur Transfer

```
OPERATOR_ROLE → CBDCTransferService.transfer(from, to, amount)
  → safeTransferFrom → CBToken._update → policy chain dievaluasi
```

### Sistem Policy (Chain-of-Responsibility)

Dua tier pengguna berdasarkan status KYC:

| Tier | Policy Chain | Default Limit |
|---|---|---|
| **Anonim** | AuthenticatedPolicy → TxAmountLimit → DailyLimit → WeeklyLimit → BalanceLimit | Tx: 100rb / Harian: 1jt / Mingguan: 2jt |
| **Terautentikasi** (KYC bank) | AuthenticatedPolicy → WeeklyLimit → BalanceLimit | Mingguan: 10jt |

Bank mengautentikasi wallet via `authenticate(wallet)` — berlaku 90 hari. Limit direset secara *lazy* berdasarkan nomor hari/minggu dari `block.timestamp`.

---

## FixedIncomeToken — Digital Bond

### Desain Token

- **Standar:** ERC1400 (partitioned security token) + ERC20 Upgradeable (UUPS)
- **Multi-bond:** Satu kontrak mengelola N seri obligasi secara bersamaan
- **Partisi:** `keccak256(abi.encodePacked(bondId, lifecycleState))`
- **Akuntansi:** Custom mappings `_balancesByBondAndPartition[bondId][state][holder]` — ERC20 internal selalu 0
- **Pente-compatible:** `initializeBasic()` dan fungsi `V2` (tanpa dynamic array) untuk Hyperledger Besu Pente

### 8 Status Lifecycle

```
PRIMARY ──→ SECONDARY ──→ REPO
                │       ↘ PLEDGED
                │       ↘ LENT
                │       ↘ LOCKED
                ↓
              MATURED ──→ DEFAULTED
```

| Status | Deskripsi |
|---|---|
| `PRIMARY` | Pasca-issuance, sebelum pasar sekunder |
| `SECONDARY` | Bebas diperdagangkan |
| `REPO` | Terkunci dalam repurchase agreement |
| `PLEDGED` | Dijaminkan sebagai agunan |
| `LENT` | Dipinjamkan (securities lending) |
| `LOCKED` | Kunci administratif |
| `MATURED` | Pasca-jatuh tempo |
| `DEFAULTED` | Default — **terminal** |

### Instrumen yang Didukung

| `productCode` | Instrumen | Keterangan |
|---|---|---|
| `SRBI` | Sekuritas Rupiah Bank Indonesia | Min. kuota: 1.000.000 ether |
| `SBN` | Surat Berharga Negara | Obligasi pemerintah |
| `SBSN` | Surat Berharga Syariah Negara | Sukuk sovereign |
| `SPN` | Surat Perbendaharaan Negara | T-bills |

### Tipe Instrumen (interestType)

| Nilai | Kategori | Kalkulator |
|---|---|---|
| `Fixed`, `Floating`, `Zero` | Konvensional | `CouponCalculator` |
| `Syariah_Ijarah` | Islami — sewa aset | `RentalYieldCalculator` |
| `Syariah_Mudharabah` | Islami — bagi hasil | `ProfitSharingCalculator` |
| `Syariah_Wakalah` | Islami — wakalah | `ProfitSharingCalculator` |

**Formula return:** `amount = (base × rateBps × dayCount) / (yearBasis × 10000)`

---

## Service Layer

### CBDC Services

| Service | Fungsi Utama |
|---|---|
| `CBDCIssuanceService` | `issue`, `batchIssue` — mint CBDC ke penerima |
| `CBDCRedemptionService` | `requestRedemption`, `processRedemption`, `redeem`, `batchRedeem` |
| `CBDCTransferService` | `transfer` — operator-driven transfer dengan policy enforcement |
| `CBDCBalanceLimitService` | Registry batas saldo per akun (advisory) |
| `CBDCDailyLimitService` | Registry batas harian per akun (advisory) |

### Fixed Income Services

| Service | Fungsi Utama | Standar |
|---|---|---|
| `IssuanceService` | `issueBond`, `batchIssueBond` | — |
| `RedemptionService` | `redeem`, `batchRedeem`, `hasSufficientFunding` | — |
| `TransferService` | `transfer` dengan cek DFABI compliance | — |
| `CouponService` | `payCoupon`, `payCouponBatch` — distribusi kupon via CBDC | — |
| `MaturityService` | `triggerMaturity`, bulk lifecycle → MATURED | — |
| `MaturityOracle` | `triggerMaturityBatch` — automated maturity keeper | — |
| `RepoService` | `initiateRepo`, `unwindRepo`, margin call, early termination | ICMA GMRA |
| `SecuritiesLendingService` | `initiateLend`, `returnSecurities`, `recallLoan`, `defaultOnLoan` | ISLA GMSLA |
| `PledgeService` | `createPledge`, `releasePledge`, `enforcePledge` | — |
| `CustodyService` | Registry beneficial ownership sub-akun (omnibus) | — |
| `CorporateActionService` | Call/Put option, tender offer, restructuring, consent solicitation | — |
| `DFABIComplianceService` | Whitelist peserta + min/max transfer restriction per seri | — |

### Asset Support Services

| Service | Fungsi |
|---|---|
| `DVPService` | Delivery-vs-Payment atomik (SECURITIES_FIRST / MONEY_FIRST / PARALLEL) |
| `NettingService` | Bilateral netting CBDC antar peserta |
| `SettlementFailureService` | Recording kegagalan settlement + buy-in mechanic (CSDR Art. 7) |
| `ComplianceService` | AML/CFT — whitelist per-aset, suspend, SAR reporting |
| `ShariahComplianceService` | DSN-MUI fatwa tracking, approval Sukuk |
| `OracleService` | Harga, rate, dan credit event per obligasi |
| `ReportingService` | Audit trail transaksi on-chain |
| `TokenGatewayService` | Factory terpadu — deploy CBToken / FixedIncomeToken + registrasi aset |

---

## Alur Utama

### DVP Settlement (Bond vs CBDC)

```
1. DVPService.initiateDVP(bondId, seller, buyer, bondAmount, cbdcAmount)
2. DVPService.confirmDVP(settlementId)
   ├─ FixedIncomeToken.operatorTransferByPartition(SECONDARY, seller → buyer)
   └─ CBToken.safeTransferFrom(buyer → seller, cbdcAmount)
```

### Repo (ICMA GMRA)

```
Initiate:  buyer → seller: purchasePrice CBDC
           bond: SECONDARY → REPO
Unwind:    seller → buyer: repurchasePrice CBDC (pokok + bunga)
           bond: REPO → SECONDARY
```

### Coupon Distribution

```
PAYMENT_MANAGER_ROLE → CouponService.payCouponBatch(bondId)
  → rate resolution (override → bondTerms → default 5%)
  → totalEligible = supply(PRIMARY + SECONDARY + REPO + PLEDGED + LENT + LOCKED)
  → untuk setiap holder: cbToken.safeTransfer(holder, prorated share)
```

---

## Standar & Compliance

| Standar | Implementasi |
|---|---|
| **ERC20** | CBToken (cash leg) |
| **ERC1400** | FixedIncomeToken (partitioned security token) |
| **ERC1643** | Document management (prospektus, perjanjian) |
| **ERC1820** | Interface registry — transfer hook discovery |
| **ERC1271** | Contract signature validation (multisig, smart wallet) |
| **EIP-712** | Typed-data signing (DomainAware) |
| **uPort ethr-DID** | Ethereum DID Registry |
| **ICMA Bond Data Taxonomy v1.2** | ICMATypes.sol + BI market extensions |
| **ICMA GMRA** | RepoService |
| **ISLA GMSLA** | SecuritiesLendingService |
| **CPMI-IOSCO PFMIs** | DVPService, NettingService |
| **CSDR Article 7** | SettlementFailureService |

---

## Access Control

Semua kontrak menggunakan OpenZeppelin `AccessControlUpgradeable`. Seluruh role diberikan ke `admin_` saat inisialisasi — **wajib didelegasikan ke akun/kontrak operasional setelah deploy**.

| Role Utama | Pemegang Tipikal |
|---|---|
| `DEFAULT_ADMIN_ROLE` | Governance multisig |
| `MINTER_ROLE` | CBDCIssuanceService |
| `BURNER_ROLE` | CBDCRedemptionService |
| `ISSUER_ROLE` | IssuanceService |
| `LIFECYCLE_MANAGER_ROLE` | MaturityService, RedemptionService |
| `DEALER_ROLE` | RepoService, PledgeService |
| `SETTLEMENT_ROLE` | DVPService |
| `PAYMENT_MANAGER_ROLE` | CouponService |
| `SHARIAH_BOARD_ROLE` | Dewan Syariah National |

---

## Upgrade Pattern

Semua kontrak stateful menggunakan **UUPS (ERC1967)**:

```
1. Deploy implementasi baru
2. proxy.upgradeToAndCall(newImpl, data)
   → _authorizeUpgrade: memerlukan DEFAULT_ADMIN_ROLE
3. Storage aman via uint256[50] __gap pada setiap kontrak
```

---

## Known Issues

| Issue | Lokasi | Dampak |
|---|---|---|
| `requestId` collision same-block | `CBDCRedemptionService` | Request dengan user+amount+timestamp identik saling menimpa |
| `checkAndRecordSpend` tanpa access control | `CBDCDailyLimitService` | Siapapun bisa menghabiskan daily limit akun lain |
| 30/360 day count tidak diimplementasi | Semua kalkulator | Berperilaku sama dengan ACT/360; kupon tidak akurat untuk obligasi 30/360 |
| Sukuk dibuat tanpa `approveSukuk` atomik | `SecuritiesTokenFactory` | Approval Syariah harus dilakukan manual di transaksi terpisah |
| `_policyRules` unreachable | `PolicyEngineService` | Data diisi tapi tidak diakses dari `checkTransfer` |
| DVP ↔ SettlementFailure tidak terintegrasi | `DVPService` | `ISettlementFailureService` direferensikan tapi tidak pernah dipanggil |

---

## Integrasi dengan Onchain Dev Stack

Kontrak ini berjalan di atas infrastruktur Kubernetes yang didefinisikan di [`../onchain-dev-stack`](../onchain-dev-stack/README.md):

- **Hyperledger Besu (QBFT)** — EVM-compatible blockchain
- **Hyperledger Paladin** — Privacy layer (fungsi `V2` / `initializeBasic` untuk kompatibilitas Pente EVM)
- **Hyperledger FireFly** — Middleware multiparty untuk event streaming dan API abstraction
