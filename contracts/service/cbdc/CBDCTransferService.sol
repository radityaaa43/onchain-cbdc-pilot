// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {CBToken} from "../../asset/cbdc/CBToken.sol";
import {ICBDCTransferService} from "../../interfaces/service/cbdc/ICBDCTransferService.sol";
import {ZeroAddress, ZeroAmount, LengthMismatch, EmptyArray} from "../../library/Errors.sol";

/**
 * @title CBDCTransferService
 * @notice Operator-mediated CBDC transfer service.
 * @custom:security-contact security@yourproject.xyz
 */
contract CBDCTransferService is
    Initializable,
    AccessControlUpgradeable,
    ReentrancyGuard,
    UUPSUpgradeable,
    ICBDCTransferService
{
    using SafeERC20 for IERC20;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    CBToken public cbToken;

    uint256[50] private __gap;

    event CBDCTransferred(address indexed from, address indexed to, uint256 amount);


    function initialize(address cbToken_, address admin_) external initializer {
        if (cbToken_ == address(0)) revert ZeroAddress();
        if (admin_ == address(0)) revert ZeroAddress();
        __AccessControl_init();
        

        cbToken = CBToken(cbToken_);
        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(OPERATOR_ROLE, admin_);
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    function transfer(address from, address to, uint256 amount)
        external
        onlyRole(OPERATOR_ROLE)
        nonReentrant
        returns (bool)
    {
        if (from == address(0)) revert ZeroAddress();
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        IERC20(address(cbToken)).safeTransferFrom(from, to, amount);
        emit CBDCTransferred(from, to, amount);
        return true;
    }

    function batchTransfer(address from, address[] calldata recipients, uint256[] calldata amounts)
        external
        onlyRole(OPERATOR_ROLE)
        nonReentrant
        returns (bool)
    {
        if (recipients.length != amounts.length) revert LengthMismatch(recipients.length, amounts.length);
        if (recipients.length == 0) revert EmptyArray();
        for (uint256 i = 0; i < recipients.length; i++) {
            if (recipients[i] == address(0)) revert ZeroAddress();
            if (amounts[i] == 0) revert ZeroAmount();
            IERC20(address(cbToken)).safeTransferFrom(from, recipients[i], amounts[i]);
            emit CBDCTransferred(from, recipients[i], amounts[i]);
        }
        return true;
    }
}
