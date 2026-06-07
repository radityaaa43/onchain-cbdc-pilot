// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/// @title IMaturityService
/// @notice Interface for bond maturity management
interface IMaturityService {
    struct MaturityInfo {
        bytes32 bondId;
        uint256 maturityDate;
        uint256 finalRedemptionPct;
        uint256 principalAmount;
        bool isTriggered;
    }

    function setMaturityInfo(
        bytes32 bondId,
        uint256 maturityDate,
        uint256 finalRedemptionPct,
        uint256 principalAmount
    ) external;

    function triggerMaturity(bytes32 bondId) external;

    function getMaturityInfo(bytes32 bondId) external view returns (MaturityInfo memory);

    function isMatured(bytes32 bondId) external view returns (bool);

    function getMaturedBondsCount() external view returns (uint256);
}