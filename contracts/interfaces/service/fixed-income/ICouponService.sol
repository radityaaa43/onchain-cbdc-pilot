// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/// @title ICouponService
/// @notice Interface for bond coupon payment management
interface ICouponService {
    struct CouponPayment {
        uint256 couponId;
        bytes32 bondId;
        uint256 amount;
        uint256 paymentDate;
        bool isPaid;
    }

    function calculateCoupon(bytes32 bondId) external view returns (uint256);

    function payCoupon(bytes32 bondId, address recipient) external returns (uint256);

    function getCouponStatus(bytes32 bondId, uint256 couponId) external view returns (CouponPayment memory);

    function setCouponRate(bytes32 bondId, uint256 newRateBps) external;
}