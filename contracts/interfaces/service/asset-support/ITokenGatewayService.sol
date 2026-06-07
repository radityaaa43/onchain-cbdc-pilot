// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/// @title ITokenGatewayService
/// @notice Interface for asset factory + registry — creates new asset instances and registers them
interface ITokenGatewayService {
    enum AssetType { CBDC, SRBI, SBN, SUKUK_IJARAH, SUKUK_MUDHARABAH, SUKUK_WAKALAH }

    function createAsset(AssetType assetType, bytes32 assetId, bytes calldata initData) external returns (address assetAddress);
    function getAssetAddress(bytes32 assetId) external view returns (address);
    function getAssetType(bytes32 assetId) external view returns (AssetType);
    function isAssetRegistered(bytes32 assetId) external view returns (bool);
}