// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IAssetRegistry} from "../../interfaces/asset/IAssetRegistry.sol";
import {CBToken} from "../../asset/cbdc/CBToken.sol";
import {ZeroAddress, InvalidAssetId, AssetAlreadyRegistered} from "../../library/Errors.sol";

/**
 * @title CashTokenFactory
 * @notice Creates CBDC token proxy instances.
 *         Deploys a new CBToken implementation + ERC1967Proxy per token.
 * @custom:security-contact security@yourproject.xyz
 */
contract CashTokenFactory is Initializable, AccessControlUpgradeable, UUPSUpgradeable {
    bytes32 public constant FACTORY_ROLE = keccak256("FACTORY_ROLE");

    IAssetRegistry public assetRegistry;

    uint256[50] private __gap;

    event CashTokenCreated(bytes32 indexed assetId, address indexed tokenAddress);

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

    function createToken(bytes32 assetId, string memory name, string memory symbol)
        external
        onlyRole(FACTORY_ROLE)
        returns (address tokenAddress)
    {
        if (assetId == bytes32(0)) revert InvalidAssetId();
        if (assetRegistry.getAsset(assetId) != address(0)) revert AssetAlreadyRegistered(assetId);

        CBToken implementation = new CBToken();
        bytes memory initData = abi.encodeCall(
            CBToken.initialize,
            (name, symbol, 18, msg.sender)
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        tokenAddress = address(proxy);

        assetRegistry.registerAsset(assetId, tokenAddress, bytes32(uint256(0)));
        emit CashTokenCreated(assetId, tokenAddress);
    }
}
