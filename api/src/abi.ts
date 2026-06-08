import { JsonFragment } from "ethers";

export const ABI: Record<string, JsonFragment> = {
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
  computePartition:  { name: "computePartition",  type: "function", inputs: [{ name: "bondId", type: "bytes32" }, { name: "state", type: "bytes32" }], outputs: [{ type: "bytes32" }], stateMutability: "pure" },
  balanceOfByBond:   { name: "balanceOfByBond",   type: "function", inputs: [{ name: "bondId", type: "bytes32" }, { name: "state", type: "bytes32" }, { name: "holder", type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },

  // LifecycleManager
  registerBond: { name: "registerBond", type: "function", inputs: [{ name: "bond", type: "address" }, { name: "maturityDate", type: "uint256" }], outputs: [{ name: "bondId", type: "bytes32" }], stateMutability: "nonpayable" },
  getLastBondId: { name: "getLastBondId", type: "function", inputs: [], outputs: [{ name: "bondId", type: "bytes32" }], stateMutability: "view" },
  transition:   { name: "transition",   type: "function", inputs: [{ name: "bondId", type: "bytes32" }, { name: "holder", type: "address" }, { name: "amount", type: "uint256" }, { name: "fromState", type: "bytes32" }, { name: "toState", type: "bytes32" }, { name: "data", type: "bytes" }], outputs: [], stateMutability: "nonpayable" },
  isMatured:    { name: "isMatured",    type: "function", inputs: [{ name: "bondId", type: "bytes32" }], outputs: [{ type: "bool" }], stateMutability: "view" },

  // IssuanceService (bond)
  issueBond:    { name: "issueBond",    type: "function", inputs: [{ name: "bondId", type: "bytes32" }, { name: "investor", type: "address" }, { name: "amount", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  getIssuedBond: { name: "getIssuedTotal", type: "function", inputs: [{ name: "bondId", type: "bytes32" }], outputs: [{ type: "uint256" }], stateMutability: "view" },

  // CBDCRedemptionService
  requestRedemption:     { name: "requestRedemption",     type: "function", inputs: [{ name: "user", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "requestId", type: "bytes32" }], stateMutability: "nonpayable" },
  processRedemption:     { name: "processRedemption",     type: "function", inputs: [{ name: "requestId", type: "bytes32" }], outputs: [], stateMutability: "nonpayable" },
  redeem:                { name: "redeem",                type: "function", inputs: [{ name: "account", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }], stateMutability: "nonpayable" },
  batchRedeem:           { name: "batchRedeem",           type: "function", inputs: [{ name: "accounts", type: "address[]" }, { name: "amounts", type: "uint256[]" }], outputs: [{ type: "bool" }], stateMutability: "nonpayable" },
  getRedemptionRequest:  { name: "getRedemptionRequest",  type: "function", inputs: [{ name: "requestId", type: "bytes32" }], outputs: [{ name: "user", type: "address" }, { name: "amount", type: "uint256" }, { name: "processed", type: "bool" }, { name: "timestamp", type: "uint256" }], stateMutability: "view" },
  getCompletedRedemptions: { name: "getCompletedRedemptions", type: "function", inputs: [{ name: "user", type: "address" }], outputs: [{ type: "bytes32[]" }], stateMutability: "view" },
  getRedemptionTotal:    { name: "getRedemptionTotal",    type: "function", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },

  // CBDCBalanceLimitService
  setLimit:   { name: "setLimit",   type: "function", inputs: [{ name: "account", type: "address" }, { name: "limit", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  getLimit:   { name: "getLimit",   type: "function", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
  checkLimit: { name: "checkLimit", type: "function", inputs: [{ name: "account", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }], stateMutability: "view" },

  // CBDCDailyLimitService
  setDailyLimit:        { name: "setDailyLimit",        type: "function", inputs: [{ name: "account", type: "address" }, { name: "limit", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  getDailyLimit:        { name: "getDailyLimit",        type: "function", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
  getDailySpent:        { name: "getDailySpent",        type: "function", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
  checkAndRecordSpend:  { name: "checkAndRecordSpend",  type: "function", inputs: [{ name: "account", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }], stateMutability: "nonpayable" },

  // DVPService
  initiateDVP:  { name: "initiateDVP", type: "function", inputs: [
    { name: "bondId",        type: "bytes32" },
    { name: "bondSeller",    type: "address" },
    { name: "bondBuyer",     type: "address" },
    { name: "bondAmount",    type: "uint256" },
    { name: "bondPartition", type: "bytes32" },
    { name: "cbdcPayer",     type: "address" },
    { name: "cbdcPayee",     type: "address" },
    { name: "cbdcAmount",    type: "uint256" },
    { name: "model",         type: "uint8"   },
  ], outputs: [{ name: "settlementId", type: "bytes32" }], stateMutability: "nonpayable" },
  confirmDVP:   { name: "confirmDVP",  type: "function", inputs: [{ name: "settlementId", type: "bytes32" }], outputs: [], stateMutability: "nonpayable" },
  failDVP:      { name: "failDVP",     type: "function", inputs: [{ name: "settlementId", type: "bytes32" }, { name: "reason", type: "string" }], outputs: [], stateMutability: "nonpayable" },
  cancelDVP:    { name: "cancelDVP",   type: "function", inputs: [{ name: "settlementId", type: "bytes32" }, { name: "reason", type: "string" }], outputs: [], stateMutability: "nonpayable" },
  getDVPStatus: { name: "getDVPStatus", type: "function", inputs: [{ name: "settlementId", type: "bytes32" }], outputs: [{ name: "s", type: "tuple", components: [
    { name: "settlementId",      type: "bytes32" },
    { name: "bondId",            type: "bytes32" },
    { name: "bondSeller",        type: "address" },
    { name: "bondBuyer",         type: "address" },
    { name: "bondAmount",        type: "uint256" },
    { name: "bondPartition",     type: "bytes32" },
    { name: "cbdcPayer",         type: "address" },
    { name: "cbdcPayee",         type: "address" },
    { name: "cbdcAmount",        type: "uint256" },
    { name: "model",             type: "uint8"   },
    { name: "status",            type: "uint8"   },
    { name: "createdAt",         type: "uint256" },
    { name: "settlementDeadline",type: "uint256" },
    { name: "sellerAffirmed",    type: "bool"    },
    { name: "buyerAffirmed",     type: "bool"    },
    { name: "failureReason",     type: "string"  },
  ]}], stateMutability: "view" },

  // CustodyService
  registerCustodian:   { name: "registerCustodian",   type: "function", inputs: [{ name: "custodian", type: "address" }], outputs: [], stateMutability: "nonpayable" },
  setBeneficialOwner:  { name: "setBeneficialOwner",  type: "function", inputs: [{ name: "bondId", type: "bytes32" }, { name: "custodian", type: "address" }, { name: "subAccountId", type: "bytes32" }, { name: "owner", type: "address" }], outputs: [], stateMutability: "nonpayable" },
  getBeneficialOwner:  { name: "getBeneficialOwner",  type: "function", inputs: [{ name: "bondId", type: "bytes32" }, { name: "custodian", type: "address" }, { name: "subAccountId", type: "bytes32" }], outputs: [{ name: "", type: "address" }], stateMutability: "view" },
  getCustodianHoldings: { name: "getCustodianHoldings", type: "function", inputs: [{ name: "custodian", type: "address" }, { name: "bondId", type: "bytes32" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },

  // PledgeService
  createPledge:    { name: "createPledge",    type: "function", inputs: [{ name: "bondId", type: "bytes32" }, { name: "pledgor", type: "address" }, { name: "pledgee", type: "address" }, { name: "amount", type: "uint256" }, { name: "expiryDate", type: "uint256" }], outputs: [{ name: "pledgeId", type: "bytes32" }], stateMutability: "nonpayable" },
  createPledgeV2:  { name: "createPledgeV2",  type: "function", inputs: [{ name: "bondId", type: "bytes32" }, { name: "pledgor", type: "address" }, { name: "pledgee", type: "address" }, { name: "amount", type: "uint256" }, { name: "expiryDate", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  getLastPledgeId: { name: "getLastPledgeId", type: "function", inputs: [], outputs: [{ name: "", type: "bytes32" }], stateMutability: "view" },
  releasePledge:   { name: "releasePledge",   type: "function", inputs: [{ name: "pledgeId", type: "bytes32" }], outputs: [], stateMutability: "nonpayable" },
  enforcePledge:   { name: "enforcePledge",   type: "function", inputs: [{ name: "pledgeId", type: "bytes32" }], outputs: [], stateMutability: "nonpayable" },
  getPledge:       { name: "getPledge",       type: "function", inputs: [{ name: "pledgeId", type: "bytes32" }], outputs: [{ name: "", type: "tuple", components: [{ name: "bondId", type: "bytes32" }, { name: "pledgor", type: "address" }, { name: "pledgee", type: "address" }, { name: "amount", type: "uint256" }, { name: "expiryDate", type: "uint256" }, { name: "status", type: "uint8" }] }], stateMutability: "view" },

  // RepoService
  initiateRepo:            { name: "initiateRepo",            type: "function", inputs: [{ name: "bondId", type: "bytes32" }, { name: "seller", type: "address" }, { name: "buyer", type: "address" }, { name: "amount", type: "uint256" }, { name: "repoRate", type: "uint256" }, { name: "tenor", type: "uint256" }], outputs: [{ name: "repoId", type: "bytes32" }], stateMutability: "nonpayable" },
  initiateRepoWithHaircut: { name: "initiateRepoWithHaircut", type: "function", inputs: [{ name: "bondId", type: "bytes32" }, { name: "seller", type: "address" }, { name: "buyer", type: "address" }, { name: "amount", type: "uint256" }, { name: "repoRate", type: "uint256" }, { name: "tenor", type: "uint256" }, { name: "marketPrice", type: "uint256" }, { name: "haircut", type: "uint256" }, { name: "marginCallThreshold", type: "uint256" }], outputs: [{ name: "repoId", type: "bytes32" }], stateMutability: "nonpayable" },
  initiateRepoV2:          { name: "initiateRepoV2",          type: "function", inputs: [{ name: "bondId", type: "bytes32" }, { name: "seller", type: "address" }, { name: "buyer", type: "address" }, { name: "amount", type: "uint256" }, { name: "repoRate", type: "uint256" }, { name: "tenor", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  consentEarlyTermination: { name: "consentEarlyTermination", type: "function", inputs: [{ name: "repoId", type: "bytes32" }], outputs: [], stateMutability: "nonpayable" },
  terminateRepoEarly:      { name: "terminateRepoEarly",      type: "function", inputs: [{ name: "repoId", type: "bytes32" }], outputs: [], stateMutability: "nonpayable" },
  unwindRepo:              { name: "unwindRepo",              type: "function", inputs: [{ name: "repoId", type: "bytes32" }], outputs: [], stateMutability: "nonpayable" },
  getLastRepoId:           { name: "getLastRepoId",           type: "function", inputs: [], outputs: [{ name: "", type: "bytes32" }], stateMutability: "view" },
  getRepo:                 { name: "getRepo",                 type: "function", inputs: [{ name: "repoId", type: "bytes32" }], outputs: [{ name: "", type: "tuple", components: [{ name: "bondId", type: "bytes32" }, { name: "seller", type: "address" }, { name: "buyer", type: "address" }, { name: "amount", type: "uint256" }, { name: "repoRate", type: "uint256" }, { name: "haircut", type: "uint256" }, { name: "purchasePrice", type: "uint256" }, { name: "repurchasePrice", type: "uint256" }, { name: "tenor", type: "uint256" }, { name: "startDate", type: "uint256" }, { name: "endDate", type: "uint256" }, { name: "status", type: "uint8" }, { name: "sellerConsentEarlyTermination", type: "bool" }, { name: "buyerConsentEarlyTermination", type: "bool" }, { name: "initialMarketPrice", type: "uint256" }, { name: "marginCallThreshold", type: "uint256" }, { name: "marginCallActive", type: "bool" }, { name: "marginCallDeadline", type: "uint256" }] }], stateMutability: "view" },
  initiateMarginCall:      { name: "initiateMarginCall",      type: "function", inputs: [{ name: "repoId", type: "bytes32" }, { name: "currentMarketPrice", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  respondToMarginCall:     { name: "respondToMarginCall",     type: "function", inputs: [{ name: "repoId", type: "bytes32" }, { name: "amount", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },

  // SecuritiesLendingService
  initiateLend:            { name: "initiateLend",            type: "function", inputs: [{ name: "bondId", type: "bytes32" }, { name: "lender", type: "address" }, { name: "borrower", type: "address" }, { name: "amount", type: "uint256" }, { name: "feeRateBps", type: "uint256" }, { name: "tenor", type: "uint256" }], outputs: [{ name: "lendId", type: "bytes32" }], stateMutability: "nonpayable" },
  initiateLendWithHaircut: { name: "initiateLendWithHaircut", type: "function", inputs: [{ name: "bondId", type: "bytes32" }, { name: "lender", type: "address" }, { name: "borrower", type: "address" }, { name: "amount", type: "uint256" }, { name: "feeRateBps", type: "uint256" }, { name: "tenor", type: "uint256" }, { name: "haircut", type: "uint256" }], outputs: [{ name: "lendId", type: "bytes32" }], stateMutability: "nonpayable" },
  initiateLendV2:          { name: "initiateLendV2",          type: "function", inputs: [{ name: "bondId", type: "bytes32" }, { name: "lender", type: "address" }, { name: "borrower", type: "address" }, { name: "amount", type: "uint256" }, { name: "feeRateBps", type: "uint256" }, { name: "tenor", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  getLastLendId:           { name: "getLastLendId",           type: "function", inputs: [], outputs: [{ name: "", type: "bytes32" }], stateMutability: "view" },
  returnSecurities:        { name: "returnSecurities",        type: "function", inputs: [{ name: "lendId", type: "bytes32" }], outputs: [], stateMutability: "nonpayable" },
  recallLoan:              { name: "recallLoan",              type: "function", inputs: [{ name: "lendId", type: "bytes32" }], outputs: [], stateMutability: "nonpayable" },
  defaultOnLoan:           { name: "defaultOnLoan",           type: "function", inputs: [{ name: "lendId", type: "bytes32" }], outputs: [], stateMutability: "nonpayable" },
  getLend:                 { name: "getLend",                 type: "function", inputs: [{ name: "lendId", type: "bytes32" }], outputs: [{ name: "", type: "tuple", components: [{ name: "bondId", type: "bytes32" }, { name: "lender", type: "address" }, { name: "borrower", type: "address" }, { name: "amount", type: "uint256" }, { name: "lendingFeeRateBps", type: "uint256" }, { name: "collateralAmount", type: "uint256" }, { name: "haircut", type: "uint256" }, { name: "startDate", type: "uint256" }, { name: "tenor", type: "uint256" }, { name: "recallDate", type: "uint256" }, { name: "status", type: "uint8" }] }], stateMutability: "view" },

  // DFABIComplianceService
  setEligible:        { name: "setEligible",        type: "function", inputs: [{ name: "participant", type: "address" }, { name: "eligible", type: "bool" }], outputs: [], stateMutability: "nonpayable" },
  setEligibleByBond:  { name: "setEligibleByBond",  type: "function", inputs: [{ name: "participant", type: "address" }, { name: "bondId", type: "bytes32" }, { name: "eligible", type: "bool" }], outputs: [], stateMutability: "nonpayable" },
  setRestriction:     { name: "setRestriction",     type: "function", inputs: [{ name: "bondId", type: "bytes32" }, { name: "restriction", type: "tuple", components: [{ name: "minAmount", type: "uint256" }, { name: "maxAmount", type: "uint256" }] }], outputs: [], stateMutability: "nonpayable" },
  checkTransfer:      { name: "checkTransfer",      type: "function", inputs: [{ name: "bondId", type: "bytes32" }, { name: "from", type: "address" }, { name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "allowed", type: "bool" }, { name: "reason", type: "string" }], stateMutability: "view" },
  checkEligibility:   { name: "checkEligibility",   type: "function", inputs: [{ name: "participant", type: "address" }, { name: "bondId", type: "bytes32" }], outputs: [{ name: "", type: "bool" }], stateMutability: "view" },

  // ComplianceService
  setEligibleParticipant:   { name: "setEligibleParticipant",   type: "function", inputs: [{ name: "participant", type: "address" }, { name: "assetId", type: "bytes32" }, { name: "eligible", type: "bool" }], outputs: [], stateMutability: "nonpayable" },
  isEligible:               { name: "isEligible",               type: "function", inputs: [{ name: "participant", type: "address" }, { name: "assetId", type: "bytes32" }], outputs: [{ name: "", type: "bool" }], stateMutability: "view" },
  checkTransferAllowed:     { name: "checkTransferAllowed",     type: "function", inputs: [{ name: "from", type: "address" }, { name: "to", type: "address" }, { name: "", type: "uint256" }, { name: "assetId", type: "bytes32" }], outputs: [{ name: "", type: "bool" }, { name: "", type: "string" }], stateMutability: "view" },
  reportSuspiciousActivity: { name: "reportSuspiciousActivity", type: "function", inputs: [{ name: "entity", type: "address" }, { name: "reason", type: "string" }, { name: "", type: "bytes" }], outputs: [], stateMutability: "nonpayable" },
  getComplianceStatus:      { name: "getComplianceStatus",      type: "function", inputs: [{ name: "entity", type: "address" }, { name: "assetId", type: "bytes32" }], outputs: [{ name: "", type: "tuple", components: [{ name: "isEligible", type: "bool" }, { name: "isSuspended", type: "bool" }, { name: "lastReviewDate", type: "uint256" }, { name: "riskCategory", type: "string" }] }], stateMutability: "view" },
  setParticipantSuspended:  { name: "setParticipantSuspended",  type: "function", inputs: [{ name: "participant", type: "address" }, { name: "suspended", type: "bool" }, { name: "reason", type: "string" }], outputs: [], stateMutability: "nonpayable" },
  setRiskCategory:          { name: "setRiskCategory",          type: "function", inputs: [{ name: "participant", type: "address" }, { name: "riskCategory", type: "string" }], outputs: [], stateMutability: "nonpayable" },

  // PolicyEngineService
  addPolicyRule:    { name: "addPolicyRule",    type: "function", inputs: [{ name: "ruleId", type: "bytes32" }, { name: "ruleContract", type: "address" }], outputs: [], stateMutability: "nonpayable" },
  removePolicyRule: { name: "removePolicyRule", type: "function", inputs: [{ name: "ruleId", type: "bytes32" }], outputs: [], stateMutability: "nonpayable" },
  setDefaultPolicy: { name: "setDefaultPolicy", type: "function", inputs: [{ name: "policyAddress", type: "address" }], outputs: [], stateMutability: "nonpayable" },

  // ShariahComplianceService
  approveSukuk:              { name: "approveSukuk",              type: "function", inputs: [{ name: "bondId", type: "bytes32" }, { name: "shariahBoard", type: "address" }], outputs: [], stateMutability: "nonpayable" },
  getShariahApproval:        { name: "getShariahApproval",        type: "function", inputs: [{ name: "bondId", type: "bytes32" }], outputs: [{ name: "approved", type: "bool" }, { name: "board", type: "address" }], stateMutability: "view" },
  certifyProfitDistribution: { name: "certifyProfitDistribution", type: "function", inputs: [{ name: "bondId", type: "bytes32" }, { name: "totalProfit", type: "uint256" }, { name: "investorShare", type: "uint256" }], outputs: [{ name: "compliant", type: "bool" }], stateMutability: "nonpayable" },
  reportShariahEvent:        { name: "reportShariahEvent",        type: "function", inputs: [{ name: "bondId", type: "bytes32" }, { name: "eventType", type: "string" }], outputs: [], stateMutability: "nonpayable" },
  getProfitDistribution:     { name: "getProfitDistribution",     type: "function", inputs: [{ name: "bondId", type: "bytes32" }], outputs: [{ name: "", type: "tuple", components: [{ name: "totalProfit", type: "uint256" }, { name: "investorShare", type: "uint256" }, { name: "certified", type: "bool" }, { name: "certificationTimestamp", type: "uint256" }] }], stateMutability: "view" },
  getShariahEvents:          { name: "getShariahEvents",          type: "function", inputs: [{ name: "bondId", type: "bytes32" }], outputs: [{ name: "", type: "tuple[]", components: [{ name: "eventType", type: "string" }, { name: "timestamp", type: "uint256" }, { name: "description", type: "string" }] }], stateMutability: "view" },
  isSukukApproved:           { name: "isSukukApproved",           type: "function", inputs: [{ name: "bondId", type: "bytes32" }], outputs: [{ name: "", type: "bool" }], stateMutability: "view" },

  // CBDCRedemptionService (alias)
  redeemCBDC:         { name: "redeem",       type: "function", inputs: [{ name: "account", type: "address" }, { name: "amount", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },

  // CouponService
  setCouponRate:      { name: "setCouponRate",   type: "function", inputs: [{ name: "bondId", type: "bytes32" }, { name: "rateBps", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  calculateCoupon:    { name: "calculateCoupon", type: "function", inputs: [{ name: "bondId", type: "bytes32" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
  payCoupon:          { name: "payCoupon",        type: "function", inputs: [{ name: "bondId", type: "bytes32" }, { name: "recipient", type: "address" }], outputs: [], stateMutability: "nonpayable" },
  payCouponBatch:     { name: "payCouponBatch",   type: "function", inputs: [{ name: "bondId", type: "bytes32" }], outputs: [], stateMutability: "nonpayable" },
  getCouponCount:     { name: "getCouponCount",   type: "function", inputs: [{ name: "bondId", type: "bytes32" }], outputs: [{ type: "uint256" }], stateMutability: "view" },

  // MaturityService
  setMaturityInfo:    { name: "setMaturityInfo", type: "function", inputs: [{ name: "bondId", type: "bytes32" }, { name: "maturityDate", type: "uint256" }, { name: "finalRedemptionPct", type: "uint256" }, { name: "principalAmount", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  triggerMaturity:    { name: "triggerMaturity",  type: "function", inputs: [{ name: "bondId", type: "bytes32" }], outputs: [], stateMutability: "nonpayable" },
  getMaturityInfo:    { name: "getMaturityInfo",  type: "function", inputs: [{ name: "bondId", type: "bytes32" }], outputs: [{ type: "tuple", components: [{ name: "maturityDate", type: "uint256" }, { name: "finalRedemptionPct", type: "uint256" }, { name: "principalAmount", type: "uint256" }] }], stateMutability: "view" },

  // MaturityOracle
  trackBond:            { name: "trackBond",            type: "function", inputs: [{ name: "bondId", type: "bytes32" }], outputs: [], stateMutability: "nonpayable" },
  untrackBond:          { name: "untrackBond",          type: "function", inputs: [{ name: "bondId", type: "bytes32" }], outputs: [], stateMutability: "nonpayable" },
  triggerMaturityBatch: { name: "triggerMaturityBatch", type: "function", inputs: [], outputs: [], stateMutability: "nonpayable" },
  getTrackedBonds:      { name: "getTrackedBonds",      type: "function", inputs: [], outputs: [{ type: "bytes32[]" }], stateMutability: "view" },

  // BondRedemptionService
  redeemBond:         { name: "redeem",          type: "function", inputs: [{ name: "bondId", type: "bytes32" }, { name: "holder", type: "address" }, { name: "amount", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  getRedeemedTotal:   { name: "getRedeemedTotal", type: "function", inputs: [{ name: "bondId", type: "bytes32" }], outputs: [{ type: "uint256" }], stateMutability: "view" },

  // TransferService (bond)
  transferBond:       { name: "transfer", type: "function", inputs: [{ name: "bondId", type: "bytes32" }, { name: "from", type: "address" }, { name: "to", type: "address" }, { name: "amount", type: "uint256" }, { name: "data", type: "bytes" }], outputs: [], stateMutability: "nonpayable" },

  // NettingService
  openSession:    { name: "openSession",    type: "function", inputs: [], outputs: [{ name: "sessionId", type: "bytes32" }], stateMutability: "nonpayable" },
  addEntry:       { name: "addEntry",       type: "function", inputs: [{ name: "sessionId", type: "bytes32" }, { name: "from", type: "address" }, { name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  settleSession:  { name: "settleSession",  type: "function", inputs: [{ name: "sessionId", type: "bytes32" }], outputs: [], stateMutability: "nonpayable" },
  cancelSession:  { name: "cancelSession",  type: "function", inputs: [{ name: "sessionId", type: "bytes32" }], outputs: [], stateMutability: "nonpayable" },
  getSession:     { name: "getSession",     type: "function", inputs: [{ name: "sessionId", type: "bytes32" }], outputs: [{ name: "", type: "tuple", components: [{ name: "sessionId", type: "bytes32" }, { name: "status", type: "uint8" }, { name: "createdAt", type: "uint256" }, { name: "entryCount", type: "uint256" }] }], stateMutability: "view" },
  getEntries:     { name: "getEntries",     type: "function", inputs: [{ name: "sessionId", type: "bytes32" }], outputs: [{ name: "", type: "tuple[]", components: [{ name: "from", type: "address" }, { name: "to", type: "address" }, { name: "amount", type: "uint256" }] }], stateMutability: "view" },

  // OracleService
  setRate:              { name: "setRate",              type: "function", inputs: [{ name: "bondId", type: "bytes32" }, { name: "rate", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  getRate:              { name: "getRate",              type: "function", inputs: [{ name: "bondId", type: "bytes32" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
  setPrice:             { name: "setPrice",             type: "function", inputs: [{ name: "bondId", type: "bytes32" }, { name: "price", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  getPrice:             { name: "getPrice",             type: "function", inputs: [{ name: "bondId", type: "bytes32" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
  reportCreditEvent:    { name: "reportCreditEvent",    type: "function", inputs: [{ name: "bondId", type: "bytes32" }, { name: "eventType", type: "bytes32" }, { name: "timestamp", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  getCreditEvent:       { name: "getCreditEvent",       type: "function", inputs: [{ name: "bondId", type: "bytes32" }, { name: "eventType", type: "bytes32" }], outputs: [{ type: "uint256" }], stateMutability: "view" },

  // ReportingService
  logTransaction:                { name: "logTransaction",                type: "function", inputs: [{ name: "assetId", type: "bytes32" }, { name: "from", type: "address" }, { name: "to", type: "address" }, { name: "amount", type: "uint256" }, { name: "ref", type: "bytes32" }], outputs: [], stateMutability: "nonpayable" },
  getTransactions:               { name: "getTransactions",               type: "function", inputs: [{ name: "entity", type: "address" }, { name: "fromBlock", type: "uint256" }, { name: "toBlock", type: "uint256" }], outputs: [{ name: "", type: "tuple[]", components: [{ name: "assetId", type: "bytes32" }, { name: "from", type: "address" }, { name: "to", type: "address" }, { name: "amount", type: "uint256" }, { name: "ref", type: "bytes32" }, { name: "timestamp", type: "uint256" }, { name: "blockNumber", type: "uint256" }] }], stateMutability: "view" },
  generateSAR:                   { name: "generateSAR",                   type: "function", inputs: [{ name: "entity", type: "address" }], outputs: [{ name: "reportId", type: "bytes32" }], stateMutability: "nonpayable" },
  exportTransactionLog:          { name: "exportTransactionLog",          type: "function", inputs: [{ name: "assetId", type: "bytes32" }, { name: "fromBlock", type: "uint256" }, { name: "toBlock", type: "uint256" }], outputs: [{ name: "", type: "bytes" }], stateMutability: "view" },
  exportTransactionLogPaginated: { name: "exportTransactionLogPaginated", type: "function", inputs: [{ name: "offset", type: "uint256" }, { name: "limit", type: "uint256" }], outputs: [{ name: "records", type: "tuple[]", components: [{ name: "assetId", type: "bytes32" }, { name: "from", type: "address" }, { name: "to", type: "address" }, { name: "amount", type: "uint256" }, { name: "ref", type: "bytes32" }, { name: "timestamp", type: "uint256" }, { name: "blockNumber", type: "uint256" }] }, { name: "total", type: "uint256" }], stateMutability: "view" },

  // TokenGatewayService
  createAsset:        { name: "createAsset",        type: "function", inputs: [{ name: "assetType", type: "uint8" }, { name: "assetId", type: "bytes32" }, { name: "initData", type: "bytes" }], outputs: [{ name: "assetAddress", type: "address" }], stateMutability: "nonpayable" },
  getAssetAddress:    { name: "getAssetAddress",    type: "function", inputs: [{ name: "assetId", type: "bytes32" }], outputs: [{ type: "address" }], stateMutability: "view" },
  getAssetType:       { name: "getAssetType",       type: "function", inputs: [{ name: "assetId", type: "bytes32" }], outputs: [{ type: "uint8" }], stateMutability: "view" },
  isAssetRegistered:  { name: "isAssetRegistered",  type: "function", inputs: [{ name: "assetId", type: "bytes32" }], outputs: [{ type: "bool" }], stateMutability: "view" },

  // SettlementFailureService
  reportFailure:         { name: "reportFailure",         type: "function", inputs: [{ name: "settlementId", type: "bytes32" }, { name: "reason", type: "uint8" }, { name: "details", type: "string" }], outputs: [], stateMutability: "nonpayable" },
  getFailure:            { name: "getFailure",            type: "function", inputs: [{ name: "settlementId", type: "bytes32" }], outputs: [{ name: "", type: "tuple", components: [{ name: "settlementId", type: "bytes32" }, { name: "reason", type: "uint8" }, { name: "details", type: "string" }, { name: "timestamp", type: "uint256" }, { name: "resolved", type: "bool" }] }], stateMutability: "view" },
  retrySettlement:       { name: "retrySettlement",       type: "function", inputs: [{ name: "settlementId", type: "bytes32" }], outputs: [], stateMutability: "nonpayable" },
  escalateToArbitration: { name: "escalateToArbitration", type: "function", inputs: [{ name: "settlementId", type: "bytes32" }], outputs: [], stateMutability: "nonpayable" },
  initiateBuyIn:         { name: "initiateBuyIn",         type: "function", inputs: [{ name: "settlementId", type: "bytes32" }], outputs: [], stateMutability: "nonpayable" },
  executeBuyIn:          { name: "executeBuyIn",          type: "function", inputs: [{ name: "settlementId", type: "bytes32" }, { name: "buyInAmount", type: "uint256" }, { name: "buyInPriceBps", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  getBuyIn:              { name: "getBuyIn",              type: "function", inputs: [{ name: "settlementId", type: "bytes32" }], outputs: [{ name: "", type: "tuple", components: [{ name: "initiated", type: "bool" }, { name: "executed", type: "bool" }, { name: "initiatedAt", type: "uint256" }, { name: "buyInAmount", type: "uint256" }, { name: "buyInPriceBps", type: "uint256" }, { name: "costToDefaulter", type: "uint256" }] }], stateMutability: "view" },

  // BondMetadataRegistry
  bondStaticData:          { name: "bondStaticData",          type: "function", inputs: [], outputs: [{ name: "", type: "tuple", components: [] }], stateMutability: "view" },
  bondTerms:               { name: "bondTerms",               type: "function", inputs: [], outputs: [{ name: "", type: "tuple", components: [] }], stateMutability: "view" },
  dltPlatformData:         { name: "dltPlatformData",         type: "function", inputs: [], outputs: [{ name: "", type: "tuple", components: [] }], stateMutability: "view" },
  creditEvents:            { name: "creditEvents",            type: "function", inputs: [], outputs: [{ name: "", type: "tuple", components: [] }], stateMutability: "view" },
  bondRatings:             { name: "bondRatings",             type: "function", inputs: [], outputs: [{ name: "", type: "tuple", components: [] }], stateMutability: "view" },
  indonesianMarketData:    { name: "indonesianMarketData",    type: "function", inputs: [], outputs: [{ name: "", type: "tuple", components: [] }], stateMutability: "view" },
  setBondStaticData:       { name: "setBondStaticData",       type: "function", inputs: [{ name: "data", type: "tuple", components: [] }], outputs: [], stateMutability: "nonpayable" },
  setBondTerms:            { name: "setBondTerms",            type: "function", inputs: [{ name: "data", type: "tuple", components: [] }], outputs: [], stateMutability: "nonpayable" },
  setDltPlatformData:      { name: "setDltPlatformData",      type: "function", inputs: [{ name: "data", type: "tuple", components: [] }], outputs: [], stateMutability: "nonpayable" },
  setCreditEvents:         { name: "setCreditEvents",         type: "function", inputs: [{ name: "events", type: "tuple", components: [] }], outputs: [], stateMutability: "nonpayable" },
  setBondRatings:          { name: "setBondRatings",          type: "function", inputs: [{ name: "ratings", type: "tuple", components: [] }], outputs: [], stateMutability: "nonpayable" },
  setIndonesianMarketData: { name: "setIndonesianMarketData", type: "function", inputs: [{ name: "data", type: "tuple", components: [] }], outputs: [], stateMutability: "nonpayable" },
  isSyariah:               { name: "isSyariah",               type: "function", inputs: [], outputs: [{ name: "", type: "bool" }], stateMutability: "view" },
  interestType:            { name: "interestType",            type: "function", inputs: [], outputs: [{ name: "", type: "string" }], stateMutability: "view" },

  // CouponService (additional)
  setBondDayCountConvention: { name: "setBondDayCountConvention", type: "function", inputs: [{ name: "bondId", type: "bytes32" }, { name: "convention", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  setMetadataRegistry:       { name: "setMetadataRegistry",       type: "function", inputs: [{ name: "bondId", type: "bytes32" }, { name: "registry", type: "address" }], outputs: [], stateMutability: "nonpayable" },
  getCouponStatus:           { name: "getCouponStatus",           type: "function", inputs: [{ name: "bondId", type: "bytes32" }, { name: "couponId", type: "uint256" }], outputs: [{ components: [{ name: "couponId", type: "uint256" }, { name: "bondId", type: "bytes32" }, { name: "amount", type: "uint256" }, { name: "paymentDate", type: "uint256" }, { name: "isPaid", type: "bool" }], type: "tuple" }], stateMutability: "view" },

  // MaturityService (additional)
  setRedemptionService:  { name: "setRedemptionService",  type: "function", inputs: [{ name: "redemptionService_", type: "address" }], outputs: [], stateMutability: "nonpayable" },
  getMaturedBondsCount:  { name: "getMaturedBondsCount",  type: "function", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },

  // RedemptionService (bond, additional)
  hasSufficientFunding:   { name: "hasSufficientFunding", type: "function", inputs: [{ name: "bondId", type: "bytes32" }], outputs: [{ name: "sufficient", type: "bool" }, { name: "required", type: "uint256" }, { name: "available", type: "uint256" }], stateMutability: "view" },
  bondGetRedemptionTotal: { name: "getRedemptionTotal",   type: "function", inputs: [{ name: "bondId", type: "bytes32" }], outputs: [{ type: "uint256" }], stateMutability: "view" },

  // TransferService (bond, additional)
  batchTransfer: { name: "batchTransfer", type: "function", inputs: [{ name: "bondId", type: "bytes32" }, { name: "froms", type: "address[]" }, { name: "tos", type: "address[]" }, { name: "amounts", type: "uint256[]" }], outputs: [], stateMutability: "nonpayable" },

  // CorporateActionService
  setCouponService:          { name: "setCouponService",          type: "function", inputs: [{ name: "_couponService", type: "address" }], outputs: [], stateMutability: "nonpayable" },
  scheduleCallOption:        { name: "scheduleCallOption",        type: "function", inputs: [{ name: "bondId", type: "bytes32" }, { name: "callDate", type: "uint256" }, { name: "callPriceBps", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  executeCallBatch:          { name: "executeCallBatch",          type: "function", inputs: [{ name: "bondId", type: "bytes32" }], outputs: [], stateMutability: "nonpayable" },
  executeCallBatchPaginated: { name: "executeCallBatchPaginated", type: "function", inputs: [{ name: "bondId", type: "bytes32" }, { name: "startIndex", type: "uint256" }, { name: "endIndex", type: "uint256" }], outputs: [{ name: "lastIndex", type: "uint256" }, { name: "hasMore", type: "bool" }], stateMutability: "nonpayable" },
  registerPutOption:         { name: "registerPutOption",         type: "function", inputs: [{ name: "bondId", type: "bytes32" }, { name: "putDate", type: "uint256" }, { name: "putPriceBps", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  exercisePutOption:         { name: "exercisePutOption",         type: "function", inputs: [{ name: "bondId", type: "bytes32" }, { name: "amount", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  proposeRestructuring:      { name: "proposeRestructuring",      type: "function", inputs: [{ name: "bondId", type: "bytes32" }, { name: "newCouponRateBps", type: "uint256" }, { name: "newMaturityExtDays", type: "uint256" }], outputs: [{ name: "proposalId", type: "bytes32" }], stateMutability: "nonpayable" },
  proposeRestructuringV2:    { name: "proposeRestructuringV2",    type: "function", inputs: [{ name: "bondId", type: "bytes32" }, { name: "newCouponRateBps", type: "uint256" }, { name: "newMaturityExtDays", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  approveRestructuring:      { name: "approveRestructuring",      type: "function", inputs: [{ name: "proposalId", type: "bytes32" }], outputs: [], stateMutability: "nonpayable" },
  executeRestructuring:      { name: "executeRestructuring",      type: "function", inputs: [{ name: "proposalId", type: "bytes32" }], outputs: [], stateMutability: "nonpayable" },
  rejectRestructuring:       { name: "rejectRestructuring",       type: "function", inputs: [{ name: "proposalId", type: "bytes32" }], outputs: [], stateMutability: "nonpayable" },
  scheduleTenderOffer:       { name: "scheduleTenderOffer",       type: "function", inputs: [{ name: "bondId", type: "bytes32" }, { name: "openDate", type: "uint256" }, { name: "closeDate", type: "uint256" }, { name: "tenderPriceBps", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  tenderBonds:               { name: "tenderBonds",               type: "function", inputs: [{ name: "bondId", type: "bytes32" }, { name: "amount", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  closeTenderOffer:          { name: "closeTenderOffer",          type: "function", inputs: [{ name: "bondId", type: "bytes32" }], outputs: [], stateMutability: "nonpayable" },
  proposeConsent:            { name: "proposeConsent",            type: "function", inputs: [{ name: "bondId", type: "bytes32" }, { name: "description", type: "string" }, { name: "votingDurationDays", type: "uint256" }, { name: "quorumBps", type: "uint256" }], outputs: [{ name: "proposalId", type: "bytes32" }], stateMutability: "nonpayable" },
  proposeConsentV2:          { name: "proposeConsentV2",          type: "function", inputs: [{ name: "bondId", type: "bytes32" }, { name: "votingDurationDays", type: "uint256" }, { name: "quorumBps", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  getLastProposalId:         { name: "getLastProposalId",         type: "function", inputs: [], outputs: [{ name: "", type: "bytes32" }], stateMutability: "view" },
  voteConsent:               { name: "voteConsent",               type: "function", inputs: [{ name: "proposalId", type: "bytes32" }, { name: "inFavor", type: "bool" }], outputs: [], stateMutability: "nonpayable" },
  finalizeConsent:           { name: "finalizeConsent",           type: "function", inputs: [{ name: "proposalId", type: "bytes32" }], outputs: [], stateMutability: "nonpayable" },
};