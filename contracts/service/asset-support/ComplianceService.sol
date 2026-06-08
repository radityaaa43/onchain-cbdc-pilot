// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {IComplianceService} from "../../interfaces/service/asset-support/IComplianceService.sol";
import {ZeroAddress} from "../../library/Errors.sol";

/**
 * @title ComplianceService
 * @notice AML/CFT and regulatory compliance for asset transfers.
 * @custom:security-contact security@yourproject.xyz
 */
contract ComplianceService is Initializable, AccessControlUpgradeable, UUPSUpgradeable, IComplianceService {
    bytes32 public constant COMPLIANCE_ADMIN_ROLE = keccak256("COMPLIANCE_ADMIN_ROLE");

    struct ParticipantInfo {
        bool isSuspended;
        uint256 lastReviewDate;
        string riskCategory;
    }

    mapping(address => mapping(bytes32 => bool)) private _eligibleParticipants;
    mapping(address => ParticipantInfo) private _participantInfo;

    uint256[50] private __gap;

    event ParticipantEligibilitySet(address indexed participant, bytes32 indexed assetId, bool eligible);
    event SuspiciousActivityReported(address indexed entity, string reason);
    event ParticipantSuspended(address indexed participant, string reason);
    event ParticipantUnsuspended(address indexed participant);
    event RiskCategoryChanged(address indexed participant, string category);

    function initialize(address admin_) external initializer {
        if (admin_ == address(0)) revert ZeroAddress();
        __AccessControl_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(COMPLIANCE_ADMIN_ROLE, admin_);
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    function setEligibleParticipant(address participant, bytes32 assetId, bool eligible) external onlyRole(COMPLIANCE_ADMIN_ROLE) {
        _eligibleParticipants[participant][assetId] = eligible;
        _participantInfo[participant].lastReviewDate = 0;
        emit ParticipantEligibilitySet(participant, assetId, eligible);
    }

    function isEligible(address participant, bytes32 assetId) external view returns (bool) {
        return _eligibleParticipants[participant][assetId];
    }

    function checkTransferAllowed(address from, address to, uint256, bytes32 assetId)
        external
        view
        returns (bool, string memory)
    {
        if (!_eligibleParticipants[from][assetId] || !_eligibleParticipants[to][assetId]) {
            return (false, "Participant not eligible");
        }
        if (_participantInfo[from].isSuspended || _participantInfo[to].isSuspended) {
            return (false, "Participant suspended");
        }
        return (true, "");
    }

    function reportSuspiciousActivity(address entity, string calldata reason, bytes calldata)
        external
        onlyRole(COMPLIANCE_ADMIN_ROLE)
    {
        emit SuspiciousActivityReported(entity, reason);
    }

    function getComplianceStatus(address entity, bytes32 assetId) external view returns (ComplianceStatus memory) {
        ParticipantInfo storage info = _participantInfo[entity];
        return ComplianceStatus({
            isEligible: _eligibleParticipants[entity][assetId],
            isSuspended: info.isSuspended,
            lastReviewDate: info.lastReviewDate,
            riskCategory: info.riskCategory
        });
    }

    function setParticipantSuspended(address participant, bool suspended, string calldata reason)
        external
        onlyRole(COMPLIANCE_ADMIN_ROLE)
    {
        _participantInfo[participant].isSuspended = suspended;
        if (suspended) {
            emit ParticipantSuspended(participant, reason);
        } else {
            emit ParticipantUnsuspended(participant);
        }
    }

    function setRiskCategory(address participant, string calldata riskCategory)
        external
        onlyRole(COMPLIANCE_ADMIN_ROLE)
    {
        _participantInfo[participant].riskCategory = riskCategory;
        emit RiskCategoryChanged(participant, riskCategory);
    }
}
