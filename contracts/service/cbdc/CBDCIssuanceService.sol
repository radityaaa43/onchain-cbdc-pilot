// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {CBToken} from "../../asset/cbdc/CBToken.sol";
import {ICBDCIssuanceService} from "../../interfaces/service/cbdc/ICBDCIssuanceService.sol";
import {ZeroAddress, ZeroAmount, LengthMismatch} from "../../library/Errors.sol";

/**
 * @title CBDCIssuanceService
 * @notice Issues (mints) CBDC tokens to participants.
 * @custom:security-contact security@yourproject.xyz
 */
contract CBDCIssuanceService is Initializable, AccessControlUpgradeable, UUPSUpgradeable, ICBDCIssuanceService {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    CBToken public cbToken;
    uint256 private _issuedTotal;

    uint256[50] private __gap;

    event CBDCIssued(address indexed to, uint256 amount);
    event CBDCBatchIssued(address[] recipients, uint256 totalAmount);


    function initialize(address cbToken_, address admin_) external initializer {
        if (cbToken_ == address(0)) revert ZeroAddress();
        if (admin_ == address(0)) revert ZeroAddress();
        __AccessControl_init();

        cbToken = CBToken(cbToken_);
        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(ISSUER_ROLE, admin_);
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    function issue(address to, uint256 amount) external onlyRole(ISSUER_ROLE) returns (bool) {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        cbToken.mint(to, amount);
        _issuedTotal += amount;
        emit CBDCIssued(to, amount);
        return true;
    }

    function batchIssue(address[] calldata recipients, uint256[] calldata amounts)
        external
        onlyRole(ISSUER_ROLE)
        returns (bool)
    {
        if (recipients.length != amounts.length) revert LengthMismatch(recipients.length, amounts.length);
        uint256 total;
        for (uint256 i = 0; i < recipients.length; i++) {
            if (recipients[i] == address(0)) revert ZeroAddress();
            if (amounts[i] == 0) revert ZeroAmount();
            cbToken.mint(recipients[i], amounts[i]);
            total += amounts[i];
        }
        _issuedTotal += total;
        emit CBDCBatchIssued(recipients, total);
        return true;
    }

    function getIssuedTotal() external view returns (uint256) {
        return _issuedTotal;
    }
}
