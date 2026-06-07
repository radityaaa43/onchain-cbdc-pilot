// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

interface ICBDCTransferService {
    function transfer(address from, address to, uint256 amount) external returns (bool);
    function batchTransfer(address from, address[] calldata recipients, uint256[] calldata amounts) external returns (bool);
}