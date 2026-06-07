// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

interface ICBDCIssuanceService {
    function issue(address to, uint256 amount) external returns (bool);
    function batchIssue(address[] calldata recipients, uint256[] calldata amounts) external returns (bool);
    function getIssuedTotal() external view returns (uint256);
}