// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ICBDCDailyLimitService} from "../../interfaces/service/cbdc/ICBDCDailyLimitService.sol";
import {ZeroAddress} from "../../library/Errors.sol";

/**
 * @title CBDCDailyLimitService
 * @notice Per-account daily CBDC spending limits with auto-reset.
 * @custom:security-contact security@yourproject.xyz
 */
contract CBDCDailyLimitService is Initializable, AccessControlUpgradeable, UUPSUpgradeable, ICBDCDailyLimitService {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant SPENDER_ROLE = keccak256("SPENDER_ROLE");

    mapping(address => uint256) public dailyLimits;
    mapping(address => uint256) public dailySpent;
    mapping(address => uint256) public lastResetDay;

    uint256[50] private __gap;

    event DailyLimitSet(address indexed account, uint256 limit);
    event DailySpentRecorded(address indexed account, uint256 amount, uint256 remaining);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(address admin_) external initializer {
        if (admin_ == address(0)) revert ZeroAddress();
        __AccessControl_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(ADMIN_ROLE, admin_);
        _grantRole(SPENDER_ROLE, admin_);
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    function setDailyLimit(address account, uint256 limit) external onlyRole(ADMIN_ROLE) {
        dailyLimits[account] = limit;
        emit DailyLimitSet(account, limit);
    }

    function getDailyLimit(address account) external view returns (uint256) {
        return dailyLimits[account];
    }

    function getDailySpent(address account) external view returns (uint256) {
        uint256 today = block.timestamp / 1 days;
        if (lastResetDay[account] != today) return 0;
        return dailySpent[account];
    }

    function checkAndRecordSpend(address account, uint256 amount) external onlyRole(SPENDER_ROLE) returns (bool) {
        _resetIfNewDay(account);
        uint256 limit = dailyLimits[account];
        if (limit == 0) return true;
        if (dailySpent[account] + amount > limit) return false;
        dailySpent[account] += amount;
        emit DailySpentRecorded(account, amount, limit - dailySpent[account]);
        return true;
    }

    function _resetIfNewDay(address account) internal {
        uint256 today = block.timestamp / 1 days;
        if (lastResetDay[account] != today) {
            lastResetDay[account] = today;
            dailySpent[account] = 0;
        }
    }
}
