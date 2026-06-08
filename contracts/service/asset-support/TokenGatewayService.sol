// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {ITokenGatewayService} from "../../interfaces/service/asset-support/ITokenGatewayService.sol";
import {IAssetRegistry} from "../../interfaces/asset/IAssetRegistry.sol";
import {CBToken} from "../../asset/cbdc/CBToken.sol";
import {FixedIncomeToken} from "../../asset/fixed-income/FixedIncomeToken.sol";
import {ZeroAddress, InvalidAssetId, AssetAlreadyRegistered, MinQuotaNotMet} from "../../library/Errors.sol";

/**
 * @title TokenGatewayService
 * @notice Factory for creating new asset proxy instances and registering in AssetRegistry.
 *         Deploys implementation + ERC1967Proxy for each new asset.
 * @custom:security-contact security@yourproject.xyz
 */
contract TokenGatewayService is Initializable, AccessControlUpgradeable, UUPSUpgradeable, ITokenGatewayService {
    bytes32 public constant TOKEN_FACTORY_ROLE = keccak256("TOKEN_FACTORY_ROLE");

    IAssetRegistry public assetRegistry;

    struct AssetInfo {
        address assetAddress;
        AssetType assetType;
        uint256 createdAt;
    }

    mapping(bytes32 => AssetInfo) private _assetInfo;

    uint256[50] private __gap;

    event AssetCreated(bytes32 indexed assetId, address indexed assetAddress, AssetType assetType);

    function initialize(address assetRegistry_, address admin_) external initializer {
        if (assetRegistry_ == address(0)) revert ZeroAddress();
        if (admin_ == address(0)) revert ZeroAddress();
        __AccessControl_init();

        assetRegistry = IAssetRegistry(assetRegistry_);
        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(TOKEN_FACTORY_ROLE, admin_);
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    function createAsset(AssetType assetType, bytes32 assetId, bytes calldata initData)
        external
        onlyRole(TOKEN_FACTORY_ROLE)
        returns (address assetAddress)
    {
        if (assetId == bytes32(0)) revert InvalidAssetId();
        if (isAssetRegistered(assetId)) revert AssetAlreadyRegistered(assetId);

        if (assetType == AssetType.CBDC) {
            assetAddress = _createCBToken(assetId, initData);
        } else if (assetType == AssetType.SRBI || assetType == AssetType.SBN) {
            assetAddress = _createFixedIncomeToken(assetId, assetType, initData);
        } else if (
            assetType == AssetType.SUKUK_IJARAH ||
            assetType == AssetType.SUKUK_MUDHARABAH ||
            assetType == AssetType.SUKUK_WAKALAH
        ) {
            assetAddress = _createSukuk(assetId, assetType, initData);
        } else {
            revert("Invalid asset type");
        }

        assetRegistry.registerAsset(assetId, assetAddress, bytes32(uint256(assetType)));

        _assetInfo[assetId] = AssetInfo({
            assetAddress: assetAddress,
            assetType: assetType,
            createdAt: 0
        });

        emit AssetCreated(assetId, assetAddress, assetType);
    }

    function getAssetAddress(bytes32 assetId) external view returns (address) {
        return _assetInfo[assetId].assetAddress;
    }

    function getAssetType(bytes32 assetId) external view returns (AssetType) {
        return _assetInfo[assetId].assetType;
    }

    function isAssetRegistered(bytes32 assetId) public view returns (bool) {
        return _assetInfo[assetId].assetAddress != address(0);
    }

    function _createCBToken(bytes32, bytes calldata initData) internal returns (address) {
        (string memory name, string memory symbol, uint8 decimals) = initData.length >= 96
            ? abi.decode(initData, (string, string, uint8))
            : ("CBDC Token", "CBDC", uint8(18));

        CBToken impl = new CBToken();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(impl),
            abi.encodeCall(CBToken.initialize, (name, symbol, decimals, msg.sender))
        );
        return address(proxy);
    }

    function _createFixedIncomeToken(bytes32, AssetType assetType, bytes calldata initData) internal returns (address) {
        if (assetType == AssetType.SRBI && initData.length >= 32) {
            (uint256 minQuota) = abi.decode(initData, (uint256));
            if (minQuota < 1_000_000 ether) revert MinQuotaNotMet(minQuota, 1_000_000 ether);
        }
        return _deployFITProxy("Fixed Income", "FI");
    }

    function _createSukuk(bytes32, AssetType, bytes calldata initData) internal returns (address) {
        if (initData.length >= 20) {
            address shariahBoard = abi.decode(initData, (address));
            if (shariahBoard == address(0)) revert ZeroAddress();
        }
        return _deployFITProxy("Sukuk", "SUKUK");
    }

    function _deployFITProxy(string memory name, string memory symbol) internal returns (address) {
        FixedIncomeToken impl = new FixedIncomeToken();
        address[] memory controllers = new address[](0);
        bytes32[] memory defaultPartitions = new bytes32[](0);
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(impl),
            abi.encodeCall(
                FixedIncomeToken.initialize,
                (name, symbol, 1e18, controllers, defaultPartitions, block.chainid, msg.sender)
            )
        );
        return address(proxy);
    }
}
