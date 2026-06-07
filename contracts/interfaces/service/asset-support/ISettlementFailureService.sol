// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

interface ISettlementFailureService {
    enum FailureReason { INSUFFICIENT_FUNDS, INSUFFICIENT_SECURITIES, TIMEOUT, INVALID_PARTY }

    struct FailureInfo {
        bytes32 settlementId;
        FailureReason reason;
        string details;
        uint256 timestamp;
        bool resolved;
    }

    struct BuyInInfo {
        bool initiated;
        bool executed;
        uint256 initiatedAt;
        uint256 buyInAmount;
        uint256 buyInPriceBps;
        uint256 costToDefaulter;
    }

    function reportFailure(bytes32 settlementId, FailureReason reason, string calldata details) external;
    function getFailure(bytes32 settlementId) external view returns (FailureInfo memory);
    function retrySettlement(bytes32 settlementId) external;
    function escalateToArbitration(bytes32 settlementId) external;
    function initiateBuyIn(bytes32 settlementId) external;
    function executeBuyIn(bytes32 settlementId, uint256 buyInAmount, uint256 buyInPriceBps) external;
    function getBuyIn(bytes32 settlementId) external view returns (BuyInInfo memory);
}