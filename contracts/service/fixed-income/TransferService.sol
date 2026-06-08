// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {FixedIncomeToken} from "../../asset/fixed-income/FixedIncomeToken.sol";
import {ILifecycleManager} from "../../interfaces/asset/fixed-income/ILifecycleManager.sol";
import {ITransferService} from "../../interfaces/service/fixed-income/ITransferService.sol";
import {DFABIComplianceService} from "./DFABIComplianceService.sol";
import {ZeroAddress, ZeroAmount, SelfTransfer, LengthMismatch, EmptyArray, ComplianceCheckFailed} from "../../library/Errors.sol";

/**
 * @title TransferService
 * @notice Operator-mediated bond transfer service with DFABI compliance checks.
 * @custom:security-contact security@yourproject.xyz
 */
contract TransferService is Initializable, AccessControlUpgradeable, UUPSUpgradeable, ITransferService {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    FixedIncomeToken public token;
    ILifecycleManager public lifecycle;
    DFABIComplianceService public complianceService;

    uint256[50] private __gap;

    event TransferCompleted(bytes32 indexed bondId, address indexed from, address indexed to, uint256 amount);
    event BatchTransferCompleted(bytes32 indexed bondId, uint256 count);

    function initialize(
        address token_,
        address lifecycle_,
        address complianceService_,
        address admin_
    ) external initializer {
        if (token_ == address(0)) revert ZeroAddress();
        if (lifecycle_ == address(0)) revert ZeroAddress();
        if (complianceService_ == address(0)) revert ZeroAddress();
        if (admin_ == address(0)) revert ZeroAddress();
        __AccessControl_init();

        token = FixedIncomeToken(token_);
        lifecycle = ILifecycleManager(lifecycle_);
        complianceService = DFABIComplianceService(complianceService_);
        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(OPERATOR_ROLE, admin_);
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    function transfer(
        bytes32 bondId,
        address from,
        address to,
        uint256 amount,
        bytes calldata data
    ) external override onlyRole(OPERATOR_ROLE) {
        if (amount == 0) revert ZeroAmount();
        if (from == to) revert SelfTransfer();

        (bool allowed, string memory reason) = complianceService.checkTransfer(bondId, from, to, amount);
        if (!allowed) revert ComplianceCheckFailed(reason);

        bytes32 partition = token.computePartition(bondId, keccak256("SECONDARY"));
        token.operatorTransferByPartition(partition, from, to, amount, data, "");

        emit TransferCompleted(bondId, from, to, amount);
    }

    function batchTransfer(
        bytes32 bondId,
        address[] calldata froms,
        address[] calldata tos,
        uint256[] calldata amounts
    ) external override onlyRole(OPERATOR_ROLE) {
        if (froms.length != tos.length || froms.length != amounts.length) revert LengthMismatch(froms.length, tos.length);
        if (froms.length == 0) revert EmptyArray();

        bytes32 partition = token.computePartition(bondId, keccak256("SECONDARY"));

        for (uint256 i = 0; i < froms.length; i++) {
            _doTransfer(bondId, partition, froms[i], tos[i], amounts[i]);
        }

        emit BatchTransferCompleted(bondId, froms.length);
    }

    function _doTransfer(
        bytes32 bondId,
        bytes32 partition,
        address from,
        address to,
        uint256 amount
    ) internal {
        if (amount == 0) revert ZeroAmount();
        if (from == to) revert SelfTransfer();

        (bool allowed, string memory reason) = complianceService.checkTransfer(bondId, from, to, amount);
        if (!allowed) revert ComplianceCheckFailed(reason);

        token.operatorTransferByPartition(partition, from, to, amount, "", "");
    }
}
