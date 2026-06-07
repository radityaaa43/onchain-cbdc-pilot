// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

interface IReportingService {
    struct TransactionRecord {
        bytes32 assetId;
        address from;
        address to;
        uint256 amount;
        bytes32 ref;
        uint256 timestamp;
        uint256 blockNumber;
    }

    struct SARRecord {
        bytes32 reportId;
        address entity;
        uint256 timestamp;
        bool filed;
    }

    function logTransaction(bytes32 assetId, address from, address to, uint256 amount, bytes32 ref) external;
    function getTransactions(address entity, uint256 fromBlock, uint256 toBlock) external view returns (TransactionRecord[] memory);
    function generateSAR(address entity) external returns (bytes32 reportId);
    function exportTransactionLog(bytes32 assetId, uint256 fromBlock, uint256 toBlock) external view returns (bytes memory);
}
