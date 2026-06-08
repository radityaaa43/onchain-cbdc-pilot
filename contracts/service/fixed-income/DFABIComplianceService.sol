// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ZeroAddress} from "../../library/Errors.sol";

/**
 * @title DFABIComplianceService
 * @notice DFABI-compliant transfer eligibility checks for bond markets.
 * @custom:security-contact security@yourproject.xyz
 */
contract DFABIComplianceService is Initializable, AccessControlUpgradeable, UUPSUpgradeable {
    bytes32 public constant COMPLIANCE_ADMIN_ROLE = keccak256("COMPLIANCE_ADMIN_ROLE");

    struct TransferRestriction {
        uint256 minAmount;
        uint256 maxAmount;
    }

    mapping(address => bool) public eligibleParticipants;
    mapping(bytes32 => TransferRestriction) public bondRestrictions;
    mapping(bytes32 => mapping(address => bool)) public eligibleByBond;

    uint256[49] private __gap;

    event EligibilitySet(address participant, bool eligible);
    event EligibilityByBondSet(bytes32 bondId, address participant, bool eligible);
    event RestrictionSet(bytes32 bondId);

    function initialize(address admin_) external initializer {
        if (admin_ == address(0)) revert ZeroAddress();
        __AccessControl_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(COMPLIANCE_ADMIN_ROLE, admin_);
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    function setEligible(address participant, bool eligible) external onlyRole(COMPLIANCE_ADMIN_ROLE) {
        eligibleParticipants[participant] = eligible;
        emit EligibilitySet(participant, eligible);
    }

    function setEligibleByBond(address participant, bytes32 bondId, bool eligible) external onlyRole(COMPLIANCE_ADMIN_ROLE) {
        eligibleByBond[bondId][participant] = eligible;
        emit EligibilityByBondSet(bondId, participant, eligible);
    }

    function setRestriction(bytes32 bondId, TransferRestriction calldata restriction) external onlyRole(COMPLIANCE_ADMIN_ROLE) {
        bondRestrictions[bondId] = restriction;
        emit RestrictionSet(bondId);
    }

    function checkTransfer(bytes32 bondId, address from, address to, uint256 amount)
        external
        view
        returns (bool allowed, string memory reason)
    {
        if (!checkEligibility(from, bondId)) return (false, "From not eligible");
        if (!checkEligibility(to, bondId)) return (false, "To not eligible");
        if (from == to) return (false, "Self transfer");
        if (amount == 0) return (false, "Zero amount");

        TransferRestriction memory restriction = bondRestrictions[bondId];
        if (restriction.minAmount > 0 && amount < restriction.minAmount) return (false, "Below min");
        if (restriction.maxAmount > 0 && amount > restriction.maxAmount) return (false, "Above max");

        return (true, "");
    }

    function checkEligibility(address participant, bytes32 bondId) public view returns (bool) {
        return eligibleByBond[bondId][participant] || eligibleParticipants[participant];
    }
}
