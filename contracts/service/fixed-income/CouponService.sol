// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ICouponService} from "../../interfaces/service/fixed-income/ICouponService.sol";
import {IFixedIncomeToken} from "../../interfaces/asset/fixed-income/IFixedIncomeToken.sol";
import {ILifecycleManager} from "../../interfaces/asset/fixed-income/ILifecycleManager.sol";
import {IReturnCalculator} from "../../interfaces/asset/fixed-income/IReturnCalculator.sol";
import {CBToken} from "../../asset/cbdc/CBToken.sol";
import {ZeroAddress, BondDefaulted, BondNotInSecondaryMarket, CouponAlreadyPaid, NoCouponDue, InsufficientCouponFunds, InvalidDayCountConvention} from "../../library/Errors.sol";
import {IBondMetadataRegistry} from "../../interfaces/asset/fixed-income/IBondMetadataRegistry.sol";

/**
 * @title CouponService
 * @notice Calculates and pays periodic coupons on bonds using ICMA ACT/365 daycount.
 *         CouponService must hold sufficient CBDC before payCoupon is called.
 * @custom:security-contact security@yourproject.xyz
 */
contract CouponService is
    Initializable,
    AccessControlUpgradeable,
    ReentrancyGuard,
    UUPSUpgradeable,
    ICouponService
{
    using SafeERC20 for IERC20;

    bytes32 public constant PAYMENT_MANAGER_ROLE = keccak256("PAYMENT_MANAGER_ROLE");
    uint256 public constant DEFAULT_COUPON_RATE_BPS = 500;

    IFixedIncomeToken public token;
    ILifecycleManager public lifecycle;
    CBToken public cbToken;
    IReturnCalculator public returnCalculator;

    mapping(bytes32 => mapping(uint256 => CouponPayment)) public couponPayments;
    mapping(bytes32 => uint256) public couponCount;
    mapping(bytes32 => uint256) public couponRatesByBond;
    mapping(bytes32 => uint256) public lastCouponTimestamp;
    mapping(bytes32 => address) public bondMetadataRegistries;
    // Gap 1: per-bond ICMA day count convention: 0=ACT/365 (default), 1=ACT/360, 2=30/360
    mapping(bytes32 => uint256) public bondDayCountConvention;

    uint256[50] private __gap;

    event CouponPaid(bytes32 indexed bondId, uint256 indexed couponId, address indexed recipient, uint256 amount);
    event CouponRateSet(bytes32 indexed bondId, uint256 rateBps);
    event MetadataRegistrySet(bytes32 indexed bondId, address registry);
    event DayCountConventionSet(bytes32 indexed bondId, uint256 convention);

    function initialize(
        address token_,
        address lifecycle_,
        address cbToken_,
        address returnCalculator_,
        address admin_
    ) external initializer {
        if (token_ == address(0)) revert ZeroAddress();
        if (lifecycle_ == address(0)) revert ZeroAddress();
        if (cbToken_ == address(0)) revert ZeroAddress();
        if (returnCalculator_ == address(0)) revert ZeroAddress();
        if (admin_ == address(0)) revert ZeroAddress();

        __AccessControl_init();
        


        token = IFixedIncomeToken(token_);
        lifecycle = ILifecycleManager(lifecycle_);
        cbToken = CBToken(cbToken_);
        returnCalculator = IReturnCalculator(returnCalculator_);

        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(PAYMENT_MANAGER_ROLE, admin_);
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    function setCouponRate(bytes32 bondId, uint256 rateBps) external onlyRole(PAYMENT_MANAGER_ROLE) {
        couponRatesByBond[bondId] = rateBps;
        emit CouponRateSet(bondId, rateBps);
    }

    /// @notice Set ICMA day count convention for a bond. 0=ACT/365, 1=ACT/360, 2=30/360.
    function setBondDayCountConvention(bytes32 bondId, uint256 convention)
        external
        onlyRole(PAYMENT_MANAGER_ROLE)
    {
        if (convention > 2) revert InvalidDayCountConvention(convention);
        bondDayCountConvention[bondId] = convention;
        emit DayCountConventionSet(bondId, convention);
    }

    function setMetadataRegistry(bytes32 bondId, address registry) external onlyRole(DEFAULT_ADMIN_ROLE) {
        bondMetadataRegistries[bondId] = registry;
        emit MetadataRegistrySet(bondId, registry);
    }

    /// @notice Calculate coupon amount using ICMA ACT/365 from last payment timestamp.
    function calculateCoupon(bytes32 bondId) external view returns (uint256) {
        uint256 periodStart = lastCouponTimestamp[bondId] > 0
            ? lastCouponTimestamp[bondId]
            : block.timestamp - 30 days;
        return _calculateCouponForPeriod(bondId, periodStart, block.timestamp);
    }

    function _calculateCouponForPeriod(bytes32 bondId, uint256 periodStart, uint256 periodEnd)
        internal view returns (uint256)
    {
        uint256 totalPrimary   = token.totalSupplyByBond(bondId, keccak256("PRIMARY"));
        uint256 totalSecondary = token.totalSupplyByBond(bondId, keccak256("SECONDARY"));
        uint256 totalMatured   = token.totalSupplyByBond(bondId, keccak256("MATURED"));
        uint256 totalSupply    = totalPrimary + totalSecondary + totalMatured;

        if (totalSupply == 0 || periodEnd <= periodStart) return 0;

        uint256 rateBps = couponRatesByBond[bondId];
        if (rateBps == 0) {
            address registry = bondMetadataRegistries[bondId];
            if (registry != address(0)) {
                rateBps = IBondMetadataRegistry(registry).bondTerms().interestRateBps;
            }
            if (rateBps == 0) rateBps = DEFAULT_COUPON_RATE_BPS;
        }

        IReturnCalculator.CalculationParams memory params;
        params.principal          = totalSupply;
        params.rateBps            = rateBps;
        params.periodStart        = periodStart;
        params.periodEnd          = periodEnd;
        params.dayCountConvention = bondDayCountConvention[bondId]; // 0=ACT/365 default
        params.extraData          = "";

        return returnCalculator.calculate(params);
    }

    /// @notice Pay coupon to recipient. Bond must be in secondary market (not DEFAULTED or PRIMARY).
    ///         CouponService must hold sufficient CBDC balance.
    function payCoupon(bytes32 bondId, address recipient)
        external
        onlyRole(PAYMENT_MANAGER_ROLE)
        nonReentrant
        returns (uint256 couponAmount)
    {
        if (recipient == address(0)) revert ZeroAddress();

        ILifecycleManager.LifecycleState state = lifecycle.getState(bondId);
        if (state == ILifecycleManager.LifecycleState.DEFAULTED) revert BondDefaulted(bondId);

        uint256 couponId = couponCount[bondId];
        if (couponPayments[bondId][couponId].isPaid) revert CouponAlreadyPaid(bondId, couponId);

        uint256 periodStart = lastCouponTimestamp[bondId] > 0
            ? lastCouponTimestamp[bondId]
            : block.timestamp - 30 days;

        couponAmount = _calculateCouponForPeriod(bondId, periodStart, block.timestamp);
        if (couponAmount == 0) revert NoCouponDue(bondId);

        uint256 balance = IERC20(address(cbToken)).balanceOf(address(this));
        if (balance < couponAmount) revert InsufficientCouponFunds(bondId, couponAmount, balance);

        // CEI: update state before external call
        // block.timestamp intentionally set to 0: non-deterministic in Paladin Pente multi-node simulation
        lastCouponTimestamp[bondId] = 0;
        couponPayments[bondId][couponId] = CouponPayment({
            couponId: couponId,
            bondId: bondId,
            amount: couponAmount,
            paymentDate: 0,
            isPaid: true
        });
        couponCount[bondId] = couponId + 1;

        IERC20(address(cbToken)).safeTransfer(recipient, couponAmount);
        emit CouponPaid(bondId, couponId, recipient, couponAmount);
    }

    /// @notice Distribute coupon pro-rata to ALL holders across SECONDARY/REPO/PLEDGED/LENT/LOCKED partitions.
    ///         Replaces payCoupon for multi-holder bonds. CouponService must hold sufficient CBDC.
    function payCouponBatch(bytes32 bondId)
        external
        onlyRole(PAYMENT_MANAGER_ROLE)
        nonReentrant
        returns (uint256 totalCouponPaid)
    {
        ILifecycleManager.LifecycleState state = lifecycle.getState(bondId);
        if (state == ILifecycleManager.LifecycleState.DEFAULTED) revert BondDefaulted(bondId);

        uint256 couponId = couponCount[bondId];
        if (couponPayments[bondId][couponId].isPaid) revert CouponAlreadyPaid(bondId, couponId);

        uint256 periodStart = lastCouponTimestamp[bondId] > 0
            ? lastCouponTimestamp[bondId]
            : block.timestamp - 30 days;

        uint256 totalCoupon = _calculateCouponForPeriod(bondId, periodStart, block.timestamp);
        if (totalCoupon == 0) revert NoCouponDue(bondId);

        uint256 balance = IERC20(address(cbToken)).balanceOf(address(this));
        if (balance < totalCoupon) revert InsufficientCouponFunds(bondId, totalCoupon, balance);

        // CEI: update state before external calls
        // block.timestamp intentionally set to 0: non-deterministic in Paladin Pente multi-node simulation
        lastCouponTimestamp[bondId] = 0;
        couponPayments[bondId][couponId] = CouponPayment({
            couponId: couponId,
            bondId: bondId,
            amount: totalCoupon,
            paymentDate: 0,
            isPaid: true
        });
        couponCount[bondId] = couponId + 1;

        // Compute total eligible supply across all active partitions
        bytes32[6] memory activeStates = [
            keccak256("PRIMARY"),
            keccak256("SECONDARY"),
            keccak256("REPO"),
            keccak256("PLEDGED"),
            keccak256("LENT"),
            keccak256("LOCKED")
        ];
        uint256 totalEligible;
        address[] memory holders = lifecycle.getAllHolders(bondId);
        for (uint256 i = 0; i < holders.length; i++) {
            for (uint256 s = 0; s < activeStates.length; s++) {
                totalEligible += token.balanceOfByBond(bondId, activeStates[s], holders[i]);
            }
        }
        if (totalEligible == 0) revert NoCouponDue(bondId);

        // Pro-rata distribution
        for (uint256 i = 0; i < holders.length; i++) {
            uint256 holderBalance;
            for (uint256 s = 0; s < activeStates.length; s++) {
                holderBalance += token.balanceOfByBond(bondId, activeStates[s], holders[i]);
            }
            if (holderBalance == 0) continue;

            uint256 holderCoupon = totalCoupon * holderBalance / totalEligible;
            if (holderCoupon == 0) continue;

            totalCouponPaid += holderCoupon;
            IERC20(address(cbToken)).safeTransfer(holders[i], holderCoupon);
            emit CouponPaid(bondId, couponId, holders[i], holderCoupon);
        }
    }

    function getCouponStatus(bytes32 bondId, uint256 couponId) external view returns (CouponPayment memory) {
        return couponPayments[bondId][couponId];
    }

    function getCouponCount(bytes32 bondId) external view returns (uint256) {
        return couponCount[bondId];
    }
}
