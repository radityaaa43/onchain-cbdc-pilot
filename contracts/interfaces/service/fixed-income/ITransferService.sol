// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/// @title ITransferService
/// @notice Interface for bond transfer operations with DFABI compliance
interface ITransferService {
    function transfer(
        bytes32 bondId,
        address from,
        address to,
        uint256 amount,
        bytes calldata data
    ) external;

    function batchTransfer(
        bytes32 bondId,
        address[] calldata froms,
        address[] calldata tos,
        uint256[] calldata amounts
    ) external;
}