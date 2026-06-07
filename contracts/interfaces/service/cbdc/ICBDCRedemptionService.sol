// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

interface ICBDCRedemptionService {
    function redeem(address account, uint256 amount) external returns (bool);
    function batchRedeem(address[] calldata accounts, uint256[] calldata amounts) external returns (bool);
    function getRedemptionTotal(address account) external view returns (uint256);
}