// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/// @title IFixedIncomeToken
/// @notice Interface for the core ERC1400-based fixed income token primitive.
interface IFixedIncomeToken {
    function issueToPartition(bytes32 partition, address to, uint256 amount, bytes calldata data) external;
    function redeemFromPartition(bytes32 partition, address from, uint256 amount, bytes calldata data) external;
    function operatorTransferByPartition(bytes32 fromPartition, address from, address to, uint256 amount, bytes calldata data, bytes calldata operatorData) external returns (bytes32);
    function balanceOfByBond(bytes32 bondId, bytes32 lifecycleState, address holder) external view returns (uint256);
    function computePartition(bytes32 bondId, bytes32 lifecycleState) external pure returns (bytes32);
    function totalSupplyByBond(bytes32 bondId, bytes32 lifecycleState) external view returns (uint256);
    function totalSupplyByPartition(bytes32 partition) external view returns (uint256);
}