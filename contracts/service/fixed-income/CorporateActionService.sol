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
import {ICouponService} from "../../interfaces/service/fixed-income/ICouponService.sol";
import {
    ZeroAddress, ZeroAmount, NotAuthorized,
    CallOptionNotActive, CallDateNotReached,
    PutOptionNotRegistered, PutDateNotReached,
    InsufficientActionFunds, OptionAlreadyExecuted,
    RestructuringNotProposed, RestructuringNotApproved, RestructuringCannotReject,
    TenderOfferNotActive, TenderWindowNotOpen, TenderWindowClosed, TenderOfferAlreadyExecuted,
    ConsentProposalNotFound, ConsentVotingExpired, AlreadyVoted, QuorumNotReached,
    ConsentAlreadyFinalized, InsufficientVotingWeight
} from "../../library/Errors.sol";

/**
 * @title CorporateActionService
 * @notice Implements ICMA-standard corporate actions for digital bonds:
 *         - Call option: issuer redeems bonds early at call price
 *         - Put option: holder redeems bonds early at put price
 *         - Restructuring: bilateral issuer+admin consent to change coupon rate or extend maturity
 * @custom:security-contact security@yourproject.xyz
 */
contract CorporateActionService is
    Initializable,
    AccessControlUpgradeable,
    ReentrancyGuard,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;

    bytes32 public constant CORPORATE_ACTION_ROLE = keccak256("CORPORATE_ACTION_ROLE");
    bytes32 public constant SECONDARY = keccak256("SECONDARY");
    bytes32 public constant MATURED   = keccak256("MATURED");

    enum RestructuringStatus { PROPOSED, APPROVED, EXECUTED, REJECTED }

    struct CallOption {
        uint256 callDate;      // earliest date issuer can exercise
        uint256 callPriceBps;  // redemption price in bps of face (e.g. 10200 = 102%)
        bool executed;
    }

    struct PutOption {
        uint256 putDate;       // earliest date holder can exercise
        uint256 putPriceBps;   // redemption price in bps of face
        bool registered;
    }

    struct RestructuringProposal {
        bytes32 bondId;
        uint256 newCouponRateBps;   // 0 = no change
        uint256 newMaturityExtDays; // 0 = no change
        RestructuringStatus status;
        bool issuerApproved;
        bool adminApproved;
    }

    // ─── Gap 3a: Tender offer (ICMA — issuer buys back bonds from market) ──────
    struct TenderOffer {
        uint256 tenderPriceBps; // price in bps of face value (e.g. 10200 = 102%)
        uint256 openDate;       // start of tender window
        uint256 closeDate;      // end of tender window
        bool executed;
    }

    // ─── Gap 3b: Consent solicitation (ICMA — holder vote on indenture changes) ─
    enum ConsentStatus { ACTIVE, PASSED, REJECTED }

    struct ConsentProposal {
        bytes32 bondId;
        string description;
        uint256 votingDeadline;
        uint256 quorumBps;    // minimum % of SECONDARY supply required (e.g. 5100 = 51%)
        uint256 votesFor;
        uint256 votesAgainst;
        ConsentStatus status;
        bool finalized;
    }

    IFixedIncomeToken public token;
    ILifecycleManager public lifecycle;
    ICBToken public cbToken;

    mapping(bytes32 => CallOption)   public callOptions;
    mapping(bytes32 => PutOption)    public putOptions;
    mapping(bytes32 => RestructuringProposal) public restructurings;
    uint256 private _restructuringNonce;

    mapping(bytes32 => TenderOffer)  public tenderOffers;
    mapping(bytes32 => ConsentProposal) public consentProposals;
    mapping(bytes32 => mapping(address => bool)) private _hasVotedConsent;
    uint256 private _consentNonce;
    bytes32 private _lastProposalId;

    address public couponService;

    uint256[48] private __gap;

    event CallOptionScheduled(bytes32 indexed bondId, uint256 callDate, uint256 callPriceBps);
    event CallOptionExecuted(bytes32 indexed bondId, uint256 totalRedeemed, uint256 totalPaid);
    event PutOptionRegistered(bytes32 indexed bondId, uint256 putDate, uint256 putPriceBps);
    event PutOptionExercised(bytes32 indexed bondId, address indexed holder, uint256 amount, uint256 paid);
    event RestructuringProposed(bytes32 indexed proposalId, bytes32 indexed bondId);
    event RestructuringApproved(bytes32 indexed proposalId, address indexed approver);
    event RestructuringExecuted(bytes32 indexed proposalId, bytes32 indexed bondId);
    event RestructuringRejected(bytes32 indexed proposalId);
    event CouponRateUpdated(bytes32 indexed bondId, uint256 newRateBps);
    event TenderOfferScheduled(bytes32 indexed bondId, uint256 openDate, uint256 closeDate, uint256 tenderPriceBps);
    event TenderOfferExecuted(bytes32 indexed bondId, uint256 totalRedeemed, uint256 totalPaid);
    event ConsentProposed(bytes32 indexed proposalId, bytes32 indexed bondId, uint256 votingDeadline);
    event ConsentVoted(bytes32 indexed proposalId, address indexed voter, bool inFavor, uint256 weight);
    event ConsentFinalized(bytes32 indexed proposalId, bool passed);

    function initialize(
        address token_,
        address lifecycle_,
        address cbToken_,
        address admin_
    ) external initializer {
        if (token_ == address(0)) revert ZeroAddress();
        if (lifecycle_ == address(0)) revert ZeroAddress();
        if (cbToken_ == address(0)) revert ZeroAddress();
        if (admin_ == address(0)) revert ZeroAddress();
        __AccessControl_init();
        token = IFixedIncomeToken(token_);
        lifecycle = ILifecycleManager(lifecycle_);
        cbToken = ICBToken(cbToken_);
        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(CORPORATE_ACTION_ROLE, admin_);
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    function setCouponService(address _couponService) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_couponService == address(0)) revert ZeroAddress();
        couponService = _couponService;
    }

    // ─── Call Option (ICMA: issuer early redemption) ───────────────────────────

    /// @notice Register a call option for a bond. callPriceBps: 10000 = 100% par, 10200 = 102%.
    function scheduleCallOption(bytes32 bondId, uint256 callDate, uint256 callPriceBps)
        external
        onlyRole(CORPORATE_ACTION_ROLE)
    {
        callOptions[bondId] = CallOption({
            callDate: callDate,
            callPriceBps: callPriceBps,
            executed: false
        });
        emit CallOptionScheduled(bondId, callDate, callPriceBps);
    }

    /// @notice Execute call option: redeem all SECONDARY bonds at call price.
    ///         CorporateActionService must hold sufficient CBDC (callPrice × totalSupply).
    ///         Iterates all secondary holders via LifecycleManager.getAllHolders.
    function executeCallBatch(bytes32 bondId)
        external
        nonReentrant
        onlyRole(CORPORATE_ACTION_ROLE)
    {
        CallOption storage opt = callOptions[bondId];
        if (opt.callDate == 0) revert CallOptionNotActive(bondId);
        if (opt.executed) revert OptionAlreadyExecuted(bondId);
        if (block.timestamp < opt.callDate) revert CallDateNotReached(bondId, opt.callDate, block.timestamp);

        uint256 totalSupply = token.totalSupplyByBond(bondId, SECONDARY);
        uint256 totalPay = totalSupply * opt.callPriceBps / 10000;

        uint256 balance = IERC20(address(cbToken)).balanceOf(address(this));
        if (balance < totalPay) revert InsufficientActionFunds(bondId, totalPay, balance);

        // CEI: mark executed before external calls
        opt.executed = true;

        address[] memory holders = lifecycle.getAllHolders(bondId);

        uint256 totalRedeemed;
        for (uint256 i = 0; i < holders.length; i++) {
            uint256 bal = token.balanceOfByBond(bondId, SECONDARY, holders[i]);
            if (bal == 0) continue;

            uint256 pay = bal * opt.callPriceBps / 10000;

            // Move to MATURED partition, then pay holder
            lifecycle.transition(bondId, holders[i], bal, SECONDARY, MATURED, "");
            if (pay > 0) IERC20(address(cbToken)).safeTransfer(holders[i], pay);

            totalRedeemed += bal;
        }

        emit CallOptionExecuted(bondId, totalRedeemed, totalPay);
    }

    /// @notice Paginated call option execution for bonds with many holders (>50).
    ///         Call with startIndex=0 first; repeat with returned lastIndex until hasMore=false.
    ///         CBDC liquidity checked on first batch (startIndex==0) only.
    function executeCallBatchPaginated(bytes32 bondId, uint256 startIndex, uint256 endIndex)
        external
        nonReentrant
        onlyRole(CORPORATE_ACTION_ROLE)
        returns (uint256 lastIndex, bool hasMore)
    {
        CallOption storage opt = callOptions[bondId];
        if (opt.callDate == 0) revert CallOptionNotActive(bondId);
        if (opt.executed) revert OptionAlreadyExecuted(bondId);
        if (block.timestamp < opt.callDate) revert CallDateNotReached(bondId, opt.callDate, block.timestamp);

        address[] memory holders = lifecycle.getAllHolders(bondId);
        uint256 count = holders.length;
        if (startIndex >= count) return (startIndex, false);
        if (endIndex > count) endIndex = count;

        if (startIndex == 0) {
            uint256 totalSupply = token.totalSupplyByBond(bondId, SECONDARY);
            uint256 totalPay = totalSupply * opt.callPriceBps / 10000;
            uint256 balance = IERC20(address(cbToken)).balanceOf(address(this));
            if (balance < totalPay) revert InsufficientActionFunds(bondId, totalPay, balance);
        }

        uint256 batchRedeemed;
        uint256 batchPaid;
        for (uint256 i = startIndex; i < endIndex; i++) {
            uint256 bal = token.balanceOfByBond(bondId, SECONDARY, holders[i]);
            if (bal == 0) continue;
            uint256 pay = bal * opt.callPriceBps / 10000;
            lifecycle.transition(bondId, holders[i], bal, SECONDARY, MATURED, "");
            if (pay > 0) IERC20(address(cbToken)).safeTransfer(holders[i], pay);
            batchRedeemed += bal;
            batchPaid += pay;
        }

        if (endIndex == count) {
            opt.executed = true;
            emit CallOptionExecuted(bondId, batchRedeemed, batchPaid);
        }

        return (endIndex, endIndex < count);
    }

    // ─── Put Option (ICMA: holder early redemption) ────────────────────────────

    /// @notice Register put option terms for a bond.
    function registerPutOption(bytes32 bondId, uint256 putDate, uint256 putPriceBps)
        external
        onlyRole(CORPORATE_ACTION_ROLE)
    {
        putOptions[bondId] = PutOption({
            putDate: putDate,
            putPriceBps: putPriceBps,
            registered: true
        });
        emit PutOptionRegistered(bondId, putDate, putPriceBps);
    }

    /// @notice Holder exercises put option for `amount` bonds.
    ///         CorporateActionService must hold sufficient CBDC.
    function exercisePutOption(bytes32 bondId, uint256 amount)
        external
        nonReentrant
    {
        if (amount == 0) revert ZeroAmount();
        PutOption storage opt = putOptions[bondId];
        if (!opt.registered) revert PutOptionNotRegistered(bondId);
        if (block.timestamp < opt.putDate) revert PutDateNotReached(bondId, opt.putDate, block.timestamp);

        uint256 pay = amount * opt.putPriceBps / 10000;
        uint256 balance = IERC20(address(cbToken)).balanceOf(address(this));
        if (balance < pay) revert InsufficientActionFunds(bondId, pay, balance);

        // Transition bonds to MATURED, then pay holder
        lifecycle.transition(bondId, msg.sender, amount, SECONDARY, MATURED, "");
        if (pay > 0) IERC20(address(cbToken)).safeTransfer(msg.sender, pay);

        emit PutOptionExercised(bondId, msg.sender, amount, pay);
    }

    // ─── Bond Restructuring (bilateral consent: issuer + admin) ───────────────

    /// @notice Propose bond restructuring (coupon rate change or maturity extension).
    ///         newCouponRateBps=0 means no coupon change. newMaturityExtDays=0 means no extension.
    function proposeRestructuring(
        bytes32 bondId,
        uint256 newCouponRateBps,
        uint256 newMaturityExtDays
    ) external onlyRole(CORPORATE_ACTION_ROLE) returns (bytes32 proposalId) {
        proposalId = keccak256(abi.encode(++_restructuringNonce, bondId));
        restructurings[proposalId] = RestructuringProposal({
            bondId: bondId,
            newCouponRateBps: newCouponRateBps,
            newMaturityExtDays: newMaturityExtDays,
            status: RestructuringStatus.PROPOSED,
            issuerApproved: false,
            adminApproved: false
        });
        emit RestructuringProposed(proposalId, bondId);
        _lastProposalId = proposalId;
    }

    // Pente-compat: no return value
    function proposeRestructuringV2(bytes32 bondId, uint256 newCouponRateBps, uint256 newMaturityExtDays)
        external onlyRole(CORPORATE_ACTION_ROLE) {
        bytes32 proposalId = keccak256(abi.encode(++_restructuringNonce, bondId));
        _lastProposalId = proposalId;
        restructurings[proposalId] = RestructuringProposal({ bondId: bondId, newCouponRateBps: newCouponRateBps, newMaturityExtDays: newMaturityExtDays, status: RestructuringStatus.PROPOSED, issuerApproved: false, adminApproved: false });
        emit RestructuringProposed(proposalId, bondId);
    }

    /// @notice Approve a restructuring proposal. Requires both CORPORATE_ACTION_ROLE (issuer)
    ///         and DEFAULT_ADMIN_ROLE to approve independently. Advances to APPROVED once both consent.
    function approveRestructuring(bytes32 proposalId) external {
        RestructuringProposal storage prop = restructurings[proposalId];
        if (prop.status != RestructuringStatus.PROPOSED) revert RestructuringNotProposed(proposalId);

        if (hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            prop.adminApproved = true;
        } else if (hasRole(CORPORATE_ACTION_ROLE, msg.sender)) {
            prop.issuerApproved = true;
        } else {
            revert NotAuthorized();
        }

        emit RestructuringApproved(proposalId, msg.sender);

        if (prop.issuerApproved && prop.adminApproved) {
            prop.status = RestructuringStatus.APPROVED;
        }
    }

    /// @notice Execute an approved restructuring. Records outcome as EXECUTED.
    ///         If couponService is set and newCouponRateBps > 0, applies the new rate immediately.
    function executeRestructuring(bytes32 proposalId)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        RestructuringProposal storage prop = restructurings[proposalId];
        if (prop.status != RestructuringStatus.APPROVED) revert RestructuringNotApproved(proposalId);
        prop.status = RestructuringStatus.EXECUTED;
        emit RestructuringExecuted(proposalId, prop.bondId);

        if (prop.newCouponRateBps > 0 && couponService != address(0)) {
            ICouponService(couponService).setCouponRate(prop.bondId, prop.newCouponRateBps);
            emit CouponRateUpdated(prop.bondId, prop.newCouponRateBps);
        }
    }

    /// @notice Reject a proposed restructuring.
    function rejectRestructuring(bytes32 proposalId)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        RestructuringProposal storage prop = restructurings[proposalId];
        if (prop.status == RestructuringStatus.EXECUTED || prop.status == RestructuringStatus.REJECTED)
            revert RestructuringCannotReject(proposalId);
        prop.status = RestructuringStatus.REJECTED;
        emit RestructuringRejected(proposalId);
    }

    // ─── Tender Offer (ICMA: issuer buy-back at premium within window) ─────────

    /// @notice Schedule a tender offer. Holders may tender during [openDate, closeDate].
    function scheduleTenderOffer(
        bytes32 bondId,
        uint256 openDate,
        uint256 closeDate,
        uint256 tenderPriceBps
    ) external onlyRole(CORPORATE_ACTION_ROLE) {
        tenderOffers[bondId] = TenderOffer({
            tenderPriceBps: tenderPriceBps,
            openDate: openDate,
            closeDate: closeDate,
            executed: false
        });
        emit TenderOfferScheduled(bondId, openDate, closeDate, tenderPriceBps);
    }

    /// @notice Holder tenders `amount` bonds during the tender window.
    ///         CorporateActionService must hold sufficient CBDC.
    function tenderBonds(bytes32 bondId, uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        TenderOffer storage offer = tenderOffers[bondId];
        if (offer.tenderPriceBps == 0) revert TenderOfferNotActive(bondId);
        if (offer.executed) revert TenderOfferAlreadyExecuted(bondId);
        if (block.timestamp < offer.openDate) revert TenderWindowNotOpen(bondId, offer.openDate, block.timestamp);
        if (block.timestamp > offer.closeDate) revert TenderWindowClosed(bondId, offer.closeDate, block.timestamp);

        uint256 pay = amount * offer.tenderPriceBps / 10000;
        uint256 balance = IERC20(address(cbToken)).balanceOf(address(this));
        if (balance < pay) revert InsufficientActionFunds(bondId, pay, balance);

        lifecycle.transition(bondId, msg.sender, amount, SECONDARY, MATURED, "");
        if (pay > 0) IERC20(address(cbToken)).safeTransfer(msg.sender, pay);

        emit PutOptionExercised(bondId, msg.sender, amount, pay); // reuse event — same semantic
    }

    /// @notice Close the tender offer after window expires (marks executed).
    function closeTenderOffer(bytes32 bondId) external onlyRole(CORPORATE_ACTION_ROLE) {
        TenderOffer storage offer = tenderOffers[bondId];
        if (offer.tenderPriceBps == 0) revert TenderOfferNotActive(bondId);
        if (offer.executed) revert TenderOfferAlreadyExecuted(bondId);
        if (block.timestamp <= offer.closeDate) revert TenderWindowNotOpen(bondId, offer.closeDate, block.timestamp);
        offer.executed = true;
        uint256 remaining = token.totalSupplyByBond(bondId, SECONDARY);
        emit TenderOfferExecuted(bondId, remaining, 0);
    }

    // ─── Consent Solicitation (ICMA: holder vote on indenture amendments) ─────

    /// @notice Propose a consent solicitation. Holders vote by weight (SECONDARY balance).
    function proposeConsent(
        bytes32 bondId,
        string calldata description,
        uint256 votingDurationDays,
        uint256 quorumBps
    ) external onlyRole(CORPORATE_ACTION_ROLE) returns (bytes32 proposalId) {
        proposalId = keccak256(abi.encode(++_consentNonce, bondId));
        consentProposals[proposalId] = ConsentProposal({
            bondId: bondId,
            description: description,
            votingDeadline: 0,
            quorumBps: quorumBps,
            votesFor: 0,
            votesAgainst: 0,
            status: ConsentStatus.ACTIVE,
            finalized: false
        });
        emit ConsentProposed(proposalId, bondId, block.timestamp + votingDurationDays * 1 days);
        _lastProposalId = proposalId;
    }

    // Pente-compat: no return value; no string param (avoids Pente issues)
    function proposeConsentV2(bytes32 bondId, uint256 votingDurationDays, uint256 quorumBps)
        external onlyRole(CORPORATE_ACTION_ROLE) {
        bytes32 proposalId = keccak256(abi.encode(++_consentNonce, bondId));
        _lastProposalId = proposalId;
        consentProposals[proposalId] = ConsentProposal({ bondId: bondId, description: "", votingDeadline: 0, quorumBps: quorumBps, votesFor: 0, votesAgainst: 0, status: ConsentStatus.ACTIVE, finalized: false });
        emit ConsentProposed(proposalId, bondId, block.timestamp + votingDurationDays * 1 days);
    }

    function getLastProposalId() external view returns (bytes32) { return _lastProposalId; }

    /// @notice Holder votes on a consent proposal. Weight = SECONDARY balance.
    function voteConsent(bytes32 proposalId, bool inFavor) external {
        ConsentProposal storage prop = consentProposals[proposalId];
        if (prop.bondId == bytes32(0)) revert ConsentProposalNotFound(proposalId);
        if (prop.finalized) revert ConsentAlreadyFinalized(proposalId);
        if (_hasVotedConsent[proposalId][msg.sender]) revert AlreadyVoted(proposalId, msg.sender);

        uint256 weight = token.balanceOfByBond(prop.bondId, SECONDARY, msg.sender);
        if (weight == 0) revert InsufficientVotingWeight(msg.sender);

        _hasVotedConsent[proposalId][msg.sender] = true;
        if (inFavor) {
            prop.votesFor += weight;
        } else {
            prop.votesAgainst += weight;
        }
        emit ConsentVoted(proposalId, msg.sender, inFavor, weight);
    }

    /// @notice Finalize consent after voting deadline. Checks quorum against SECONDARY supply.
    function finalizeConsent(bytes32 proposalId) external onlyRole(CORPORATE_ACTION_ROLE) {
        ConsentProposal storage prop = consentProposals[proposalId];
        if (prop.bondId == bytes32(0)) revert ConsentProposalNotFound(proposalId);
        if (prop.finalized) revert ConsentAlreadyFinalized(proposalId);

        uint256 totalSupply = token.totalSupplyByBond(prop.bondId, SECONDARY);
        uint256 requiredVotes = totalSupply * prop.quorumBps / 10000;
        bool passed = prop.votesFor >= requiredVotes;
        prop.finalized = true;
        prop.status = passed ? ConsentStatus.PASSED : ConsentStatus.REJECTED;
        emit ConsentFinalized(proposalId, passed);
    }
}
