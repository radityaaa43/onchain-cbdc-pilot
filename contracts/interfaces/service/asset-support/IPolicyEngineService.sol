// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

interface IPolicyEngineService {
    function checkTransfer(address from, address to, uint256 amount, bytes32 assetId) external returns (bool allowed, string memory reason);
    function addPolicyRule(bytes32 ruleId, address ruleContract) external;
    function removePolicyRule(bytes32 ruleId) external;
    function setDefaultPolicy(address policyAddress) external;
}