// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

interface IDVPService {
    enum SettlementModel { SECURITIES_FIRST, MONEY_FIRST, PARALLEL }
    enum SettlementStatus { PENDING, CONFIRMED, FAILED, CANCELLED, AWAITING_AFFIRMATION }

    struct DVPSettlement {
        bytes32 settlementId;
        bytes32 bondId;
        address bondSeller;
        address bondBuyer;
        uint256 bondAmount;
        bytes32 fromState; // lifecycle state seller holds bonds in (PRIMARY or SECONDARY)
        bytes32 toState;   // lifecycle state buyer receives bonds in (PRIMARY or SECONDARY)
        address cbdcPayer;
        address cbdcPayee;
        uint256 cbdcAmount;
        SettlementModel model;
        SettlementStatus status;
        uint256 createdAt;
        uint256 settlementDeadline; // 0 = no deadline; set by initiateDVPWithAffirmation
        bool sellerAffirmed;
        bool buyerAffirmed;
        string failureReason;
    }

    function initiateDVP(
        bytes32 bondId,
        address bondSeller,
        address bondBuyer,
        uint256 bondAmount,
        bytes32 fromState,
        bytes32 toState,
        address cbdcPayer,
        address cbdcPayee,
        uint256 cbdcAmount,
        SettlementModel model
    ) external returns (bytes32 settlementId);

    /// @notice Initiate DVP requiring bilateral affirmation before confirmation.
    ///         settlementWindowSeconds: window for both parties to affirm and operator to confirm.
    function initiateDVPWithAffirmation(
        bytes32 bondId,
        address bondSeller,
        address bondBuyer,
        uint256 bondAmount,
        bytes32 fromState,
        bytes32 toState,
        address cbdcPayer,
        address cbdcPayee,
        uint256 cbdcAmount,
        SettlementModel model,
        uint256 settlementWindowSeconds
    ) external returns (bytes32 settlementId);

    /// @notice Seller or buyer affirms trade details. Both must affirm before confirmDVP.
    function affirmDVP(bytes32 settlementId) external;

    function confirmDVP(bytes32 settlementId) external;
    function cancelDVP(bytes32 settlementId, string calldata reason) external;
    function getDVPStatus(bytes32 settlementId) external view returns (DVPSettlement memory);

    /// @notice Calculate dirty price (clean price + accrued interest) for a DVP leg.
    ///         bondState: state hash of the partition being traded (e.g. SECONDARY, PRIMARY).
    ///         Requires couponService to be set via setCouponService().
    function calculateSettlementAmount(
        bytes32 bondId,
        uint256 bondAmount,
        uint256 cleanPriceBps,
        bytes32 bondState
    ) external view returns (uint256 cleanAmount, uint256 accruedInterest, uint256 total);
}
