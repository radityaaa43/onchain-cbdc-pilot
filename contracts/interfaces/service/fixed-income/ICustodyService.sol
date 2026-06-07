// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

interface ICustodyService {
    function registerCustodian(address custodian) external;

    function setBeneficialOwner(
        bytes32 bondId,
        address custodian,
        bytes32 subAccountId,
        address owner
    ) external;

    function getBeneficialOwner(
        bytes32 bondId,
        address custodian,
        bytes32 subAccountId
    ) external view returns (address);

    function getCustodianHoldings(address custodian, bytes32 bondId) external view returns (uint256);
}