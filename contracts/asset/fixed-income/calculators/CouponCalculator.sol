// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "../../../interfaces/asset/fixed-income/IReturnCalculator.sol";

/// @title CouponCalculator
/// @notice Calculates periodic coupon returns for fixed/floating/zero coupon bonds.
/// @dev Supports ACT/365, ACT/360, and 30/360 day count conventions.
contract CouponCalculator is IReturnCalculator {

    uint256 private constant SECONDS_PER_DAY = 86400;
    uint256 private constant BPS_DIVISOR = 10000;

    function calculate(CalculationParams calldata params) external pure override returns (uint256 amount) {
        if (params.rateBps == 0 || params.periodEnd <= params.periodStart) {
            return 0;
        }

        uint256 dayCount;
        uint256 yearBasis;

        if (params.dayCountConvention == 2) {
            dayCount = _calc30360(params.periodStart, params.periodEnd);
            yearBasis = 360;
        } else {
            dayCount = (params.periodEnd - params.periodStart) / SECONDS_PER_DAY;
            yearBasis = params.dayCountConvention == 0 ? 365 : 360;
            if (params.dayCountConvention > 1) revert("Unsupported day count convention");
        }

        amount = (params.principal * params.rateBps * dayCount) / (yearBasis * BPS_DIVISOR);
    }

    function calculatorType() external pure override returns (string memory) {
        return "CouponCalculator";
    }

    function _timestampToDate(uint256 timestamp) internal pure returns (uint256 year, uint256 month, uint256 day) {
        uint256 z = timestamp / SECONDS_PER_DAY + 719468;
        uint256 era = z / 146097;
        uint256 doe = z - era * 146097;
        uint256 yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
        year = yoe + era * 400;
        uint256 doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
        uint256 mp = (5 * doy + 2) / 153;
        day = doy - (153 * mp + 2) / 5 + 1;
        month = mp < 10 ? mp + 3 : mp - 9;
        if (month <= 2) year += 1;
    }

    function _calc30360(uint256 startTimestamp, uint256 endTimestamp) internal pure returns (uint256) {
        (uint256 y1, uint256 m1, uint256 d1) = _timestampToDate(startTimestamp);
        (uint256 y2, uint256 m2, uint256 d2) = _timestampToDate(endTimestamp);
        uint256 dd1 = d1 < 30 ? d1 : 30;
        uint256 dd2 = d2 < 30 ? d2 : 30;
        return 360 * (y2 - y1) + 30 * (m2 - m1) + dd2 - dd1;
    }
}
