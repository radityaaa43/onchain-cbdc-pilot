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
};
