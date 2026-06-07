// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {IPolicy} from "../policy/IPolicy.sol";
import {ZeroAddress, ZeroAmount} from "../../library/Errors.sol";

/**
 * @title CBToken
 * @notice Wholesale CBDC token — ERC20 + RBAC + policy chain + Pausable + UUPS upgradeable.
 * @dev Deploy via ERC1967 proxy. Call initialize() once after deployment.
 * @custom:security-contact security@yourproject.xyz
 */
contract CBToken is
    Initializable,
    ERC20Upgradeable,
    PausableUpgradeable,
    AccessControlUpgradeable,
    UUPSUpgradeable
{
    // ──────────────────────────────────────────────────────
    // Roles
    // ──────────────────────────────────────────────────────
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE  = keccak256("BURNER_ROLE");
    bytes32 public constant BANK_ROLE    = keccak256("BANK_ROLE");
    bytes32 public constant PAUSER_ROLE  = keccak256("PAUSER_ROLE");

    // ──────────────────────────────────────────────────────
    // State
    // ──────────────────────────────────────────────────────
    uint8 private _customDecimals;
    IPolicy private _firstPolicy;
    address private _pendingAdmin;
    address private _initiatingAdmin;

    // ──────────────────────────────────────────────────────
    // Events
    // ──────────────────────────────────────────────────────
    event PolicyChainUpdated(address indexed firstPolicy);
    event AdminTransferInitiated(address indexed currentAdmin, address indexed pendingAdmin);
    event AdminTransferCompleted(address indexed previousAdmin, address indexed newAdmin);
    event AdminTransferCancelled(address indexed cancelledAdmin);

    // ──────────────────────────────────────────────────────
    // Constructor / Initializer
    // ──────────────────────────────────────────────────────

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the CBDC token.
     * @param name_     Token name (e.g. "Digital Rupiah")
     * @param symbol_   Token symbol (e.g. "DRUP")
     * @param decimals_ Decimal places (typically 18 or 2 for IDR)
     * @param admin_    Address that receives DEFAULT_ADMIN_ROLE, MINTER_ROLE, BURNER_ROLE
     */
    function initialize(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        address admin_
    ) external initializer {
        if (admin_ == address(0)) revert ZeroAddress();
        __ERC20_init(name_, symbol_);
        __Pausable_init();
        __AccessControl_init();

        _customDecimals = decimals_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(MINTER_ROLE, admin_);
        _grantRole(BURNER_ROLE, admin_);
        _grantRole(PAUSER_ROLE, admin_);
    }

    // ──────────────────────────────────────────────────────
    // External: Issuance & Redemption
    // ──────────────────────────────────────────────────────

    /// @notice Mint CBDC to `to`. Requires MINTER_ROLE. Blocked when paused.
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) whenNotPaused {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        _mint(to, amount);
    }

    /// @notice Burn CBDC from `from`. Requires BURNER_ROLE.
    function burn(address from, uint256 amount) external onlyRole(BURNER_ROLE) {
        if (from == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        _burn(from, amount);
    }

    // ──────────────────────────────────────────────────────
    // External: Admin (2-step rotation)
    // ──────────────────────────────────────────────────────

    /// @notice Step 1: current admin nominates a new admin.
    function transferAdmin(address newAdmin) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newAdmin == address(0)) revert ZeroAddress();
        _pendingAdmin = newAdmin;
        _initiatingAdmin = msg.sender;
        emit AdminTransferInitiated(msg.sender, newAdmin);
    }

    /// @notice Step 2: pending admin accepts and completes the transfer.
    function acceptAdmin() external {
        require(msg.sender == _pendingAdmin, "CBToken: not pending admin");
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
        require(cancelled != address(0), "CBToken: no pending transfer");
        _pendingAdmin = address(0);
        _initiatingAdmin = address(0);
        emit AdminTransferCancelled(cancelled);
    }

    /// @notice Returns the address waiting to accept admin, or zero if none.
    function getPendingAdmin() external view returns (address) {
        return _pendingAdmin;
    }

    /// @notice Pause all token transfers. Requires PAUSER_ROLE.
    function pause() external onlyRole(PAUSER_ROLE) { _pause(); }

    /// @notice Resume token transfers. Requires PAUSER_ROLE.
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }

    /// @notice Set the first policy in the transfer-enforcement chain.
    function setFirstPolicy(IPolicy firstPolicy) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _firstPolicy = firstPolicy;
        emit PolicyChainUpdated(address(firstPolicy));
    }

    function getFirstPolicy() external view returns (address) {
        return address(_firstPolicy);
    }

    // ──────────────────────────────────────────────────────
    // Overrides
    // ──────────────────────────────────────────────────────

    function decimals() public view virtual override returns (uint8) {
        return _customDecimals;
    }

    /// @dev Enforce policy chain and pause check on every transfer (except mint/burn).
    function _update(address from, address to, uint256 value) internal virtual override whenNotPaused {
        if (from != address(0) && to != address(0) && address(_firstPolicy) != address(0)) {
            _firstPolicy.check(from, to, value);
        }
        super._update(from, to, value);
    }

    /// @dev Only DEFAULT_ADMIN_ROLE can authorize an upgrade.
    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    // ──────────────────────────────────────────────────────
    // Storage gap (48 slots; 2 used by _pendingAdmin + _initiatingAdmin above)
    // ──────────────────────────────────────────────────────
    uint256[48] private __gap;
}
