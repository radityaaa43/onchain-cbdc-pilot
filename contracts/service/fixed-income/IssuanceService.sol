// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {FixedIncomeToken} from "../../asset/fixed-income/FixedIncomeToken.sol";
import {ILifecycleManager} from "../../interfaces/asset/fixed-income/ILifecycleManager.sol";
import {IIssuanceService} from "../../interfaces/service/fixed-income/IIssuanceService.sol";
import {ZeroAddress, ZeroAmount, LengthMismatch, EmptyArray} from "../../library/Errors.sol";

/**
 * @title IssuanceService
 * @notice Issues bond tokens to PRIMARY partition holders and registers them
 *         in LifecycleManager so maturity, coupon, and default operations
 *         can include PRIMARY holders without requiring SECONDARY transition first.
 * @custom:security-contact security@yourproject.xyz
 */
contract IssuanceService is Initializable, AccessControlUpgradeable, UUPSUpgradeable, IIssuanceService {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    FixedIncomeToken public token;
    ILifecycleManager public lifecycle;
    mapping(bytes32 => uint256) public issuedAmount;

    uint256[50] private __gap;

    event BondIssued(bytes32 indexed bondId, address indexed investor, uint256 amount);
    event BatchBondIssued(bytes32 indexed bondId, address[] investors, uint256 totalAmount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(address token_, address lifecycle_, address admin_) external initializer {
        if (token_ == address(0)) revert ZeroAddress();
        if (lifecycle_ == address(0)) revert ZeroAddress();
        if (admin_ == address(0)) revert ZeroAddress();
        __AccessControl_init();

        token = FixedIncomeToken(token_);
        lifecycle = ILifecycleManager(lifecycle_);
        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(ISSUER_ROLE, admin_);
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    function issueBond(bytes32 bondId, address investor, uint256 amount) external onlyRole(ISSUER_ROLE) {
        if (investor == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        bytes32 partition = token.computePartition(bondId, token.PRIMARY());
        token.issueByPartition(partition, investor, amount, abi.encodePacked(bondId));
        lifecycle.registerHolder(bondId, investor);
        issuedAmount[bondId] += amount;
        emit BondIssued(bondId, investor, amount);
    }

    function batchIssueBond(bytes32 bondId, address[] calldata investors, uint256[] calldata amounts)
        external
        onlyRole(ISSUER_ROLE)
    {
        if (investors.length != amounts.length) revert LengthMismatch(investors.length, amounts.length);
        if (investors.length == 0) revert EmptyArray();
        bytes32 partition = token.computePartition(bondId, token.PRIMARY());
        uint256 total;
        for (uint256 i = 0; i < investors.length; i++) {
            if (investors[i] == address(0)) revert ZeroAddress();
            if (amounts[i] == 0) revert ZeroAmount();
            token.issueByPartition(partition, investors[i], amounts[i], abi.encodePacked(bondId));
            lifecycle.registerHolder(bondId, investors[i]);
            total += amounts[i];
        }
        issuedAmount[bondId] += total;
        emit BatchBondIssued(bondId, investors, total);
    }

    function getIssuedTotal(bytes32 bondId) external view returns (uint256) {
        return issuedAmount[bondId];
    }
}
