// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract SenderProbe {
    address public sender;
    constructor() { sender = msg.sender; }
}
