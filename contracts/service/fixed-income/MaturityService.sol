// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {IMaturityService} from "../../interfaces/service/fixed-income/IMaturityService.sol";
import {ILifecycleManager} from "../../interfaces/asset/fixed-income/ILifecycleManager.sol";
import {
    ZeroAddress, MaturityInfoNotSet, AlreadyTriggered, NotYetMature,
    InvalidRedemptionPercentage, InsufficientRedemptionFunds
} from "../../library/Errors.sol";

interface IRedemptionFundingCheck {
    function hasSufficientFunding(bytes32 bondId)
        external view
        returns (bool sufficient, uint256 required, uint256 available);
}

/**
 * @title MaturityService
 * @notice Stores maturity metadata and triggers bond maturity via LifecycleManager.
 * @custom:security-contact security@yourproject.xyz
 */
contract MaturityService is Initializable, AccessControlUpgradeable, UUPSUpgradeable, IMaturityService {
    bytes32 public constant LIFECYCLE_MANAGER_ROLE = keccak256("LIFECYCLE_MANAGER_ROLE");

    ILifecycleManager public lifecycleManager;
    address public redemptionService;
    mapping(bytes32 => MaturityInfo) private _maturityInfo;
    uint256 private _maturedBondsCount;

    uint256[50] private __gap;

    event MaturityInfoSet(bytes32 indexed bondId, uint256 maturityDate, uint256 finalRedemptionPct);
    event BondMatured(bytes32 indexed bondId, uint256 timestamp);
    event RedemptionServiceSet(address indexed redemptionService);

    function initialize(address lifecycleManager_, address admin_) external initializer {
        if (lifecycleManager_ == address(0)) revert ZeroAddress();
        if (admin_ == address(0)) revert ZeroAddress();
        __AccessControl_init();

        lifecycleManager = ILifecycleManager(lifecycleManager_);
        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(LIFECYCLE_MANAGER_ROLE, admin_);
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    /// @notice Wire RedemptionService for pre-maturity funding validation.
    ///         If set, triggerMaturity reverts when RedemptionService lacks sufficient CBDC.
    function setRedemptionService(address redemptionService_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        redemptionService = redemptionService_;
        emit RedemptionServiceSet(redemptionService_);
    }

    function setMaturityInfo(
        bytes32 bondId,
        uint256 maturityDate,
        uint256 finalRedemptionPct,
        uint256 principalAmount
    ) external onlyRole(LIFECYCLE_MANAGER_ROLE) {
        if (finalRedemptionPct > 10000) revert InvalidRedemptionPercentage(finalRedemptionPct);
        _maturityInfo[bondId] = MaturityInfo({
            bondId: bondId,
            maturityDate: maturityDate,
            finalRedemptionPct: finalRedemptionPct,
            principalAmount: principalAmount,
            isTriggered: false
        });
        emit MaturityInfoSet(bondId, maturityDate, finalRedemptionPct);
    }

    function triggerMaturity(bytes32 bondId) external onlyRole(LIFECYCLE_MANAGER_ROLE) {
        MaturityInfo storage info = _maturityInfo[bondId];
        if (info.bondId == bytes32(0)) revert MaturityInfoNotSet(bondId);
        if (info.isTriggered) revert AlreadyTriggered(bondId);
        if (block.timestamp < info.maturityDate) revert NotYetMature(bondId, info.maturityDate, block.timestamp);

        if (redemptionService != address(0)) {
            (bool sufficient, uint256 required, uint256 available) =
                IRedemptionFundingCheck(redemptionService).hasSufficientFunding(bondId);
            if (!sufficient) revert InsufficientRedemptionFunds(bondId, required, available);
        }

        info.isTriggered = true;
        _maturedBondsCount++;
        lifecycleManager.matureBond(bondId);
        emit BondMatured(bondId, block.timestamp);
    }

    function getMaturityInfo(bytes32 bondId) external view returns (MaturityInfo memory) {
        return _maturityInfo[bondId];
    }

    function isMatured(bytes32 bondId) external view returns (bool) {
        MaturityInfo memory info = _maturityInfo[bondId];
        return info.isTriggered || (info.maturityDate > 0 && block.timestamp >= info.maturityDate);
    }

    function getMaturedBondsCount() external view returns (uint256) {
        return _maturedBondsCount;
    }
}
