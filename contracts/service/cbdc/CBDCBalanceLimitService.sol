// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ICBDCBalanceLimitService} from "../../interfaces/service/cbdc/ICBDCBalanceLimitService.sol";
import {ZeroAddress} from "../../library/Errors.sol";

/**
 * @title CBDCBalanceLimitService
 * @notice Per-account CBDC balance caps.
 * @custom:security-contact security@yourproject.xyz
 */
contract CBDCBalanceLimitService is Initializable, AccessControlUpgradeable, UUPSUpgradeable, ICBDCBalanceLimitService {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    mapping(address => uint256) public balanceLimits;

    uint256[50] private __gap;

    event LimitSet(address indexed account, uint256 newLimit);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(address admin_) external initializer {
        if (admin_ == address(0)) revert ZeroAddress();
        __AccessControl_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(ADMIN_ROLE, admin_);
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    function setLimit(address account, uint256 limit) external onlyRole(ADMIN_ROLE) {
        balanceLimits[account] = limit;
        emit LimitSet(account, limit);
    }

    function getLimit(address account) external view returns (uint256) {
        return balanceLimits[account];
    }

    function checkLimit(address account, uint256 amount) external view returns (bool) {
        uint256 limit = balanceLimits[account];
        return limit == 0 || amount <= limit;
    }
}
