// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/// @title ICBToken
/// @notice Minimal interface for the CBToken settlement currency.
interface ICBToken {
    function mint(address to, uint256 amount) external returns (bool);
    function burn(address from, uint256 amount) external;
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address user) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}