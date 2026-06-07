// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IDVPService} from "../../interfaces/service/asset-support/IDVPService.sol";
import {IFixedIncomeToken} from "../../interfaces/asset/fixed-income/IFixedIncomeToken.sol";
import {ILifecycleManager} from "../../interfaces/asset/fixed-income/ILifecycleManager.sol";
import {ICBToken} from "../../interfaces/asset/fixed-income/ICBToken.sol";
import {ISettlementFailureService} from "../../interfaces/service/asset-support/ISettlementFailureService.sol";
import {
    ZeroAddress, ZeroAmount, InvalidParties,
    SettlementNotFound, SettlementNotPending,
    SettlementWindowExpired, AffirmationRequired, AlreadyAffirmed
} from "../../library/Errors.sol";

interface ICouponServiceView {
    function calculateCoupon(bytes32 bondId) external view returns (uint256);
}

/**
 * @title DVPService
 * @notice Delivery-vs-Payment atomic settlement for bond + CBDC exchange.
 *         CPMI-IOSCO aligned. Both legs execute in the same transaction (atomic on EVM).
 *         Supports bilateral affirmation flow and settlement deadline enforcement.
 * @custom:security-contact security@yourproject.xyz
 */
contract DVPService is
    Initializable,
    AccessControlUpgradeable,
    ReentrancyGuard,
    UUPSUpgradeable,
    IDVPService
{
    using SafeERC20 for IERC20;

    bytes32 public constant SETTLEMENT_ROLE = keccak256("SETTLEMENT_ROLE");
    bytes32 public constant SECONDARY = keccak256("SECONDARY");

    IFixedIncomeToken public fixedIncomeToken;
    ILifecycleManager public lifecycleManager;
    ICBToken public cbToken;
    ISettlementFailureService public settlementFailureService;
    ICouponServiceView public couponService; // optional; enables accrued interest calculation

    mapping(bytes32 => DVPSettlement) private _settlements;
    uint256 private _settlementCounter;

    uint256[50] private __gap;

    event DVPSettlementInitiated(bytes32 indexed settlementId, bytes32 bondId, address seller, address buyer, uint256 bondAmount, uint256 cbdcAmount);
    event DVPSettlementConfirmed(bytes32 indexed settlementId);
    event DVPSettlementFailed(bytes32 indexed settlementId, string reason);
    event DVPSettlementCancelled(bytes32 indexed settlementId, string reason);
    event DVPAffirmed(bytes32 indexed settlementId, address indexed affirmer);
    event CouponServiceSet(address indexed couponService);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(
        address fixedIncomeToken_,
        address lifecycleManager_,
        address cbToken_,
        address settlementFailureService_,
        address admin_
    ) external initializer {
        if (fixedIncomeToken_ == address(0)) revert ZeroAddress();
        if (lifecycleManager_ == address(0)) revert ZeroAddress();
        if (cbToken_ == address(0)) revert ZeroAddress();
        if (settlementFailureService_ == address(0)) revert ZeroAddress();
        if (admin_ == address(0)) revert ZeroAddress();

        __AccessControl_init();

        fixedIncomeToken = IFixedIncomeToken(fixedIncomeToken_);
        lifecycleManager = ILifecycleManager(lifecycleManager_);
        cbToken = ICBToken(cbToken_);
        settlementFailureService = ISettlementFailureService(settlementFailureService_);

        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(SETTLEMENT_ROLE, admin_);
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    /// @notice Wire CouponService for accrued interest calculation in calculateSettlementAmount.
    function setCouponService(address couponService_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        couponService = ICouponServiceView(couponService_);
        emit CouponServiceSet(couponService_);
    }

    // ─── Standard DVP (backward compatible — no affirmation, no deadline) ───

    function initiateDVP(
        bytes32 bondId,
        address bondSeller,
        address bondBuyer,
        uint256 bondAmount,
        bytes32 bondPartition,
        address cbdcPayer,
        address cbdcPayee,
        uint256 cbdcAmount,
        SettlementModel model
    ) external nonReentrant onlyRole(SETTLEMENT_ROLE) returns (bytes32 settlementId) {
        if (bondAmount == 0) revert ZeroAmount();
        if (cbdcAmount == 0) revert ZeroAmount();
        if (bondSeller == address(0) || bondBuyer == address(0)) revert InvalidParties();

        settlementId = keccak256(abi.encode(bondId, bondSeller, bondBuyer, block.timestamp, ++_settlementCounter));

        _settlements[settlementId] = DVPSettlement({
            settlementId: settlementId,
            bondId: bondId,
            bondSeller: bondSeller,
            bondBuyer: bondBuyer,
            bondAmount: bondAmount,
            bondPartition: bondPartition,
            cbdcPayer: cbdcPayer,
            cbdcPayee: cbdcPayee,
            cbdcAmount: cbdcAmount,
            model: model,
            status: SettlementStatus.PENDING,
            createdAt: block.timestamp,
            settlementDeadline: 0,
            sellerAffirmed: false,
            buyerAffirmed: false,
            failureReason: ""
        });

        emit DVPSettlementInitiated(settlementId, bondId, bondSeller, bondBuyer, bondAmount, cbdcAmount);
    }

    // ─── DVP with bilateral affirmation + settlement window ───

    function initiateDVPWithAffirmation(
        bytes32 bondId,
        address bondSeller,
        address bondBuyer,
        uint256 bondAmount,
        bytes32 bondPartition,
        address cbdcPayer,
        address cbdcPayee,
        uint256 cbdcAmount,
        SettlementModel model,
        uint256 settlementWindowSeconds
    ) external nonReentrant onlyRole(SETTLEMENT_ROLE) returns (bytes32 settlementId) {
        if (bondAmount == 0) revert ZeroAmount();
        if (cbdcAmount == 0) revert ZeroAmount();
        if (bondSeller == address(0) || bondBuyer == address(0)) revert InvalidParties();

        settlementId = keccak256(abi.encode(bondId, bondSeller, bondBuyer, block.timestamp, ++_settlementCounter));

        _settlements[settlementId] = DVPSettlement({
            settlementId: settlementId,
            bondId: bondId,
            bondSeller: bondSeller,
            bondBuyer: bondBuyer,
            bondAmount: bondAmount,
            bondPartition: bondPartition,
            cbdcPayer: cbdcPayer,
            cbdcPayee: cbdcPayee,
            cbdcAmount: cbdcAmount,
            model: model,
            status: SettlementStatus.AWAITING_AFFIRMATION,
            createdAt: block.timestamp,
            settlementDeadline: block.timestamp + settlementWindowSeconds,
            sellerAffirmed: false,
            buyerAffirmed: false,
            failureReason: ""
        });

        emit DVPSettlementInitiated(settlementId, bondId, bondSeller, bondBuyer, bondAmount, cbdcAmount);
    }

    /// @notice Seller or buyer affirms trade details. Once both affirm, status advances to PENDING.
    function affirmDVP(bytes32 settlementId) external {
        DVPSettlement storage s = _settlements[settlementId];
        if (s.settlementId != settlementId) revert SettlementNotFound(settlementId);
        if (s.status != SettlementStatus.AWAITING_AFFIRMATION) revert AffirmationRequired(settlementId);

        if (s.settlementDeadline != 0 && block.timestamp > s.settlementDeadline)
            revert SettlementWindowExpired(settlementId, s.settlementDeadline, block.timestamp);

        if (msg.sender == s.bondSeller) {
            if (s.sellerAffirmed) revert AlreadyAffirmed(settlementId, msg.sender);
            s.sellerAffirmed = true;
        } else if (msg.sender == s.bondBuyer) {
            if (s.buyerAffirmed) revert AlreadyAffirmed(settlementId, msg.sender);
            s.buyerAffirmed = true;
        } else {
            revert InvalidParties();
        }

        emit DVPAffirmed(settlementId, msg.sender);

        // Auto-advance to PENDING once both parties have affirmed
        if (s.sellerAffirmed && s.buyerAffirmed) {
            s.status = SettlementStatus.PENDING;
        }
    }

    function confirmDVP(bytes32 settlementId) external nonReentrant onlyRole(SETTLEMENT_ROLE) {
        DVPSettlement storage s = _settlements[settlementId];
        if (s.settlementId != settlementId) revert SettlementNotFound(settlementId);
        if (s.status != SettlementStatus.PENDING) revert SettlementNotPending(settlementId);

        // Enforce settlement deadline if set
        if (s.settlementDeadline != 0 && block.timestamp > s.settlementDeadline) {
            _reportFailure(settlementId, ISettlementFailureService.FailureReason.TIMEOUT);
            return;
        }

        bytes32 partition = s.bondPartition;

        if (s.model == SettlementModel.SECURITIES_FIRST) {
            try fixedIncomeToken.operatorTransferByPartition(partition, s.bondSeller, s.bondBuyer, s.bondAmount, "", "") {
            } catch {
                _reportFailure(settlementId, ISettlementFailureService.FailureReason.INSUFFICIENT_SECURITIES);
                return;
            }
            try IERC20(address(cbToken)).transferFrom(s.cbdcPayer, s.cbdcPayee, s.cbdcAmount) returns (bool ok) {
                if (!ok) { _reportFailure(settlementId, ISettlementFailureService.FailureReason.INSUFFICIENT_FUNDS); return; }
            } catch {
                _reportFailure(settlementId, ISettlementFailureService.FailureReason.INSUFFICIENT_FUNDS);
                return;
            }
        } else if (s.model == SettlementModel.MONEY_FIRST) {
            try IERC20(address(cbToken)).transferFrom(s.cbdcPayer, s.cbdcPayee, s.cbdcAmount) returns (bool ok) {
                if (!ok) { _reportFailure(settlementId, ISettlementFailureService.FailureReason.INSUFFICIENT_FUNDS); return; }
            } catch {
                _reportFailure(settlementId, ISettlementFailureService.FailureReason.INSUFFICIENT_FUNDS);
                return;
            }
            try fixedIncomeToken.operatorTransferByPartition(partition, s.bondSeller, s.bondBuyer, s.bondAmount, "", "") {
            } catch {
                _reportFailure(settlementId, ISettlementFailureService.FailureReason.INSUFFICIENT_SECURITIES);
                return;
            }
        } else {
            // PARALLEL: both legs in same tx — equivalent to SECURITIES_FIRST on EVM
            try fixedIncomeToken.operatorTransferByPartition(partition, s.bondSeller, s.bondBuyer, s.bondAmount, "", "") {
            } catch {
                _reportFailure(settlementId, ISettlementFailureService.FailureReason.INSUFFICIENT_SECURITIES);
                return;
            }
            try IERC20(address(cbToken)).transferFrom(s.cbdcPayer, s.cbdcPayee, s.cbdcAmount) returns (bool ok) {
                if (!ok) { _reportFailure(settlementId, ISettlementFailureService.FailureReason.INSUFFICIENT_FUNDS); return; }
            } catch {
                _reportFailure(settlementId, ISettlementFailureService.FailureReason.INSUFFICIENT_FUNDS);
                return;
            }
        }

        lifecycleManager.registerHolder(s.bondId, s.bondBuyer);
        s.status = SettlementStatus.CONFIRMED;
        emit DVPSettlementConfirmed(settlementId);
    }

    /// @notice Explicitly fail a pending settlement and report to ISettlementFailureService.
    function failDVP(bytes32 settlementId, string calldata reason) external onlyRole(SETTLEMENT_ROLE) {
        DVPSettlement storage s = _settlements[settlementId];
        if (s.settlementId != settlementId) revert SettlementNotFound(settlementId);
        if (s.status != SettlementStatus.PENDING && s.status != SettlementStatus.AWAITING_AFFIRMATION)
            revert SettlementNotPending(settlementId);
        s.status = SettlementStatus.FAILED;
        s.failureReason = reason;
        if (address(settlementFailureService) != address(0)) {
            settlementFailureService.reportFailure(settlementId, ISettlementFailureService.FailureReason.INVALID_PARTY, reason);
        }
        emit DVPSettlementFailed(settlementId, reason);
    }

    function cancelDVP(bytes32 settlementId, string calldata reason) external onlyRole(SETTLEMENT_ROLE) {
        DVPSettlement storage s = _settlements[settlementId];
        if (s.settlementId != settlementId) revert SettlementNotFound(settlementId);
        if (s.status != SettlementStatus.PENDING && s.status != SettlementStatus.AWAITING_AFFIRMATION)
            revert SettlementNotPending(settlementId);
        s.status = SettlementStatus.CANCELLED;
        s.failureReason = reason;
        emit DVPSettlementCancelled(settlementId, reason);
    }

    function getDVPStatus(bytes32 settlementId) external view returns (DVPSettlement memory) {
        return _settlements[settlementId];
    }

    /// @notice Calculate dirty price = clean price + accrued interest for a bond leg.
    ///         cleanPriceBps: clean price in bps (10000 = 100% of face value).
    ///         bondState: state hash of the partition being traded (SECONDARY for secondary market,
    ///                    PRIMARY for primary market DvP). Used to compute correct totalSupply denominator.
    ///         Accrued interest is pro-rated from total bond coupon by bondAmount/totalSupply.
    ///         Returns (cleanAmount, accruedInterest, total) in CBDC token units.
    function calculateSettlementAmount(
        bytes32 bondId,
        uint256 bondAmount,
        uint256 cleanPriceBps,
        bytes32 bondState
    ) external view returns (uint256 cleanAmount, uint256 accruedInterest, uint256 total) {
        cleanAmount = bondAmount * cleanPriceBps / 10000;

        if (address(couponService) != address(0)) {
            uint256 totalSupply = fixedIncomeToken.totalSupplyByBond(bondId, bondState);
            if (totalSupply > 0) {
                uint256 totalAccrued = couponService.calculateCoupon(bondId);
                accruedInterest = totalAccrued * bondAmount / totalSupply;
            }
        }

        total = cleanAmount + accruedInterest;
    }

    // ─── Internal ───

    function _reportFailure(bytes32 settlementId, ISettlementFailureService.FailureReason reason) internal {
        DVPSettlement storage s = _settlements[settlementId];
        s.status = SettlementStatus.FAILED;
        string memory reasonStr = _failureReasonToString(reason);
        s.failureReason = reasonStr;
        if (address(settlementFailureService) != address(0)) {
            settlementFailureService.reportFailure(settlementId, reason, reasonStr);
        }
        emit DVPSettlementFailed(settlementId, reasonStr);
    }

    function _failureReasonToString(ISettlementFailureService.FailureReason reason) internal pure returns (string memory) {
        if (reason == ISettlementFailureService.FailureReason.INSUFFICIENT_FUNDS) return "INSUFFICIENT_FUNDS";
        if (reason == ISettlementFailureService.FailureReason.INSUFFICIENT_SECURITIES) return "INSUFFICIENT_SECURITIES";
        if (reason == ISettlementFailureService.FailureReason.TIMEOUT) return "TIMEOUT";
        return "INVALID_PARTY";
    }
}
