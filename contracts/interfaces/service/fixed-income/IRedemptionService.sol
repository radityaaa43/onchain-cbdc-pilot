// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

interface IRedemptionService {
    function redeem(bytes32 bondId, address holder, uint256 amount) external;

    function getRedemptionTotal(bytes32 bondId) external view returns (uint256);

    /// @notice Check whether this contract holds enough CBDC to redeem the bond.
    ///         Uses principalAmount from MaturityService as the expected redemption notional.
    function hasSufficientFunding(bytes32 bondId)
        external view
        returns (bool sufficient, uint256 required, uint256 available);
}