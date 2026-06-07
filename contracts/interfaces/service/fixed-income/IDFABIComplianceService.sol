// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

interface IDFABIComplianceService {
    struct TransferRestriction {
        uint256 minAmount;
        uint256 maxAmount;
    }

    function setEligible(address participant, bool eligible) external;

    function setEligibleByBond(address participant, bytes32 bondId, bool eligible) external;

    function setRestriction(bytes32 bondId, TransferRestriction calldata restriction) external;

    function checkTransfer(
        bytes32 bondId,
        address from,
        address to,
        uint256 amount
    ) external view returns (bool allowed, string memory reason);

    function checkEligibility(address participant, bytes32 bondId) external view returns (bool);
}