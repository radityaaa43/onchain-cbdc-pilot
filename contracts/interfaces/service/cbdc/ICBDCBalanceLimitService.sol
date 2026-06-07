// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

interface ICBDCBalanceLimitService {
    function setLimit(address account, uint256 limit) external;
    function getLimit(address account) external view returns (uint256);
    function checkLimit(address account, uint256 amount) external view returns (bool);
}