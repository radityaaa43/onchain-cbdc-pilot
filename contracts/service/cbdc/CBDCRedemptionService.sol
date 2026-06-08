// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {CBToken} from "../../asset/cbdc/CBToken.sol";
import {ICBDCRedemptionService} from "../../interfaces/service/cbdc/ICBDCRedemptionService.sol";
import {ZeroAddress, ZeroAmount, LengthMismatch, EmptyArray, RequestNotFound, AlreadyProcessed, CBDCInsufficientBalance} from "../../library/Errors.sol";

/**
 * @title CBDCRedemptionService
 * @notice Manages CBDC redemption requests and processing.
 * @custom:security-contact security@yourproject.xyz
 */
contract CBDCRedemptionService is Initializable, AccessControlUpgradeable, UUPSUpgradeable, ICBDCRedemptionService {
    bytes32 public constant REDEEMER_ROLE = keccak256("REDEEMER_ROLE");

    struct RedemptionRequest {
        address user;
        uint256 amount;
        bool processed;
        uint256 timestamp;
    }

    CBToken public cbToken;
    mapping(address => uint256) public redemptionTotal;
    uint256 public totalRedeemed;
    mapping(bytes32 => RedemptionRequest) public redemptionRequests;
    mapping(address => bytes32[]) public userCompletedRedemptions;
    mapping(bytes32 => bool) public requestExists;

    uint256 private _redemptionNonce;
    uint256[49] private __gap;

    event RedemptionRequested(bytes32 indexed requestId, address indexed user, uint256 amount);
    event Processed(bytes32 indexed requestId, address indexed user, uint256 amount);
    event TokensRedeemed(address indexed account, uint256 amount, address indexed redeemer);

    function initialize(address cbToken_, address admin_) external initializer {
        if (cbToken_ == address(0)) revert ZeroAddress();
        if (admin_ == address(0)) revert ZeroAddress();
        __AccessControl_init();

        cbToken = CBToken(cbToken_);
        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(REDEEMER_ROLE, admin_);
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    function requestRedemption(address user, uint256 amount) external onlyRole(REDEEMER_ROLE) returns (bytes32 requestId) {
        if (user == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        requestId = keccak256(abi.encodePacked(user, amount, _redemptionNonce++));
        redemptionRequests[requestId] = RedemptionRequest({
            user: user,
            amount: amount,
            processed: false,
            timestamp: 0
        });
        requestExists[requestId] = true;
        emit RedemptionRequested(requestId, user, amount);
    }

    function processRedemption(bytes32 requestId) external onlyRole(REDEEMER_ROLE) {
        if (!requestExists[requestId]) revert RequestNotFound(requestId);
        RedemptionRequest storage request = redemptionRequests[requestId];
        if (request.processed) revert AlreadyProcessed(requestId);
        request.processed = true;
        cbToken.burn(request.user, request.amount);
        redemptionTotal[request.user] += request.amount;
        totalRedeemed += request.amount;
        userCompletedRedemptions[request.user].push(requestId);
        emit Processed(requestId, request.user, request.amount);
    }

    function redeem(address account, uint256 amount) external onlyRole(REDEEMER_ROLE) returns (bool) {
        if (account == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        _redeem(account, amount);
        return true;
    }

    function batchRedeem(address[] calldata accounts, uint256[] calldata amounts) external onlyRole(REDEEMER_ROLE) returns (bool) {
        if (accounts.length != amounts.length) revert LengthMismatch(accounts.length, amounts.length);
        if (accounts.length == 0) revert EmptyArray();
        for (uint256 i = 0; i < accounts.length; i++) {
            _redeem(accounts[i], amounts[i]);
        }
        return true;
    }

    function getRedemptionRequest(bytes32 requestId) external view returns (
        address user, uint256 amount, bool processed, uint256 timestamp
    ) {
        if (!requestExists[requestId]) revert RequestNotFound(requestId);
        RedemptionRequest storage request = redemptionRequests[requestId];
        return (request.user, request.amount, request.processed, request.timestamp);
    }

    function getCompletedRedemptions(address user) external view returns (bytes32[] memory) {
        return userCompletedRedemptions[user];
    }

    function getRedemptionTotal(address account) external view returns (uint256) {
        return redemptionTotal[account];
    }

    function _redeem(address account, uint256 amount) internal {
        if (account == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (cbToken.balanceOf(account) < amount) revert CBDCInsufficientBalance(account, cbToken.balanceOf(account), amount);
        cbToken.burn(account, amount);
        redemptionTotal[account] += amount;
        totalRedeemed += amount;
        emit TokensRedeemed(account, amount, msg.sender);
    }
}
