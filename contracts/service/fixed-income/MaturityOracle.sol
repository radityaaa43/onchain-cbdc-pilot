// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {IMaturityService} from "../../interfaces/service/fixed-income/IMaturityService.sol";
import {IMaturityOracle} from "../../interfaces/service/fixed-income/IMaturityOracle.sol";
import {ZeroAddress} from "../../library/Errors.sol";

/**
 * @title MaturityOracle
 * @notice Keeper-triggered batch maturity processor for tracked bonds.
 * @custom:security-contact security@yourproject.xyz
 */
contract MaturityOracle is Initializable, AccessControlUpgradeable, UUPSUpgradeable, IMaturityOracle {
    bytes32 public constant ORACLE_ADMIN_ROLE = keccak256("ORACLE_ADMIN_ROLE");
    bytes32 public constant ORACLE_KEEPER_ROLE = keccak256("ORACLE_KEEPER_ROLE");

    uint256 public constant MAX_BONDS_PER_BATCH = 50;

    IMaturityService public maturityService;
    bytes32[] public trackedBonds;

    uint256[50] private __gap;

    event BondTracked(bytes32 bondId);
    event BondUntracked(bytes32 bondId);
    event MaturityTriggered(bytes32 bondId);

    function initialize(address maturityService_, address admin_) external initializer {
        if (maturityService_ == address(0)) revert ZeroAddress();
        if (admin_ == address(0)) revert ZeroAddress();
        __AccessControl_init();

        maturityService = IMaturityService(maturityService_);
        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(ORACLE_ADMIN_ROLE, admin_);
        _grantRole(ORACLE_KEEPER_ROLE, admin_);
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    function trackBond(bytes32 bondId) external onlyRole(ORACLE_ADMIN_ROLE) {
        trackedBonds.push(bondId);
        emit BondTracked(bondId);
    }

    function untrackBond(bytes32 bondId) external onlyRole(ORACLE_ADMIN_ROLE) {
        for (uint256 i = 0; i < trackedBonds.length; i++) {
            if (trackedBonds[i] == bondId) {
                trackedBonds[i] = trackedBonds[trackedBonds.length - 1];
                trackedBonds.pop();
                emit BondUntracked(bondId);
                return;
            }
        }
    }

    function triggerMaturityBatch() external onlyRole(ORACLE_KEEPER_ROLE) {
        uint256 batchSize = trackedBonds.length < MAX_BONDS_PER_BATCH
            ? trackedBonds.length
            : MAX_BONDS_PER_BATCH;

        for (uint256 i = 0; i < batchSize; i++) {
            bytes32 bondId = trackedBonds[i];
            try maturityService.triggerMaturity(bondId) {
                emit MaturityTriggered(bondId);
            } catch {
                // Skip bonds that revert (already matured, info not set, etc.)
            }
        }
    }

    function getTrackedBonds() external view returns (bytes32[] memory) {
        return trackedBonds;
    }
}
