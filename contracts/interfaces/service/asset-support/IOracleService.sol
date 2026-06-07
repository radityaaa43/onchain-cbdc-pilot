// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

interface IOracleService {
    function setRate(bytes32 bondId, uint256 rate) external;
    function getRate(bytes32 bondId) external view returns (uint256);
    function setPrice(bytes32 bondId, uint256 price) external;
    function getPrice(bytes32 bondId) external view returns (uint256);
    function reportCreditEvent(bytes32 bondId, bytes32 eventType, uint256 timestamp) external;
}
