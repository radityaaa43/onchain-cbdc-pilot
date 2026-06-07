// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./ICMATypes.sol";
import "../../interfaces/asset/fixed-income/IBondMetadataRegistry.sol";

/// @title BondMetadataRegistry
/// @notice Stores ICMA BDT v1.2 compliant metadata for a single bond series.
/// @dev Deploy one instance per bond series. DATA_MANAGER_ROLE can update fields.
contract BondMetadataRegistry is IBondMetadataRegistry, AccessControl {

    bytes32 public constant DATA_MANAGER_ROLE = keccak256("DATA_MANAGER_ROLE");

    ICMATypes.BondStaticData private _bondStaticData;
    ICMATypes.BondTerms private _bondTerms;
    ICMATypes.DltPlatformData private _dltPlatformData;
    ICMATypes.CreditEvents private _creditEvents;
    ICMATypes.BondRatings private _bondRatings;
    ICMATypes.IndonesianMarketData private _indonesianMarketData;

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(DATA_MANAGER_ROLE, admin);
    }

    // ──────────────── Getters ────────────────

    function bondStaticData() external view override returns (ICMATypes.BondStaticData memory) {
        return _bondStaticData;
    }

    function bondTerms() external view override returns (ICMATypes.BondTerms memory) {
        return _bondTerms;
    }

    function dltPlatformData() external view override returns (ICMATypes.DltPlatformData memory) {
        return _dltPlatformData;
    }

    function creditEvents() external view override returns (ICMATypes.CreditEvents memory) {
        return _creditEvents;
    }

    function bondRatings() external view override returns (ICMATypes.BondRatings memory) {
        return _bondRatings;
    }

    function indonesianMarketData() external view override returns (ICMATypes.IndonesianMarketData memory) {
        return _indonesianMarketData;
    }

    // ──────────────── Setters ────────────────

    function setBondStaticData(ICMATypes.BondStaticData calldata data) external override onlyRole(DATA_MANAGER_ROLE) {
        _bondStaticData = data;
        emit BondStaticDataUpdated(msg.sender);
    }

    function setBondTerms(ICMATypes.BondTerms calldata data) external override onlyRole(DATA_MANAGER_ROLE) {
        _bondTerms = data;
        emit BondTermsUpdated(msg.sender);
    }

    function setDltPlatformData(ICMATypes.DltPlatformData calldata data) external override onlyRole(DATA_MANAGER_ROLE) {
        _dltPlatformData = data;
        emit DltPlatformDataUpdated(msg.sender);
    }

    function setCreditEvents(ICMATypes.CreditEvents calldata events) external override onlyRole(DATA_MANAGER_ROLE) {
        _creditEvents = events;
        emit CreditEventsUpdated(msg.sender);
    }

    function setBondRatings(ICMATypes.BondRatings calldata ratings) external override onlyRole(DATA_MANAGER_ROLE) {
        _bondRatings = ratings;
        emit BondRatingsUpdated(msg.sender);
    }

    function setIndonesianMarketData(ICMATypes.IndonesianMarketData calldata data) external override onlyRole(DATA_MANAGER_ROLE) {
        _indonesianMarketData = data;
        emit IndonesianMarketDataUpdated(msg.sender);
    }

    // ──────────────── Convenience Queries ────────────────

    function isSyariah() external view override returns (bool) {
        bytes32 typeHash = keccak256(bytes(_bondTerms.interestType));
        return (
            typeHash == keccak256("Syariah_Ijarah") ||
            typeHash == keccak256("Syariah_Mudharabah") ||
            typeHash == keccak256("Syariah_Wakalah")
        );
    }

    function isMatured() external view override returns (bool) {
        return _creditEvents.flagRedeemed;
    }

    function interestType() external view override returns (string memory) {
        return _bondTerms.interestType;
    }
}
