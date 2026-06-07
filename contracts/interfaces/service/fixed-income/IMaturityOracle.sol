// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

interface IMaturityOracle {
    function trackBond(bytes32 bondId) external;

    function untrackBond(bytes32 bondId) external;

    function triggerMaturityBatch() external;

    function getTrackedBonds() external view returns (bytes32[] memory);
}