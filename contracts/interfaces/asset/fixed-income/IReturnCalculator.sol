// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/// @title IReturnCalculator
/// @notice Pluggable interface for computing periodic returns on fixed income securities.
interface IReturnCalculator {
    struct CalculationParams {
        uint256 principal;
        uint256 rateBps;
        uint256 periodStart;
        uint256 periodEnd;
        uint256 dayCountConvention; // 0=Act/365, 1=Act/360, 2=30/360
        bytes extraData;
    }

    function calculate(CalculationParams calldata params) external view returns (uint256 amount);
    function calculatorType() external pure returns (string memory);
}