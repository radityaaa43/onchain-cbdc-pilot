// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {IFixedIncomeToken} from "../../interfaces/asset/fixed-income/IFixedIncomeToken.sol";
import {ZeroAddress, CustodianNotRegistered, NotCustodianOrAdmin} from "../../library/Errors.sol";

/**
 * @title CustodyService
 * @notice Sub-account beneficial ownership tracking for custodians.
 * @custom:security-contact security@yourproject.xyz
 */
contract CustodyService is Initializable, AccessControlUpgradeable, UUPSUpgradeable {
    bytes32 public constant CUSTODY_ADMIN_ROLE = keccak256("CUSTODY_ADMIN_ROLE");

    IFixedIncomeToken public token;
    mapping(address => bool) public registeredCustodians;
    mapping(bytes32 => address) public beneficialOwner;

    uint256[50] private __gap;

    event CustodianRegistered(address custodian);
    event BeneficialOwnerSet(bytes32 bondId, address custodian, bytes32 subAccountId, address owner);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(address token_, address admin_) external initializer {
        if (token_ == address(0)) revert ZeroAddress();
        if (admin_ == address(0)) revert ZeroAddress();
        __AccessControl_init();

        token = IFixedIncomeToken(token_);
        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(CUSTODY_ADMIN_ROLE, admin_);
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    function registerCustodian(address custodian) external onlyRole(CUSTODY_ADMIN_ROLE) {
        registeredCustodians[custodian] = true;
        emit CustodianRegistered(custodian);
    }

    function setBeneficialOwner(
        bytes32 bondId,
        address custodian,
        bytes32 subAccountId,
        address owner
    ) external {
        if (!registeredCustodians[custodian]) revert CustodianNotRegistered(custodian);
        if (msg.sender != custodian && !hasRole(CUSTODY_ADMIN_ROLE, msg.sender)) revert NotCustodianOrAdmin(msg.sender);
        bytes32 key = keccak256(abi.encodePacked(bondId, custodian, subAccountId));
        beneficialOwner[key] = owner;
        emit BeneficialOwnerSet(bondId, custodian, subAccountId, owner);
    }

    function getBeneficialOwner(
        bytes32 bondId,
        address custodian,
        bytes32 subAccountId
    ) external view returns (address) {
        return beneficialOwner[keccak256(abi.encodePacked(bondId, custodian, subAccountId))];
    }

    function getCustodianHoldings(address custodian, bytes32 bondId) external view returns (uint256) {
        return token.balanceOfByBond(bondId, keccak256("SECONDARY"), custodian);
    }
}
