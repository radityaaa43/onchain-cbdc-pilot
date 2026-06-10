// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Shared custom errors for all CBDC + Fixed Income contracts.

// ─── Common ───────────────────────────────────────────────────────────────────
error ZeroAddress();
error ZeroAmount();
error AlreadyProcessed(bytes32 id);
error NotFound(bytes32 id);
error Unauthorized(address caller, bytes32 requiredRole);

// ─── CBDC ─────────────────────────────────────────────────────────────────────
error CBDCInsufficientBalance(address account, uint256 available, uint256 required);
error CBDCBatchLengthMismatch(uint256 recipientsLen, uint256 amountsLen);

// ─── Fixed Income Token ───────────────────────────────────────────────────────
error UnknownPartition(bytes32 partition);
error NotIssuable();
error InsufficientPartitionBalance(address holder, bytes32 partition, uint256 available, uint256 required);
error GranularityViolation(uint256 amount, uint256 granularity);

// ─── Lifecycle ────────────────────────────────────────────────────────────────
error InvalidTransition(bytes32 fromState, bytes32 toState);
error BatchSizeExceedsLimit(uint256 batchSize, uint256 maxSize);
error NoHoldersRegistered(bytes32 bondId);
error BondAlreadyMatured(bytes32 bondId);
error BondAlreadyDefaulted(bytes32 bondId);

// ─── DVP ─────────────────────────────────────────────────────────────────────
error SettlementNotFound(bytes32 settlementId);
error SettlementNotPending(bytes32 settlementId);
error SettlementWindowExpired(bytes32 settlementId, uint256 deadline, uint256 currentTime);
error AffirmationRequired(bytes32 settlementId);
error AlreadyAffirmed(bytes32 settlementId, address affirmer);
error DVPSettlementFailed_InsufficientFunds(bytes32 settlementId);

// ─── Repo ─────────────────────────────────────────────────────────────────────
error RepoNotActive(bytes32 repoId);
error RepoNotDue(bytes32 repoId, uint256 endDate, uint256 currentTime);
error InvalidHaircut(uint256 haircut);
error EarlyTerminationNotAgreed(bytes32 repoId);

// ─── Pledge ───────────────────────────────────────────────────────────────────
error PledgeNotActive(bytes32 pledgeId);
error PledgeNotExpired(bytes32 pledgeId, uint256 expiryDate, uint256 currentTime);

// ─── Securities Lending ───────────────────────────────────────────────────────
error LendNotActive(bytes32 lendId);
error RecallPeriodNotElapsed(bytes32 lendId, uint256 recallDate, uint256 currentTime);

// ─── Coupon ───────────────────────────────────────────────────────────────────
error BondDefaulted(bytes32 bondId);
error BondNotInSecondaryMarket(bytes32 bondId);
error CouponAlreadyPaid(bytes32 bondId, uint256 couponId);
error NoCouponDue(bytes32 bondId);
error InsufficientCouponFunds(bytes32 bondId, uint256 required, uint256 available);

// ─── Redemption ───────────────────────────────────────────────────────────────
error BondNotMatured(bytes32 bondId);
error InsufficientRedemptionFunds(bytes32 bondId, uint256 required, uint256 available);

// ─── Transfer compliance ──────────────────────────────────────────────────────
error ComplianceCheckFailed(string reason);

// ─── Maturity ─────────────────────────────────────────────────────────────────
error MaturityInfoNotSet(bytes32 bondId);
error AlreadyTriggered(bytes32 bondId);
error NotYetMature(bytes32 bondId, uint256 maturityDate, uint256 currentTime);
error InvalidRedemptionPercentage(uint256 pct);

// ─── Securities Lending (additional) ─────────────────────────────────────────
error NotLender(address caller, address lender);

// ─── DVP (additional) ─────────────────────────────────────────────────────────
error InvalidParties();

