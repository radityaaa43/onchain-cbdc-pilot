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
import {ZeroAddress, ZeroAmount, RepoNotActive, RepoNotDue, InvalidHaircut, EarlyTerminationNotAgreed, MarginCallNotActive, MarginCallWindowExpired, MarginCallThresholdNotBreached, MarginCallsDisabled} from "../../library/Errors.sol";

/**
 * @title RepoService
 * @notice Manages repurchase agreements (repo) on digital bonds per ICMA GMRA.
 *         Seller transfers SECONDARY bonds to REPO partition; buyer pays CBDC (net of haircut).
 *         Haircut protects buyer against seller default. Repurchase price = purchase price + repo interest.
 * @custom:security-contact security@yourproject.xyz
 */
contract RepoService is
    Initializable,
    AccessControlUpgradeable,
    ReentrancyGuard,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;

    bytes32 public constant DEALER_ROLE = keccak256("DEALER_ROLE");

    enum RepoStatus { ACTIVE, SETTLED, DEFAULTED }

    struct RepoAgreement {
        bytes32 bondId;
        address seller;
        address buyer;
        uint256 amount;
        uint256 repoRate;
        uint256 haircut;              // in bps (200 = 2% haircut → buyer pays 98% of market value)
        uint256 purchasePrice;        // effective purchase price after haircut
        uint256 repurchasePrice;      // purchasePrice + repo interest
        uint256 tenor;
        uint256 startDate;
        uint256 endDate;
        RepoStatus status;
        // Early termination consent flags (bilateral agreement required)
        bool sellerConsentEarlyTermination;
        bool buyerConsentEarlyTermination;
        // Gap 4: Margin call fields (GMRA Para 4c)
        uint256 initialMarketPrice;   // market price at initiation (for threshold calculation)
        uint256 marginCallThreshold;  // in bps: trigger when current < initial * threshold/10000
        bool marginCallActive;        // true when buyer has initiated a margin call
        uint256 marginCallDeadline;   // deadline for seller to respond (default: 1 business day)
    }

    IFixedIncomeToken public token;
    ILifecycleManager public lifecycle;
    ICBToken public cbToken;

    mapping(bytes32 => RepoAgreement) public repos;
    uint256 private _repoNonce;
    bytes32 private _lastRepoId;

    uint256[49] private __gap;

    event RepoInitiated(bytes32 indexed repoId, bytes32 indexed bondId, uint256 repurchasePrice, uint256 purchasePrice);
    event RepoUnwound(bytes32 indexed repoId);
    event EarlyTerminationConsented(bytes32 indexed repoId, address indexed party);
    event RepoTerminatedEarly(bytes32 indexed repoId, uint256 settledAt);
    event MarginCallInitiated(bytes32 indexed repoId, address indexed initiator, uint256 marginDeficit, uint256 deadline);
    event MarginCallSettled(bytes32 indexed repoId, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

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
        _grantRole(DEALER_ROLE, admin_);
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    // ─── Standard initiation (backward compatible — haircut=0, no margin call) ───

    function initiateRepo(
        bytes32 bondId,
        address seller,
        address buyer,
        uint256 amount,
        uint256 repoRate,
        uint256 tenor
    ) external onlyRole(DEALER_ROLE) nonReentrant returns (bytes32 repoId) {
        return _initiateRepo(bondId, seller, buyer, amount, repoRate, tenor, amount, 0, 0);
    }

    // ─── ICMA GMRA-compliant initiation with haircut, market price, margin call threshold ───

    function initiateRepoWithHaircut(
        bytes32 bondId,
        address seller,
        address buyer,
        uint256 amount,
        uint256 repoRate,
        uint256 tenor,
        uint256 marketPrice,        // market value of bonds (caller-provided, e.g. from oracle)
        uint256 haircut,            // in bps (e.g., 200 = 2% haircut; buyer pays 98% of market value)
        uint256 marginCallThreshold // in bps: trigger when price < initial * threshold/10000 (0 = disabled)
    ) external onlyRole(DEALER_ROLE) nonReentrant returns (bytes32 repoId) {
        if (haircut > 10000) revert InvalidHaircut(haircut);
        return _initiateRepo(bondId, seller, buyer, amount, repoRate, tenor, marketPrice, haircut, marginCallThreshold);
    }

    // ─── Early termination (bilateral consent required — ICMA GMRA clause 14) ───

    /// @notice Seller or buyer signals consent for early termination before endDate.
    ///         Once both parties consent, `terminateRepoEarly` can be called.
    function consentEarlyTermination(bytes32 repoId) external {
        RepoAgreement storage repo = repos[repoId];
        if (repo.status != RepoStatus.ACTIVE) revert RepoNotActive(repoId);
        if (msg.sender == repo.seller) {
            repo.sellerConsentEarlyTermination = true;
        } else if (msg.sender == repo.buyer) {
            repo.buyerConsentEarlyTermination = true;
        } else {
            revert RepoNotActive(repoId);
        }
        emit EarlyTerminationConsented(repoId, msg.sender);
    }

    /// @notice Execute early termination when both parties have consented.
    ///         Seller repays prorated repo interest, bond returns to SECONDARY.
    function terminateRepoEarly(bytes32 repoId) external onlyRole(DEALER_ROLE) nonReentrant {
        RepoAgreement storage repo = repos[repoId];
        if (repo.status != RepoStatus.ACTIVE) revert RepoNotActive(repoId);
        if (!repo.sellerConsentEarlyTermination || !repo.buyerConsentEarlyTermination)
            revert EarlyTerminationNotAgreed(repoId);

        // Prorated repo interest up to current time
        uint256 elapsed = block.timestamp - repo.startDate;
        uint256 proratedInterest = repo.purchasePrice * repo.repoRate * elapsed / (365 days * 10000);
        uint256 earlyRepurchasePrice = repo.purchasePrice + proratedInterest;

        IERC20(address(cbToken)).safeTransferFrom(repo.seller, repo.buyer, earlyRepurchasePrice);
        lifecycle.transition(repo.bondId, repo.seller, repo.amount, keccak256("REPO"), keccak256("SECONDARY"), "");

        repo.status = RepoStatus.SETTLED;
        emit RepoTerminatedEarly(repoId, block.timestamp);
    }

    function unwindRepo(bytes32 repoId) external onlyRole(DEALER_ROLE) nonReentrant {
        RepoAgreement storage repo = repos[repoId];
        if (repo.status != RepoStatus.ACTIVE) revert RepoNotActive(repoId);
        if (block.timestamp < repo.endDate) revert RepoNotDue(repoId, repo.endDate, block.timestamp);

        IERC20(address(cbToken)).safeTransferFrom(repo.seller, repo.buyer, repo.repurchasePrice);
        lifecycle.transition(repo.bondId, repo.seller, repo.amount, keccak256("REPO"), keccak256("SECONDARY"), "");

        repo.status = RepoStatus.SETTLED;
        emit RepoUnwound(repoId);
    }

    function getRepo(bytes32 repoId) external view returns (RepoAgreement memory) {
        return repos[repoId];
    }

    // ─── Margin call (GMRA Para 4c) ──────────────────────────────────────────

    /// @notice Buyer initiates a margin call when current bond price breaches threshold.
    ///         Seller must respond within 1 business day (86400s simplified).
    function initiateMarginCall(bytes32 repoId, uint256 currentMarketPrice) external {
        RepoAgreement storage repo = repos[repoId];
        if (repo.status != RepoStatus.ACTIVE) revert RepoNotActive(repoId);
        if (msg.sender != repo.buyer) revert RepoNotActive(repoId);
        if (repo.marginCallThreshold == 0) revert MarginCallsDisabled(repoId);

        // Threshold: trigger if currentPrice < initialPrice * threshold / 10000
        uint256 thresholdValue = repo.initialMarketPrice * repo.marginCallThreshold / 10000;
        if (currentMarketPrice >= thresholdValue)
            revert MarginCallThresholdNotBreached(repoId, currentMarketPrice, thresholdValue);

        // Margin deficit = initial effective price - current effective price
        uint256 currentEffective = currentMarketPrice * (10000 - repo.haircut) / 10000;
        uint256 marginDeficit = repo.purchasePrice > currentEffective
            ? repo.purchasePrice - currentEffective
            : 0;

        repo.marginCallActive = true;
        repo.marginCallDeadline = block.timestamp + 1 days;

        emit MarginCallInitiated(repoId, msg.sender, marginDeficit, repo.marginCallDeadline);
    }

    /// @notice Seller responds to margin call by transferring CBDC deficit to buyer.
    ///         Transfer amount must be pre-approved on cbToken.
    function respondToMarginCall(bytes32 repoId, uint256 amount) external nonReentrant {
        RepoAgreement storage repo = repos[repoId];
        if (!repo.marginCallActive) revert MarginCallNotActive(repoId);
        if (block.timestamp > repo.marginCallDeadline)
            revert MarginCallWindowExpired(repoId, repo.marginCallDeadline, block.timestamp);
        if (msg.sender != repo.seller) revert RepoNotActive(repoId);

        repo.marginCallActive = false;
        repo.purchasePrice += amount; // update effective purchase price baseline

        IERC20(address(cbToken)).safeTransferFrom(repo.seller, repo.buyer, amount);
        emit MarginCallSettled(repoId, amount);
    }

    // ─── Internal ───

    function _initiateRepo(
        bytes32 bondId,
        address seller,
        address buyer,
        uint256 amount,
        uint256 repoRate,
        uint256 tenor,
        uint256 marketPrice,
        uint256 haircut,
        uint256 marginCallThreshold_
    ) internal returns (bytes32 repoId) {
        if (amount == 0) revert ZeroAmount();

        repoId = keccak256(abi.encode(++_repoNonce, bondId, seller, buyer, block.timestamp));

        // Effective purchase price = marketPrice × (1 - haircut/10000)
        uint256 effectivePurchasePrice = marketPrice * (10000 - haircut) / 10000;
        uint256 repurchasePrice = effectivePurchasePrice
            + (effectivePurchasePrice * repoRate * tenor) / (365 * 10000);

        repos[repoId] = RepoAgreement({
            bondId: bondId,
            seller: seller,
            buyer: buyer,
            amount: amount,
            repoRate: repoRate,
            haircut: haircut,
            purchasePrice: effectivePurchasePrice,
            repurchasePrice: repurchasePrice,
            tenor: tenor,
            startDate: block.timestamp,
            endDate: block.timestamp + tenor * 1 days,
            status: RepoStatus.ACTIVE,
            sellerConsentEarlyTermination: false,
            buyerConsentEarlyTermination: false,
            initialMarketPrice: marketPrice,
            marginCallThreshold: marginCallThreshold_,
            marginCallActive: false,
            marginCallDeadline: 0
        });

        IERC20(address(cbToken)).safeTransferFrom(buyer, seller, effectivePurchasePrice);
        lifecycle.transition(bondId, seller, amount, keccak256("SECONDARY"), keccak256("REPO"), "");

        emit RepoInitiated(repoId, bondId, repurchasePrice, effectivePurchasePrice);
        _lastRepoId = repoId;
    }

    // Pente-compat: no return value; call getLastRepoId() after
    function initiateRepoV2(
        bytes32 bondId, address seller, address buyer, uint256 amount, uint256 repoRate, uint256 tenor
    ) external onlyRole(DEALER_ROLE) nonReentrant {
        _initiateRepo(bondId, seller, buyer, amount, repoRate, tenor, amount, 0, 0);
    }

    function getLastRepoId() external view returns (bytes32) { return _lastRepoId; }
}
