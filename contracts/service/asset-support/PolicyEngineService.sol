// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {IPolicyEngineService} from "../../interfaces/service/asset-support/IPolicyEngineService.sol";
import {IPolicy} from "../../asset/policy/IPolicy.sol";
import {ZeroAddress} from "../../library/Errors.sol";

/**
 * @title PolicyEngineService
 * @notice Routes transfer checks through a configurable policy chain.
 * @custom:security-contact security@yourproject.xyz
 */
contract PolicyEngineService is Initializable, AccessControlUpgradeable, UUPSUpgradeable, IPolicyEngineService {
    bytes32 public constant POLICY_ADMIN_ROLE = keccak256("POLICY_ADMIN_ROLE");

    address public policyRunner;
    mapping(bytes32 => address) private _policyRules;
    address public defaultPolicy;

    uint256[50] private __gap;

    event PolicyRuleAdded(bytes32 indexed ruleId, address ruleAddress);
    event PolicyRuleRemoved(bytes32 indexed ruleId);
    event DefaultPolicySet(address policyAddress);

    function initialize(address policyRunner_, address admin_) external initializer {
        if (admin_ == address(0)) revert ZeroAddress();
        __AccessControl_init();

        policyRunner = policyRunner_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(POLICY_ADMIN_ROLE, admin_);
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    function checkTransfer(address from, address to, uint256 amount, bytes32 assetId)
        external
        returns (bool allowed, string memory reason)
    {
        // Global policy runner check
        if (policyRunner != address(0)) {
            try IPolicy(policyRunner).check(from, to, amount) returns (address, address, uint256) {
                // allowed, continue
            } catch Error(string memory err) {
                return (false, err);
            } catch {
                return (false, "Policy check failed");
            }
        }

        // Per-asset policy check
        address assetPolicy = _policyRules[assetId];
        if (assetPolicy != address(0)) {
            try IPolicy(assetPolicy).check(from, to, amount) returns (address, address, uint256) {
                // allowed, continue
            } catch Error(string memory err) {
                return (false, err);
            } catch {
                return (false, "Asset policy check failed");
            }
        }

        return (true, "");
    }

    function addPolicyRule(bytes32 ruleId, address ruleContract) external onlyRole(POLICY_ADMIN_ROLE) {
        if (ruleContract == address(0)) revert ZeroAddress();
        _policyRules[ruleId] = ruleContract;
        emit PolicyRuleAdded(ruleId, ruleContract);
    }

    function removePolicyRule(bytes32 ruleId) external onlyRole(POLICY_ADMIN_ROLE) {
        delete _policyRules[ruleId];
        emit PolicyRuleRemoved(ruleId);
    }

    function setDefaultPolicy(address policyAddress) external onlyRole(POLICY_ADMIN_ROLE) {
        defaultPolicy = policyAddress;
        emit DefaultPolicySet(policyAddress);
    }
}
