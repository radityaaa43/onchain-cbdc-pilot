import { id, AbiCoder } from "ethers";

const coder = AbiCoder.defaultAbiCoder();

export const stateHash = (state: string): string => id(state);
export const cbdcInitData = (name: string, symbol: string, decimals: number): string =>
  coder.encode(["string", "string", "uint8"], [name, symbol, decimals]);
export const bondInitData = (minQuota: bigint): string => coder.encode(["uint256"], [minQuota]);
export const sukukInitData = (shariahBoard: string): string => coder.encode(["address"], [shariahBoard]);
