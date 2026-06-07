// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/// @title IAssetRegistry
/// @notice Interface for the master registry mapping assetId to deployed contract addresses
interface IAssetRegistry {
    struct AssetInfo {
        address assetAddress;
        bytes32 assetType;
        uint256 createdAt;
        bool isActive;
    }

    function registerAsset(bytes32 assetId, address assetAddress, bytes32 assetType) external;
    function getAsset(bytes32 assetId) external view returns (address);
    function getAssetInfo(bytes32 assetId) external view returns (AssetInfo memory);
    function deactivateAsset(bytes32 assetId) external;
    function listAssets(bytes32 assetType) external view returns (bytes32[] memory);
}