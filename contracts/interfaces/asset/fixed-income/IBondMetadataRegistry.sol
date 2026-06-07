// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "../../../asset/fixed-income/ICMATypes.sol";

/// @title IBondMetadataRegistry
/// @notice Interface for ICMA BDT v1.2 compliant bond metadata storage.
interface IBondMetadataRegistry {
    // ──────────────── Getters ────────────────
    function bondStaticData() external view returns (ICMATypes.BondStaticData memory);
    function bondTerms() external view returns (ICMATypes.BondTerms memory);
    function dltPlatformData() external view returns (ICMATypes.DltPlatformData memory);
    function creditEvents() external view returns (ICMATypes.CreditEvents memory);
    function bondRatings() external view returns (ICMATypes.BondRatings memory);
    function indonesianMarketData() external view returns (ICMATypes.IndonesianMarketData memory);

    // ──────────────── Setters (permissioned) ────────────────
    function setBondStaticData(ICMATypes.BondStaticData calldata data) external;
    function setBondTerms(ICMATypes.BondTerms calldata data) external;
    function setDltPlatformData(ICMATypes.DltPlatformData calldata data) external;
    function setCreditEvents(ICMATypes.CreditEvents calldata events) external;
    function setBondRatings(ICMATypes.BondRatings calldata ratings) external;
    function setIndonesianMarketData(ICMATypes.IndonesianMarketData calldata data) external;

    // ──────────────── Convenience Queries ────────────────
    function isSyariah() external view returns (bool);
    function isMatured() external view returns (bool);
    function interestType() external view returns (string memory);

    // ──────────────── Events ────────────────
    event BondStaticDataUpdated(address indexed updater);
    event BondTermsUpdated(address indexed updater);
    event CreditEventsUpdated(address indexed updater);
    event DltPlatformDataUpdated(address indexed updater);
    event BondRatingsUpdated(address indexed updater);
    event IndonesianMarketDataUpdated(address indexed updater);
}
