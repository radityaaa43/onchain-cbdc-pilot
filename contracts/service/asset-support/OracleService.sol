// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {IOracleService} from "../../interfaces/service/asset-support/IOracleService.sol";
import {ZeroAddress} from "../../library/Errors.sol";

/**
 * @title OracleService
 * @notice On-chain rate/price oracle and credit event registry for bonds.
 * @custom:security-contact security@yourproject.xyz
 */
contract OracleService is Initializable, AccessControlUpgradeable, UUPSUpgradeable, IOracleService {
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    mapping(bytes32 => uint256) private _rates;
    mapping(bytes32 => uint256) private _prices;
    mapping(bytes32 => mapping(bytes32 => uint256)) private _creditEvents;

    uint256[50] private __gap;

    event RateSet(bytes32 indexed bondId, uint256 rate);
    event PriceSet(bytes32 indexed bondId, uint256 price);
    event CreditEventReported(bytes32 indexed bondId, bytes32 indexed eventType, uint256 timestamp);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(address admin_) external initializer {
        if (admin_ == address(0)) revert ZeroAddress();
        __AccessControl_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(ORACLE_ROLE, admin_);
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    function setRate(bytes32 bondId, uint256 rate) external onlyRole(ORACLE_ROLE) {
        _rates[bondId] = rate;
        emit RateSet(bondId, rate);
    }

    function getRate(bytes32 bondId) external view returns (uint256) {
        return _rates[bondId];
    }

    function setPrice(bytes32 bondId, uint256 price) external onlyRole(ORACLE_ROLE) {
        _prices[bondId] = price;
        emit PriceSet(bondId, price);
    }

    function getPrice(bytes32 bondId) external view returns (uint256) {
        return _prices[bondId];
    }

    function reportCreditEvent(bytes32 bondId, bytes32 eventType, uint256 timestamp) external onlyRole(ORACLE_ROLE) {
        _creditEvents[bondId][eventType] = timestamp;
        emit CreditEventReported(bondId, eventType, timestamp);
    }

    function getCreditEvent(bytes32 bondId, bytes32 eventType) external view returns (uint256) {
        return _creditEvents[bondId][eventType];
    }
}
