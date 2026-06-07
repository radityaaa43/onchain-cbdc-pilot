// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

interface IIssuanceService {
    function issueBond(bytes32 bondId, address investor, uint256 amount) external;

    function batchIssueBond(bytes32 bondId, address[] calldata investors, uint256[] calldata amounts) external;

    function issuedAmount(bytes32 bondId) external view returns (uint256);

    function getIssuedTotal(bytes32 bondId) external view returns (uint256);
}
