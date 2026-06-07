// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {IShariahComplianceService} from "../../interfaces/service/asset-support/IShariahComplianceService.sol";
import {ZeroAddress, SukukNotShariahApproved, InvestorShareExceedsProfit} from "../../library/Errors.sol";

/**
 * @title ShariahComplianceService
 * @notice DSN-MUI fatwa reference tracking for Sukuk structures.
 *         Records Shariah board approvals and certifies profit distributions.
 * @custom:security-contact security@yourproject.xyz
 */
contract ShariahComplianceService is Initializable, AccessControlUpgradeable, UUPSUpgradeable, IShariahComplianceService {
    bytes32 public constant SHARIAH_BOARD_ROLE = keccak256("SHARIAH_BOARD_ROLE");

    struct ShariahApproval {
        bool approved;
        address board;
        uint256 approvalTimestamp;
    }

    struct ProfitDistribution {
        uint256 totalProfit;
        uint256 investorShare;
        bool certified;
        uint256 certificationTimestamp;
    }

    struct ShariahEvent {
        string eventType;
        uint256 timestamp;
        string description;
    }

    mapping(bytes32 => ShariahApproval) private _shariahApprovals;
    mapping(bytes32 => ProfitDistribution) private _profitDistributions;
    mapping(bytes32 => ShariahEvent[]) private _shariahEvents;

    uint256[50] private __gap;

    event SukukApproved(bytes32 indexed bondId, address indexed shariahBoard, uint256 timestamp);
    event ProfitDistributionCertified(bytes32 indexed bondId, uint256 totalProfit, uint256 investorShare, bool compliant, uint256 timestamp);
    event ShariahEventReported(bytes32 indexed bondId, string eventType, uint256 timestamp);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(address admin_) external initializer {
        if (admin_ == address(0)) revert ZeroAddress();
        __AccessControl_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(SHARIAH_BOARD_ROLE, admin_);
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    function approveSukuk(bytes32 bondId, address shariahBoard) external onlyRole(SHARIAH_BOARD_ROLE) {
        if (shariahBoard == address(0)) revert ZeroAddress();
        _shariahApprovals[bondId] = ShariahApproval({
            approved: true,
            board: shariahBoard,
            approvalTimestamp: block.timestamp
        });
        emit SukukApproved(bondId, shariahBoard, block.timestamp);
    }

    function getShariahApproval(bytes32 bondId) external view returns (bool approved, address board) {
        ShariahApproval storage approval = _shariahApprovals[bondId];
        return (approval.approved, approval.board);
    }

    function certifyProfitDistribution(bytes32 bondId, uint256 totalProfit, uint256 investorShare)
        external
        onlyRole(SHARIAH_BOARD_ROLE)
        returns (bool compliant)
    {
        if (!_shariahApprovals[bondId].approved) revert SukukNotShariahApproved(bondId);
        if (totalProfit < investorShare) revert InvestorShareExceedsProfit(investorShare, totalProfit);
        compliant = true;
        _profitDistributions[bondId] = ProfitDistribution({
            totalProfit: totalProfit,
            investorShare: investorShare,
            certified: compliant,
            certificationTimestamp: block.timestamp
        });
        emit ProfitDistributionCertified(bondId, totalProfit, investorShare, compliant, block.timestamp);
    }

    function reportShariahEvent(bytes32 bondId, string calldata eventType) external onlyRole(SHARIAH_BOARD_ROLE) {
        if (!_shariahApprovals[bondId].approved) revert SukukNotShariahApproved(bondId);
        _shariahEvents[bondId].push(ShariahEvent({
            eventType: eventType,
            timestamp: block.timestamp,
            description: ""
        }));
        emit ShariahEventReported(bondId, eventType, block.timestamp);
    }

    function getProfitDistribution(bytes32 bondId) external view returns (ProfitDistribution memory) {
        return _profitDistributions[bondId];
    }

    function getShariahEvents(bytes32 bondId) external view returns (ShariahEvent[] memory) {
        return _shariahEvents[bondId];
    }

    function isSukukApproved(bytes32 bondId) external view returns (bool) {
        return _shariahApprovals[bondId].approved;
    }
}
