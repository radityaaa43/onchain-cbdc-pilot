// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {IFixedIncomeToken} from "../../interfaces/asset/fixed-income/IFixedIncomeToken.sol";
import {ILifecycleManager} from "../../interfaces/asset/fixed-income/ILifecycleManager.sol";
import {ZeroAddress, ZeroAmount, PledgeNotActive, PledgeNotExpired, NotAuthorized} from "../../library/Errors.sol";

/**
 * @title PledgeService
 * @notice Manages pledge (jaminan) agreements: locks bonds in PLEDGED partition.
 *         On enforcement, transfers collateral from pledgor to pledgee.
 * @custom:security-contact security@yourproject.xyz
 */
contract PledgeService is
    Initializable,
    AccessControlUpgradeable,
    ReentrancyGuard,
    UUPSUpgradeable
{
    bytes32 public constant DEALER_ROLE = keccak256("DEALER_ROLE");

    enum PledgeStatus { ACTIVE, RELEASED, ENFORCED }

    struct PledgeAgreement {
        bytes32 bondId;
        address pledgor;
        address pledgee;
        uint256 amount;
        uint256 expiryDate;
        PledgeStatus status;
    }

    IFixedIncomeToken public token;
    ILifecycleManager public lifecycle;

    mapping(bytes32 => PledgeAgreement) public pledges;
    uint256 private _pledgeNonce;
    bytes32 private _lastPledgeId;

    uint256[49] private __gap;

    event PledgeCreated(bytes32 indexed pledgeId, bytes32 indexed bondId, address pledgor, address pledgee, uint256 amount);
    event PledgeReleased(bytes32 indexed pledgeId);
    event PledgeEnforced(bytes32 indexed pledgeId);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(address token_, address lifecycle_, address admin_) external initializer {
        if (token_ == address(0)) revert ZeroAddress();
        if (lifecycle_ == address(0)) revert ZeroAddress();
        if (admin_ == address(0)) revert ZeroAddress();
        __AccessControl_init();
        

        token = IFixedIncomeToken(token_);
        lifecycle = ILifecycleManager(lifecycle_);
        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(DEALER_ROLE, admin_);
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    function createPledge(
        bytes32 bondId,
        address pledgor,
        address pledgee,
        uint256 amount,
        uint256 expiryDate
    ) external onlyRole(DEALER_ROLE) nonReentrant returns (bytes32 pledgeId) {
        if (pledgor == address(0) || pledgee == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        pledgeId = keccak256(abi.encode(++_pledgeNonce, bondId, pledgor, pledgee, amount, expiryDate));

        pledges[pledgeId] = PledgeAgreement({
            bondId: bondId,
            pledgor: pledgor,
            pledgee: pledgee,
            amount: amount,
            expiryDate: expiryDate,
            status: PledgeStatus.ACTIVE
        });

        lifecycle.transition(bondId, pledgor, amount, keccak256("SECONDARY"), keccak256("PLEDGED"), "");

        emit PledgeCreated(pledgeId, bondId, pledgor, pledgee, amount);
    }

    // Pente-compat: no return value; call getLastPledgeId() after
    function createPledgeV2(
        bytes32 bondId, address pledgor, address pledgee, uint256 amount, uint256 expiryDate
    ) external onlyRole(DEALER_ROLE) nonReentrant {
        if (pledgor == address(0) || pledgee == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        bytes32 pledgeId = keccak256(abi.encode(++_pledgeNonce, bondId, pledgor, pledgee, amount, expiryDate));
        _lastPledgeId = pledgeId;
        pledges[pledgeId] = PledgeAgreement({ bondId: bondId, pledgor: pledgor, pledgee: pledgee, amount: amount, expiryDate: expiryDate, status: PledgeStatus.ACTIVE });
        lifecycle.transition(bondId, pledgor, amount, keccak256("SECONDARY"), keccak256("PLEDGED"), "");
        emit PledgeCreated(pledgeId, bondId, pledgor, pledgee, amount);
    }

    function getLastPledgeId() external view returns (bytes32) { return _lastPledgeId; }

    function releasePledge(bytes32 pledgeId) external nonReentrant {
        PledgeAgreement storage pledge = pledges[pledgeId];
        if (pledge.status != PledgeStatus.ACTIVE) revert PledgeNotActive(pledgeId);
        if (pledge.pledgee != msg.sender && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) revert NotAuthorized();

        lifecycle.transition(pledge.bondId, pledge.pledgor, pledge.amount, keccak256("PLEDGED"), keccak256("SECONDARY"), "");

        pledge.status = PledgeStatus.RELEASED;
        emit PledgeReleased(pledgeId);
    }

    function enforcePledge(bytes32 pledgeId) external onlyRole(DEALER_ROLE) nonReentrant {
        PledgeAgreement storage pledge = pledges[pledgeId];
        if (pledge.status != PledgeStatus.ACTIVE) revert PledgeNotActive(pledgeId);
        if (block.timestamp <= pledge.expiryDate) revert PledgeNotExpired(pledgeId, pledge.expiryDate, block.timestamp);

        // Cross-holder: pledgor's PLEDGED → pledgee's SECONDARY (creditor takes collateral)
        lifecycle.crossHolderTransition(
            pledge.bondId,
            pledge.pledgor,
            pledge.pledgee,
            pledge.amount,
            keccak256("PLEDGED"),
            keccak256("SECONDARY")
        );

        pledge.status = PledgeStatus.ENFORCED;
        emit PledgeEnforced(pledgeId);
    }

    function getPledge(bytes32 pledgeId) external view returns (PledgeAgreement memory) {
        return pledges[pledgeId];
    }
}
