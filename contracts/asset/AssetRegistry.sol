// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {IAssetRegistry} from "../interfaces/asset/IAssetRegistry.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ZeroAddress, AssetAlreadyRegistered, NotFound} from "../library/Errors.sol";

/// @title AssetRegistry
/// @notice Master registry mapping assetId to deployed contract addresses
/// @dev Services use this to discover asset contract addresses. TOKEN_FACTORY_ROLE can register/deactivate.
contract AssetRegistry is IAssetRegistry, AccessControl {
    bytes32 public constant TOKEN_FACTORY_ROLE = keccak256("TOKEN_FACTORY_ROLE");
    
    mapping(bytes32 => AssetInfo) private _assetInfo;
    mapping(bytes32 => bytes32[]) private _assetsByType;
    
    event AssetRegistered(bytes32 indexed assetId, address indexed assetAddress, bytes32 assetType);
    event AssetDeactivated(bytes32 indexed assetId);
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(TOKEN_FACTORY_ROLE, msg.sender);
    }
    
    function registerAsset(bytes32 assetId, address assetAddress, bytes32 assetType) 
        external 
        onlyRole(TOKEN_FACTORY_ROLE) 
    {
        if (assetAddress == address(0)) revert ZeroAddress();
        if (_assetInfo[assetId].assetAddress != address(0)) revert AssetAlreadyRegistered(assetId);
        
        _assetInfo[assetId] = AssetInfo({
            assetAddress: assetAddress,
            assetType: assetType,
            createdAt: block.timestamp,
            isActive: true
        });
        
        _assetsByType[assetType].push(assetId);
        
        emit AssetRegistered(assetId, assetAddress, assetType);
    }
    
    function getAsset(bytes32 assetId) external view returns (address) {
        return _assetInfo[assetId].assetAddress;
    }
    
    function getAssetInfo(bytes32 assetId) external view returns (AssetInfo memory) {
        return _assetInfo[assetId];
    }
    
    function deactivateAsset(bytes32 assetId) external onlyRole(TOKEN_FACTORY_ROLE) {
        if (_assetInfo[assetId].assetAddress == address(0)) revert NotFound(assetId);
        _assetInfo[assetId].isActive = false;
        emit AssetDeactivated(assetId);
    }
    
    function listAssets(bytes32 assetType) external view returns (bytes32[] memory) {
        return _assetsByType[assetType];
    }
}