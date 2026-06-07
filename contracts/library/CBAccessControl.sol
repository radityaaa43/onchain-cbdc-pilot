// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract CBAccessControl is AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    bytes32 public constant BANK_ROLE = keccak256("BANK_ROLE");

    address private _pendingAdmin;
    address private _initiatingAdmin;

    event AdminTransferInitiated(address indexed currentAdmin, address indexed pendingAdmin);
    event AdminTransferCompleted(address indexed previousAdmin, address indexed newAdmin);
    event AdminTransferCancelled(address indexed cancelledAdmin);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(BURNER_ROLE, msg.sender);
    }

    /// @notice Step 1: current admin nominates a new admin.
    function transferAdmin(address newAdmin) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newAdmin != address(0), "CBAccessControl: zero address");
        _pendingAdmin = newAdmin;
        _initiatingAdmin = msg.sender;
        emit AdminTransferInitiated(msg.sender, newAdmin);
    }

    /// @notice Step 2: pending admin accepts and completes the transfer.
    function acceptAdmin() external {
        require(msg.sender == _pendingAdmin, "CBAccessControl: not pending admin");
        address previous = _initiatingAdmin;
        _pendingAdmin = address(0);
        _initiatingAdmin = address(0);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _revokeRole(DEFAULT_ADMIN_ROLE, previous);
        emit AdminTransferCompleted(previous, msg.sender);
    }

    /// @notice Current admin cancels a pending transfer.
    function cancelAdminTransfer() external onlyRole(DEFAULT_ADMIN_ROLE) {
        address cancelled = _pendingAdmin;
        require(cancelled != address(0), "CBAccessControl: no pending transfer");
        _pendingAdmin = address(0);
        _initiatingAdmin = address(0);
        emit AdminTransferCancelled(cancelled);
    }

    /// @notice Returns the address waiting to accept admin, or zero if none.
    function getPendingAdmin() external view returns (address) {
        return _pendingAdmin;
    }
}
