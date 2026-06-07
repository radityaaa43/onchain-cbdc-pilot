// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

interface ICBDCDailyLimitService {
    function setDailyLimit(address account, uint256 limit) external;
    function getDailyLimit(address account) external view returns (uint256);
    function getDailySpent(address account) external view returns (uint256);
    function checkAndRecordSpend(address account, uint256 amount) external returns (bool);
}