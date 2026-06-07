// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

interface IShariahComplianceService {
    function approveSukuk(bytes32 bondId, address shariahBoard) external;
    function getShariahApproval(bytes32 bondId) external view returns (bool approved, address board);
    function certifyProfitDistribution(bytes32 bondId, uint256 totalProfit, uint256 investorShare) external returns (bool compliant);
    function reportShariahEvent(bytes32 bondId, string calldata eventType) external;
}