// ─── Batch / general ─────────────────────────────────────────────────────────
error LengthMismatch(uint256 len1, uint256 len2);
error EmptyArray();
error NotAuthorized();
error SelfTransfer();
error ExceedsIssuedAmount(bytes32 bondId, uint256 requested, uint256 issued);
error RequestNotFound(bytes32 requestId);
error AssetAlreadyRegistered(bytes32 assetId);
error InvalidAssetId();
error MinQuotaNotMet(uint256 provided, uint256 required);
error InvalidShariahBoard();
error CustodianNotRegistered(address custodian);
error NotCustodianOrAdmin(address caller);
error SukukNotShariahApproved(bytes32 bondId);
error InvestorShareExceedsProfit(uint256 investorShare, uint256 totalProfit);
error NotLifecycleManager(address caller);
error InvalidBondAddress();
error CannotAuthorizeSelf();
error InvalidTokenHolder();
error URIEmpty();
error DocumentNotFound();
error InsufficientAllowance(address owner, uint256 available, uint256 required);

// ─── Policy ───────────────────────────────────────────────────────────────────
error AuthenticationExpired(address wallet, uint256 expiredAt);
error BankAlreadyAuthenticated(address wallet, address existingBank);
error PolicySpendingLimitExceeded(address from, uint256 spent, uint256 limit);
error SenderNotAuthenticated();
error BankCannotChangeAuthenticator(address wallet, address existingBank);
error ContractAlreadyAuthenticated(address contractAddress);
error NotBankOrOwner(address caller);
error TransactionLimitExceeded(address from, uint256 amount, uint256 limit);
error BalanceLimitExceeded(address to, uint256 postBalance, uint256 limit);

// ─── Corporate Actions ────────────────────────────────────────────────────────
error CallOptionNotActive(bytes32 bondId);
error CallDateNotReached(bytes32 bondId, uint256 callDate, uint256 currentTime);
error PutOptionNotRegistered(bytes32 bondId);
error PutDateNotReached(bytes32 bondId, uint256 putDate, uint256 currentTime);
error InsufficientActionFunds(bytes32 bondId, uint256 required, uint256 available);
error OptionAlreadyExecuted(bytes32 bondId);
error RestructuringNotProposed(bytes32 proposalId);
error RestructuringNotApproved(bytes32 proposalId);
error RestructuringCannotReject(bytes32 proposalId);

// ─── Netting ─────────────────────────────────────────────────────────────────
error NettingSessionNotFound(bytes32 sessionId);
error NettingSessionAlreadySettled(bytes32 sessionId);
error EmptyNettingSession(bytes32 sessionId);
error ParticipantNotFound(address participant);

// ─── Coupon day count ─────────────────────────────────────────────────────────
error InvalidDayCountConvention(uint256 convention);

// ─── ISIN / CFI ───────────────────────────────────────────────────────────────
error ISINEmpty(bytes32 bondId);

// ─── Repo margin call ─────────────────────────────────────────────────────────
error MarginCallNotActive(bytes32 repoId);
error MarginCallWindowExpired(bytes32 repoId, uint256 deadline, uint256 currentTime);
error MarginCallThresholdNotBreached(bytes32 repoId, uint256 currentValue, uint256 threshold);
error MarginCallsDisabled(bytes32 repoId);

// ─── Tender offer ─────────────────────────────────────────────────────────────
error TenderOfferNotActive(bytes32 bondId);
error TenderWindowNotOpen(bytes32 bondId, uint256 openDate, uint256 currentTime);
error TenderWindowClosed(bytes32 bondId, uint256 closeDate, uint256 currentTime);
error TenderOfferAlreadyExecuted(bytes32 bondId);

// ─── Consent solicitation ─────────────────────────────────────────────────────
error ConsentProposalNotFound(bytes32 proposalId);
error ConsentVotingExpired(bytes32 proposalId, uint256 deadline, uint256 currentTime);
error AlreadyVoted(bytes32 proposalId, address voter);
error QuorumNotReached(bytes32 proposalId, uint256 votesFor, uint256 required);
error ConsentAlreadyFinalized(bytes32 proposalId);
error InsufficientVotingWeight(address holder);

// ─── Settlement buy-in (CSDR) ─────────────────────────────────────────────────
error BuyInWindowNotOpen(bytes32 settlementId, uint256 gracePeriodEnd, uint256 currentTime);
error BuyInAlreadyExecuted(bytes32 settlementId);
