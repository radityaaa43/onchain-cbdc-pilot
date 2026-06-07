// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

interface IComplianceService {
    struct ComplianceStatus {
        bool isEligible;
        bool isSuspended;
        uint256 lastReviewDate;
        string riskCategory; // "LOW", "MEDIUM", "HIGH"
    }

    function setEligibleParticipant(address participant, bytes32 assetId, bool eligible) external;
    function isEligible(address participant, bytes32 assetId) external view returns (bool);
    function checkTransferAllowed(address from, address to, uint256 amount, bytes32 assetId) external view returns (bool, string memory);
    function reportSuspiciousActivity(address entity, string calldata reason, bytes calldata evidence) external;
    function getComplianceStatus(address entity, bytes32 assetId) external view returns (ComplianceStatus memory);
}