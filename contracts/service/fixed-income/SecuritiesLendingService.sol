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
import {ZeroAddress, ZeroAmount, LendNotActive, NotLender, RecallPeriodNotElapsed} from "../../library/Errors.sol";

/**
 * @title SecuritiesLendingService
 * @notice Securities lending and borrowing (SLB) using LENT lifecycle state.
 *         Borrower posts CBDC collateral; bond moves to LENT partition.
 *         On return, fee is deducted from collateral and remainder returned.
 * @custom:security-contact security@yourproject.xyz
 */
contract SecuritiesLendingService is
    Initializable,
    AccessControlUpgradeable,
    ReentrancyGuard,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;

    bytes32 public constant SLB_INITIATOR_ROLE = keccak256("SLB_INITIATOR_ROLE");
    uint256 public constant STANDARD_RECALL_NOTICE_DAYS = 2;

    enum LendStatus { ACTIVE, CLOSED, DEFAULTED }

    struct LendAgreement {
        bytes32 bondId;
        address lender;
        address borrower;
        uint256 amount;
        uint256 lendingFeeRateBps;
        uint256 collateralAmount;  // overcollateralized: amount × (10000 + haircut) / 10000
        uint256 haircut;           // in bps above 100% (e.g., 200 = 102% collateral per ISLA GMSLA)
        uint256 startDate;
        uint256 tenor;
        uint256 recallDate;
        LendStatus status;
    }

    IFixedIncomeToken public token;
    ILifecycleManager public lifecycle;
    ICBToken public cbToken;

    mapping(bytes32 => LendAgreement) public lends;
    uint256 private _lendNonce;
    bytes32 private _lastLendId;

    uint256[49] private __gap;

    event LendInitiated(bytes32 indexed lendId, bytes32 indexed bondId, uint256 collateralAmount);
    event SecuritiesReturned(bytes32 indexed lendId, uint256 fee);
    event LoanRecalled(bytes32 indexed lendId, uint256 recallDate);
    event LoanDefaulted(bytes32 indexed lendId);

    function initialize(address token_, address lifecycle_, address cbToken_, address admin_) external initializer {
        if (token_ == address(0)) revert ZeroAddress();
        if (lifecycle_ == address(0)) revert ZeroAddress();
        if (cbToken_ == address(0)) revert ZeroAddress();
        if (admin_ == address(0)) revert ZeroAddress();
        __AccessControl_init();
        

        token = IFixedIncomeToken(token_);
        lifecycle = ILifecycleManager(lifecycle_);
        cbToken = ICBToken(cbToken_);
        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(SLB_INITIATOR_ROLE, admin_);
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    // ─── Standard initiation (backward compatible — no overcollateralization) ───

    function initiateLend(
        bytes32 bondId,
        address lender,
        address borrower,
        uint256 amount,
        uint256 feeRateBps,
        uint256 tenor
    ) external onlyRole(SLB_INITIATOR_ROLE) nonReentrant returns (bytes32 lendId) {
        return _initiateLend(bondId, lender, borrower, amount, feeRateBps, tenor, 0);
    }

    // ─── ISLA GMSLA-compliant initiation with overcollateralization ───

    function initiateLendWithHaircut(
        bytes32 bondId,
        address lender,
        address borrower,
        uint256 amount,
        uint256 feeRateBps,
        uint256 tenor,
        uint256 haircut   // in bps above 100% (e.g., 200 = 102% collateral)
    ) external onlyRole(SLB_INITIATOR_ROLE) nonReentrant returns (bytes32 lendId) {
        return _initiateLend(bondId, lender, borrower, amount, feeRateBps, tenor, haircut);
    }

    function _initiateLend(
        bytes32 bondId,
        address lender,
        address borrower,
        uint256 amount,
        uint256 feeRateBps,
        uint256 tenor,
        uint256 haircut
    ) internal returns (bytes32 lendId) {
        if (amount == 0) revert ZeroAmount();
        lendId = keccak256(abi.encode(++_lendNonce, bondId, lender, borrower, amount));

        // Overcollateralization: borrower posts collateral = amount × (10000 + haircut) / 10000
        uint256 collateralAmount = amount * (10000 + haircut) / 10000;

        IERC20(address(cbToken)).safeTransferFrom(borrower, address(this), collateralAmount);
        lifecycle.transition(bondId, lender, amount, keccak256("SECONDARY"), keccak256("LENT"), "");

        lends[lendId] = LendAgreement({
            bondId: bondId,
            lender: lender,
            borrower: borrower,
            amount: amount,
            lendingFeeRateBps: feeRateBps,
            collateralAmount: collateralAmount,
            haircut: haircut,
            startDate: 0,
            tenor: tenor,
            recallDate: 0,
            status: LendStatus.ACTIVE
        });

        emit LendInitiated(lendId, bondId, collateralAmount);
        _lastLendId = lendId;
    }

    // Pente-compat: no return value; call getLastLendId() after
    function initiateLendV2(
        bytes32 bondId, address lender, address borrower, uint256 amount, uint256 feeRateBps, uint256 tenor
    ) external onlyRole(SLB_INITIATOR_ROLE) nonReentrant {
        _initiateLend(bondId, lender, borrower, amount, feeRateBps, tenor, 0);
    }

    function getLastLendId() external view returns (bytes32) { return _lastLendId; }

    function returnSecurities(bytes32 lendId) external onlyRole(SLB_INITIATOR_ROLE) nonReentrant {
        LendAgreement storage lend = lends[lendId];
        if (lend.status != LendStatus.ACTIVE) revert LendNotActive(lendId);

        uint256 daysLent = (block.timestamp - lend.startDate) / 1 days;
        uint256 fee = lend.amount * lend.lendingFeeRateBps * daysLent / 10000;
        if (fee > lend.collateralAmount) fee = lend.collateralAmount;
        uint256 borrowerRefund = lend.collateralAmount - fee;

        // State update before external calls (CEI)
        lend.status = LendStatus.CLOSED;

        lifecycle.transition(lend.bondId, lend.lender, lend.amount, keccak256("LENT"), keccak256("SECONDARY"), "");
        if (fee > 0) IERC20(address(cbToken)).safeTransfer(lend.lender, fee);
        if (borrowerRefund > 0) IERC20(address(cbToken)).safeTransfer(lend.borrower, borrowerRefund);

        emit SecuritiesReturned(lendId, fee);
    }

    function recallLoan(bytes32 lendId) external nonReentrant {
        LendAgreement storage lend = lends[lendId];
        if (lend.status != LendStatus.ACTIVE) revert LendNotActive(lendId);
        if (msg.sender != lend.lender) revert NotLender(msg.sender, lend.lender);

        lend.recallDate = 0;
        emit LoanRecalled(lendId, lend.recallDate);
    }

    function defaultOnLoan(bytes32 lendId) external onlyRole(SLB_INITIATOR_ROLE) nonReentrant {
        LendAgreement storage lend = lends[lendId];
        if (lend.status != LendStatus.ACTIVE) revert LendNotActive(lendId);
        if (lend.recallDate == 0 || block.timestamp <= lend.recallDate) revert RecallPeriodNotElapsed(lendId, lend.recallDate, block.timestamp);

        lend.status = LendStatus.DEFAULTED;

        IERC20(address(cbToken)).safeTransfer(lend.lender, lend.collateralAmount);
        lifecycle.transition(lend.bondId, lend.lender, lend.amount, keccak256("LENT"), keccak256("DEFAULTED"), "");

        emit LoanDefaulted(lendId);
    }

    function getLend(bytes32 lendId) external view returns (LendAgreement memory) {
        return lends[lendId];
    }
}
