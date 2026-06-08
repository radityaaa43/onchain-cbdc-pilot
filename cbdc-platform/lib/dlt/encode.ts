import { id, AbiCoder, solidityPackedKeccak256 } from "ethers";

const coder = AbiCoder.defaultAbiCoder();

export const stateHash = (state: string): string => id(state);
export const cbdcInitData = (name: string, symbol: string, decimals: number): string =>
  coder.encode(["string", "string", "uint8"], [name, symbol, decimals]);
export const bondInitData = (minQuota: bigint): string => coder.encode(["uint256"], [minQuota]);
export const sukukInitData = (shariahBoard: string): string => coder.encode(["address"], [shariahBoard]);

export const partition = (bondId: string, state: "PRIMARY" | "SECONDARY"): string =>
  solidityPackedKeccak256(["bytes32", "bytes32"], [bondId, stateHash(state)]);
