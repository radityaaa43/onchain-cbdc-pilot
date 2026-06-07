// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

interface IPledgeService {
    struct PledgeInfo {
        bytes32 pledgeId;
        bytes32 bondId;
        address pledgor;
        address pledgee;
        uint256 amount;
        uint256 expiryDate;
        bool isReleased;
    }

    function createPledge(
        bytes32 bondId,
        address pledgor,
        address pledgee,
        uint256 amount,
        uint256 expiryDate
    ) external returns (bytes32 pledgeId);

    function releasePledge(bytes32 pledgeId) external;

    function enforcePledge(bytes32 pledgeId) external;

    function getPledge(bytes32 pledgeId) external view returns (PledgeInfo memory);
}