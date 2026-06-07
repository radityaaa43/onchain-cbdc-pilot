// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IAssetRegistry} from "../../interfaces/asset/IAssetRegistry.sol";
import {FixedIncomeToken} from "../../asset/fixed-income/FixedIncomeToken.sol";
import {IShariahComplianceService} from "../../interfaces/service/asset-support/IShariahComplianceService.sol";
import {ZeroAddress, InvalidAssetId, AssetAlreadyRegistered, MinQuotaNotMet} from "../../library/Errors.sol";

/**
 * @title SecuritiesTokenFactory
 * @notice Creates fixed income token proxy instances (SRBI, SBN, Sukuk).
 * @custom:security-contact security@yourproject.xyz
 */
contract SecuritiesTokenFactory is Initializable, AccessControlUpgradeable, UUPSUpgradeable {
    bytes32 public constant FACTORY_ROLE = keccak256("FACTORY_ROLE");

    uint256 public constant MIN_QUOTA = 1_000_000 ether;

    IAssetRegistry public assetRegistry;
    address public shariahComplianceService;

    uint256[49] private __gap;

    event SecuritiesTokenCreated(bytes32 indexed assetId, address indexed tokenAddress, uint256 assetType);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(address assetRegistry_, address admin_) external initializer {
        if (assetRegistry_ == address(0)) revert ZeroAddress();
        if (admin_ == address(0)) revert ZeroAddress();
        __AccessControl_init();

        assetRegistry = IAssetRegistry(assetRegistry_);
        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(FACTORY_ROLE, admin_);
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    function setShariahComplianceService(address _service) external onlyRole(DEFAULT_ADMIN_ROLE) {
        shariahComplianceService = _service;
    }

    function createSRBIToken(bytes32 assetId, uint256 minQuota, string memory name, string memory symbol)
        external
        onlyRole(FACTORY_ROLE)
        returns (address tokenAddress)
    {
        if (assetId == bytes32(0)) revert InvalidAssetId();
        if (assetRegistry.getAsset(assetId) != address(0)) revert AssetAlreadyRegistered(assetId);
        if (minQuota < MIN_QUOTA) revert MinQuotaNotMet(minQuota, MIN_QUOTA);
        tokenAddress = _deployFixedIncomeToken(name, symbol);
        assetRegistry.registerAsset(assetId, tokenAddress, bytes32(uint256(1)));
        emit SecuritiesTokenCreated(assetId, tokenAddress, 1);
    }

    function createSBNToken(bytes32 assetId, string memory name, string memory symbol)
        external
        onlyRole(FACTORY_ROLE)
        returns (address tokenAddress)
    {
        if (assetId == bytes32(0)) revert InvalidAssetId();
        if (assetRegistry.getAsset(assetId) != address(0)) revert AssetAlreadyRegistered(assetId);
        tokenAddress = _deployFixedIncomeToken(name, symbol);
        assetRegistry.registerAsset(assetId, tokenAddress, bytes32(uint256(2)));
        emit SecuritiesTokenCreated(assetId, tokenAddress, 2);
    }

    function createSukukToken(bytes32 assetId, address shariahBoard, string memory name, string memory symbol)
        external
        onlyRole(FACTORY_ROLE)
        returns (address tokenAddress)
    {
        if (assetId == bytes32(0)) revert InvalidAssetId();
        if (shariahBoard == address(0)) revert ZeroAddress();
        if (assetRegistry.getAsset(assetId) != address(0)) revert AssetAlreadyRegistered(assetId);
        tokenAddress = _deployFixedIncomeToken(name, symbol);
        assetRegistry.registerAsset(assetId, tokenAddress, bytes32(uint256(3)));
        if (shariahComplianceService != address(0)) {
            IShariahComplianceService(shariahComplianceService).approveSukuk(assetId, shariahBoard);
        }
        emit SecuritiesTokenCreated(assetId, tokenAddress, 3);
    }

    function _deployFixedIncomeToken(string memory name, string memory symbol)
        internal
        returns (address)
    {
        FixedIncomeToken implementation = new FixedIncomeToken();
        address[] memory controllers = new address[](0);
        bytes32[] memory defaultPartitions = new bytes32[](0);
        bytes memory initData = abi.encodeCall(
            FixedIncomeToken.initialize,
            (name, symbol, 1e18, controllers, defaultPartitions, block.chainid, msg.sender)
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        return address(proxy);
    }
}
