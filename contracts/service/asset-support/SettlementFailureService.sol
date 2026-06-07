// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ISettlementFailureService} from "../../interfaces/service/asset-support/ISettlementFailureService.sol";
import {ZeroAddress, SettlementNotFound, BuyInWindowNotOpen, BuyInAlreadyExecuted} from "../../library/Errors.sol";

/**
 * @title SettlementFailureService
 * @notice Handles failed DVP settlements with retry and arbitration escalation.
 * @custom:security-contact security@yourproject.xyz
 */
contract SettlementFailureService is Initializable, AccessControlUpgradeable, UUPSUpgradeable, ISettlementFailureService {
    bytes32 public constant SETTLEMENT_ROLE = keccak256("SETTLEMENT_ROLE");

    // CSDR Article 7: grace period before buy-in (4 business days → simplified as 4 days)
    uint256 public constant BUY_IN_GRACE_PERIOD = 4 days;

    mapping(bytes32 => FailureInfo) private _failures;
    mapping(bytes32 => ISettlementFailureService.BuyInInfo) private _buyIns;

    uint256[50] private __gap;

    event FailureReported(bytes32 indexed settlementId, FailureReason reason, string details);
    event FailureResolved(bytes32 indexed settlementId);
    event EscalatedToArbitration(bytes32 indexed settlementId);
    event BuyInInitiated(bytes32 indexed settlementId, uint256 gracePeriodEnd);
    event BuyInExecuted(bytes32 indexed settlementId, uint256 buyInAmount, uint256 buyInPriceBps, uint256 cost);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(address admin_) external initializer {
        if (admin_ == address(0)) revert ZeroAddress();
        __AccessControl_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(SETTLEMENT_ROLE, admin_);
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    function reportFailure(bytes32 settlementId, FailureReason reason, string calldata details)
        external
        onlyRole(SETTLEMENT_ROLE)
    {
        _failures[settlementId] = FailureInfo({
            settlementId: settlementId,
            reason: reason,
            details: details,
            timestamp: block.timestamp,
            resolved: false
        });
        emit FailureReported(settlementId, reason, details);
    }

    function getFailure(bytes32 settlementId) external view returns (FailureInfo memory) {
        return _failures[settlementId];
    }

    function retrySettlement(bytes32 settlementId) external onlyRole(SETTLEMENT_ROLE) {
        if (_failures[settlementId].settlementId != settlementId) revert SettlementNotFound(settlementId);
        _failures[settlementId].resolved = true;
        emit FailureResolved(settlementId);
    }

    function escalateToArbitration(bytes32 settlementId) external onlyRole(SETTLEMENT_ROLE) {
        if (_failures[settlementId].settlementId != settlementId) revert SettlementNotFound(settlementId);
        emit EscalatedToArbitration(settlementId);
    }

    // ─── Buy-in (CSDR Article 7: mandatory after grace period) ──────────────

    /// @notice Initiate buy-in process after settlement failure.
    ///         Buy-in can execute after BUY_IN_GRACE_PERIOD from failure report.
    function initiateBuyIn(bytes32 settlementId) external onlyRole(SETTLEMENT_ROLE) {
        FailureInfo storage f = _failures[settlementId];
        if (f.settlementId != settlementId) revert SettlementNotFound(settlementId);

        BuyInInfo storage bi = _buyIns[settlementId];
        if (bi.initiated) revert BuyInAlreadyExecuted(settlementId);

        bi.initiated = true;
        bi.initiatedAt = block.timestamp;

        emit BuyInInitiated(settlementId, block.timestamp + BUY_IN_GRACE_PERIOD);
    }

    /// @notice Execute buy-in: record the securities purchased and cost.
    ///         Must be called after grace period has elapsed.
    function executeBuyIn(
        bytes32 settlementId,
        uint256 buyInAmount,
        uint256 buyInPriceBps
    ) external onlyRole(SETTLEMENT_ROLE) {
        BuyInInfo storage bi = _buyIns[settlementId];
        if (!bi.initiated) revert BuyInWindowNotOpen(settlementId, 0, block.timestamp);
        if (bi.executed) revert BuyInAlreadyExecuted(settlementId);

        uint256 gracePeriodEnd = bi.initiatedAt + BUY_IN_GRACE_PERIOD;
        if (block.timestamp < gracePeriodEnd)
            revert BuyInWindowNotOpen(settlementId, gracePeriodEnd, block.timestamp);

        uint256 cost = buyInAmount * buyInPriceBps / 10000;
        bi.executed = true;
        bi.buyInAmount = buyInAmount;
        bi.buyInPriceBps = buyInPriceBps;
        bi.costToDefaulter = cost;

        _failures[settlementId].resolved = true;

        emit BuyInExecuted(settlementId, buyInAmount, buyInPriceBps, cost);
    }

    function getBuyIn(bytes32 settlementId) external view returns (BuyInInfo memory) {
        return _buyIns[settlementId];
    }
}
