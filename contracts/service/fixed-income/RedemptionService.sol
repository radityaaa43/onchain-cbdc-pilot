// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IFixedIncomeToken} from "../../interfaces/asset/fixed-income/IFixedIncomeToken.sol";
import {ILifecycleManager} from "../../interfaces/asset/fixed-income/ILifecycleManager.sol";
import {ICBToken} from "../../interfaces/asset/fixed-income/ICBToken.sol";
import {IMaturityService} from "../../interfaces/service/fixed-income/IMaturityService.sol";
import {IRedemptionService} from "../../interfaces/service/fixed-income/IRedemptionService.sol";
import {ZeroAddress, NotAuthorized, BondNotMatured} from "../../library/Errors.sol";

/**
 * @title RedemptionService
 * @notice Redeems matured bonds: burns securities, pays CBDC to holder.
 *         Tracks redeemed amounts independently — no callback to IssuanceService.
 * @custom:security-contact security@yourproject.xyz
 */
contract RedemptionService is
    Initializable,
    AccessControlUpgradeable,
    ReentrancyGuard,
    UUPSUpgradeable,
    IRedemptionService
{
    using SafeERC20 for IERC20;

    bytes32 public constant LIFECYCLE_MANAGER_ROLE = keccak256("LIFECYCLE_MANAGER_ROLE");
    bytes32 public constant REDEEMER_ROLE = keccak256("REDEEMER_ROLE");

    IFixedIncomeToken public token;
    ILifecycleManager public lifecycle;
    ICBToken public cbToken;
    IMaturityService public maturityService;

    mapping(bytes32 => uint256) public redeemedAmount;

    uint256[50] private __gap;

    event BondRedeemed(bytes32 indexed bondId, address indexed holder, uint256 amount, uint256 value);
    event BatchRedeemed(bytes32 indexed bondId, address[] holders, uint256[] amounts, uint256 totalValue);

    function initialize(
        address token_,
        address lifecycle_,
        address cbToken_,
        address maturityService_,
        address admin_
    ) external initializer {
        if (token_ == address(0)) revert ZeroAddress();
        if (lifecycle_ == address(0)) revert ZeroAddress();
        if (cbToken_ == address(0)) revert ZeroAddress();
        if (maturityService_ == address(0)) revert ZeroAddress();
        if (admin_ == address(0)) revert ZeroAddress();

        __AccessControl_init();

        token = IFixedIncomeToken(token_);
        lifecycle = ILifecycleManager(lifecycle_);
        cbToken = ICBToken(cbToken_);
        maturityService = IMaturityService(maturityService_);

        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(LIFECYCLE_MANAGER_ROLE, admin_);
        _grantRole(REDEEMER_ROLE, admin_);
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    function redeem(bytes32 bondId, address holder, uint256 amount) external nonReentrant {
        if (!hasRole(LIFECYCLE_MANAGER_ROLE, msg.sender) && !hasRole(REDEEMER_ROLE, msg.sender)) revert NotAuthorized();
        if (lifecycle.getState(bondId) != ILifecycleManager.LifecycleState.MATURED) revert BondNotMatured(bondId);

        IMaturityService.MaturityInfo memory maturityInfo = maturityService.getMaturityInfo(bondId);
        uint256 pct = maturityInfo.finalRedemptionPct;
        if (pct == 0) pct = 10000;

        bytes32 partition = token.computePartition(bondId, keccak256("MATURED"));
        uint256 value = amount * pct / 10000;

        token.redeemFromPartition(partition, holder, amount, "");
        redeemedAmount[bondId] += amount;
        IERC20(address(cbToken)).safeTransfer(holder, value);

        emit BondRedeemed(bondId, holder, amount, value);
    }

    function getRedeemedTotal(bytes32 bondId) external view returns (uint256) {
        return redeemedAmount[bondId];
    }

    function getRedemptionTotal(bytes32 bondId) external view returns (uint256) {
        bytes32 partition = token.computePartition(bondId, keccak256("MATURED"));
        return token.totalSupplyByPartition(partition);
    }

    function hasSufficientFunding(bytes32 bondId)
        external view
        returns (bool sufficient, uint256 required, uint256 available)
    {
        IMaturityService.MaturityInfo memory info = maturityService.getMaturityInfo(bondId);
        uint256 pct = info.finalRedemptionPct;
        if (pct == 0) pct = 10000;
        required = info.principalAmount * pct / 10000;
        available = IERC20(address(cbToken)).balanceOf(address(this));
        sufficient = available >= required;
    }
}
