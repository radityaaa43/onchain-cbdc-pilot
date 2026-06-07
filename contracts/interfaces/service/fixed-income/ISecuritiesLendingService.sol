// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

interface ISecuritiesLendingService {
    struct LendAgreement {
        bytes32 lendId;
        bytes32 bondId;
        address lender;
        address borrower;
        uint256 amount;
        uint256 lendingFeeRateBps;
        uint256 collateralAmount;
        uint256 startDate;
        uint256 tenor;
        uint256 recallDate;
        bool isActive;
    }

    function initiateLend(
        bytes32 bondId,
        address lender,
        address borrower,
        uint256 amount,
        uint256 feeRateBps,
        uint256 tenor
    ) external returns (bytes32 lendId);

    function returnSecurities(bytes32 lendId) external;

    function recallLoan(bytes32 lendId) external;

    function defaultOnLoan(bytes32 lendId) external;

    function getLend(bytes32 lendId) external view returns (LendAgreement memory);
}