// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {FixedIncomeToken} from "./FixedIncomeToken.sol";
import {ILifecycleManager} from "../../interfaces/asset/fixed-income/ILifecycleManager.sol";
import {ZeroAddress, InvalidTransition, BatchSizeExceedsLimit, NoHoldersRegistered, NotLifecycleManager, InvalidBondAddress} from "../../library/Errors.sol";

/**
 * @title LifecycleManager
 * @notice Manages bond lifecycle state transitions and holder registry.
 * @custom:security-contact security@yourproject.xyz
 */
contract LifecycleManager is
    Initializable,
    AccessControlUpgradeable,
    ReentrancyGuard,
    UUPSUpgradeable,
    ILifecycleManager
{
    // ──────────────────────────────────────────────────────
    // Roles
    // ──────────────────────────────────────────────────────
    bytes32 public constant LIFECYCLE_MANAGER_ROLE = keccak256("LIFECYCLE_MANAGER_ROLE");

    // ──────────────────────────────────────────────────────
    // Partition constants
    // ──────────────────────────────────────────────────────
    bytes32 public constant PRIMARY   = keccak256("PRIMARY");
    bytes32 public constant SECONDARY = keccak256("SECONDARY");
    bytes32 public constant REPO      = keccak256("REPO");
    bytes32 public constant PLEDGED   = keccak256("PLEDGED");
    bytes32 public constant LENT      = keccak256("LENT");
    bytes32 public constant LOCKED    = keccak256("LOCKED");
    bytes32 public constant MATURED   = keccak256("MATURED");
    bytes32 public constant DEFAULTED = keccak256("DEFAULTED");

    uint256 public constant MAX_HOLDERS_PER_TX = 50;

    bytes32 private constant PARTITION_CHANGE_FLAG = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;

    // ──────────────────────────────────────────────────────
    // State
    // ──────────────────────────────────────────────────────
    FixedIncomeToken public token;

    mapping(bytes32 => bool) private _allowedTransitions;

    mapping(bytes32 => address[]) private _secondaryHolders;
    mapping(bytes32 => mapping(address => bool)) private _isSecondaryHolder;
    mapping(bytes32 => uint256) private _secondaryHolderCount;

    mapping(bytes32 => address[]) private _allHolders;
    mapping(bytes32 => mapping(address => bool)) private _isAllHolder;
    mapping(bytes32 => uint256) private _allHolderCount;

    struct BondInfo {
        address bondAddress;
        uint256 maturityDate;
        bool isActive;
        bool isMatured;
        bool isDefaulted;
    }

    mapping(bytes32 => BondInfo) private _bondInfo;
    bytes32[] private _activeBonds;
    bytes32[] private _defaultedBonds;
    uint256 private _bondCounter;
    bytes32 private _lastBondId;

    uint256[49] private __gap;

    // ──────────────────────────────────────────────────────
    // Events
    // ──────────────────────────────────────────────────────
    event LifecycleTransition(bytes32 indexed bondId, address indexed holder, bytes32 fromState, bytes32 toState, uint256 amount);
    event BondMatured(bytes32 indexed bondId);
    event BondDefaulted(bytes32 indexed bondId);

    // ──────────────────────────────────────────────────────
    // Constructor / Initializer
    // ──────────────────────────────────────────────────────


    /**
     * @notice Initialize the lifecycle manager.
     * @param tokenAddress_  Address of the FixedIncomeToken proxy
     * @param admin_         Address granted DEFAULT_ADMIN_ROLE + LIFECYCLE_MANAGER_ROLE
     */
    function initialize(address tokenAddress_, address admin_) external initializer {
        if (tokenAddress_ == address(0)) revert ZeroAddress();
        if (admin_ == address(0)) revert ZeroAddress();

        __AccessControl_init();
        


        token = FixedIncomeToken(tokenAddress_);

        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(LIFECYCLE_MANAGER_ROLE, admin_);

        _setTransition(PRIMARY,   SECONDARY, true);
        _setTransition(SECONDARY, SECONDARY, true);
        _setTransition(SECONDARY, REPO,      true);
        _setTransition(REPO,      SECONDARY, true);
        _setTransition(SECONDARY, PLEDGED,   true);
        _setTransition(PLEDGED,   SECONDARY, true);
        _setTransition(SECONDARY, LOCKED,    true);
        _setTransition(LOCKED,    SECONDARY, true);
        _setTransition(SECONDARY, MATURED,   true);
        _setTransition(PRIMARY,   DEFAULTED, true);
        _setTransition(SECONDARY, DEFAULTED, true);
        _setTransition(REPO,      DEFAULTED, true);
        _setTransition(PLEDGED,   DEFAULTED, true);
        _setTransition(LOCKED,    DEFAULTED, true);
        _setTransition(SECONDARY, LENT,      true);
        _setTransition(LENT,      SECONDARY, true);
        _setTransition(LENT,      DEFAULTED, true);
        _setTransition(MATURED,   DEFAULTED, true);
        _setTransition(PLEDGED,   SECONDARY, true);
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    // ──────────────────────────────────────────────────────
    // Modifiers
    // ──────────────────────────────────────────────────────

    modifier onlyLifecycleManager() {
        if (!hasRole(LIFECYCLE_MANAGER_ROLE, msg.sender)) revert NotLifecycleManager(msg.sender);
        _;
    }

    // ──────────────────────────────────────────────────────
    // External: Bond Registry
    // ──────────────────────────────────────────────────────

    function registerBond(address bond, uint256 maturityDate) external override onlyLifecycleManager returns (bytes32 bondId) {
        if (bond == address(0)) revert InvalidBondAddress();

        _bondCounter++;
        bondId = keccak256(abi.encode(_bondCounter, bond, maturityDate));

        _bondInfo[bondId] = BondInfo({
            bondAddress: bond,
            maturityDate: maturityDate,
            isActive: true,
            isMatured: false,
            isDefaulted: false
        });

        _activeBonds.push(bondId);
    }

    // Pente-compat: no return value, no array push — isolates NPE root cause
    function registerBondV2(address bond, uint256 maturityDate) external onlyLifecycleManager {
        if (bond == address(0)) revert InvalidBondAddress();
        _bondCounter++;
        bytes32 bondId = keccak256(abi.encode(_bondCounter, bond, maturityDate));
        _bondInfo[bondId] = BondInfo({
            bondAddress: bond,
            maturityDate: maturityDate,
            isActive: true,
            isMatured: false,
            isDefaulted: false
        });
        _activeBonds.push(bondId);
    }

    // Returns last registered bondId — call after registerBondV2
    function getLastBondId() external view returns (bytes32) {
        if (_activeBonds.length == 0) return bytes32(0);
        return _activeBonds[_activeBonds.length - 1];
    }

    // Pente-compat v3: no return value, no array push, no dynamic storage write except mapping
    function registerBondV3(address bond, uint256 maturityDate) external onlyLifecycleManager {
        if (bond == address(0)) revert InvalidBondAddress();
        _bondCounter++;
        bytes32 bondId = keccak256(abi.encode(_bondCounter, bond, maturityDate));
        _bondInfo[bondId].bondAddress = bond;
        _bondInfo[bondId].maturityDate = maturityDate;
        _bondInfo[bondId].isActive = true;
        _lastBondId = bondId;
    }

    function getLastBondIdV3() external view returns (bytes32) {
        return _lastBondId;
    }

    // ──────────────────────────────────────────────────────
    // External: Transitions
    // ──────────────────────────────────────────────────────

    function transition(
        bytes32 bondId,
        address holder,
        uint256 amount,
        bytes32 fromState,
        bytes32 toState,
        bytes calldata
    ) external override nonReentrant onlyLifecycleManager {
        if (!_allowedTransitions[keccak256(abi.encodePacked(fromState, toState))])
            revert InvalidTransition(fromState, toState);

        bytes32 fromPartition = token.computePartition(bondId, fromState);
        bytes32 toPartition   = token.computePartition(bondId, toState);

        _addAllHolder(bondId, holder);
        if (toState == SECONDARY) _addSecondaryHolder(bondId, holder);

        bytes memory transferData = abi.encodePacked(PARTITION_CHANGE_FLAG, toPartition);
        token.operatorTransferByPartition(fromPartition, holder, holder, amount, transferData, "0x01");

        emit LifecycleTransition(bondId, holder, fromState, toState, amount);
    }

    function crossHolderTransition(
        bytes32 bondId,
        address fromHolder,
        address toHolder,
        uint256 amount,
        bytes32 fromState,
        bytes32 toState
    ) external override nonReentrant onlyLifecycleManager {
        if (!_allowedTransitions[keccak256(abi.encodePacked(fromState, toState))])
            revert InvalidTransition(fromState, toState);

        bytes32 fromPartition = token.computePartition(bondId, fromState);
        bytes32 toPartition   = token.computePartition(bondId, toState);

        _addAllHolder(bondId, toHolder);
        if (toState == SECONDARY) _addSecondaryHolder(bondId, toHolder);

        bytes memory transferData = abi.encodePacked(PARTITION_CHANGE_FLAG, toPartition);
        token.operatorTransferByPartition(fromPartition, fromHolder, toHolder, amount, transferData, "0x01");

        emit LifecycleTransition(bondId, fromHolder, fromState, toState, amount);
    }

    function canTransition(bytes32, bytes32 fromState, bytes32 toState, address) external view override returns (bool) {
        return _allowedTransitions[keccak256(abi.encodePacked(fromState, toState))];
    }

    // ──────────────────────────────────────────────────────
    // External: Maturity & Default
    // ──────────────────────────────────────────────────────

    function matureBond(bytes32 bondId) external override onlyLifecycleManager {
        uint256 count = _allHolderCount[bondId];
        if (count == 0) revert NoHoldersRegistered(bondId);

        address[] memory holders = _allHolders[bondId];
        bytes32 maturedPartition = token.computePartition(bondId, MATURED);
        bytes32[6] memory activeStates = [PRIMARY, SECONDARY, REPO, PLEDGED, LENT, LOCKED];

        for (uint256 i = 0; i < count; i++) {
            address holder = holders[i];
            for (uint256 s = 0; s < 6; s++) {
                uint256 balance = token.balanceOfByBond(bondId, activeStates[s], holder);
                if (balance > 0) {
                    bytes32 fromPartition = token.computePartition(bondId, activeStates[s]);
                    bytes memory transferData = abi.encodePacked(PARTITION_CHANGE_FLAG, maturedPartition);
                    token.operatorTransferByPartition(fromPartition, holder, holder, balance, transferData, "0x01");
                }
            }
        }

        if (_bondInfo[bondId].isActive) {
            _bondInfo[bondId].isActive = false;
            _bondInfo[bondId].isMatured = true;
            _removeFromActiveBonds(bondId);
        }

        emit BondMatured(bondId);
    }

    function declareDefault(bytes32 bondId) external override onlyLifecycleManager {
        uint256 count = _allHolderCount[bondId];
        address[] memory holders = _allHolders[bondId];
        bytes32 defaultPartition = token.computePartition(bondId, DEFAULTED);
        bytes32[7] memory activeStates = [PRIMARY, SECONDARY, REPO, PLEDGED, LENT, LOCKED, MATURED];

        for (uint256 i = 0; i < count; i++) {
            address holder = holders[i];
            for (uint256 s = 0; s < 7; s++) {
                uint256 balance = token.balanceOfByBond(bondId, activeStates[s], holder);
                if (balance > 0) {
                    bytes32 fromPartition = token.computePartition(bondId, activeStates[s]);
                    bytes memory transferData = abi.encodePacked(PARTITION_CHANGE_FLAG, defaultPartition);
                    token.operatorTransferByPartition(fromPartition, holder, holder, balance, transferData, "0x01");
                }
            }
        }

        if (_bondInfo[bondId].isActive) {
            _bondInfo[bondId].isActive = false;
            _bondInfo[bondId].isDefaulted = true;
            _removeFromActiveBonds(bondId);
            _defaultedBonds.push(bondId);
        }

        emit BondDefaulted(bondId);
    }

    function matureBondPaginated(
        bytes32 bondId,
        uint256 startIndex,
        uint256 endIndex
    ) external override onlyLifecycleManager returns (uint256 lastIndex, bool hasMore) {
        uint256 count = _allHolderCount[bondId];
        if (count == 0) revert NoHoldersRegistered(bondId);
        if (startIndex >= count) return (startIndex, false);
        if (endIndex > count) endIndex = count;
        if (endIndex - startIndex > MAX_HOLDERS_PER_TX)
            revert BatchSizeExceedsLimit(endIndex - startIndex, MAX_HOLDERS_PER_TX);

        address[] memory holders = _allHolders[bondId];
        bytes32 maturedPartition = token.computePartition(bondId, MATURED);
        bytes32[6] memory activeStates = [PRIMARY, SECONDARY, REPO, PLEDGED, LENT, LOCKED];

        for (uint256 i = startIndex; i < endIndex; i++) {
            address holder = holders[i];
            for (uint256 s = 0; s < 6; s++) {
                uint256 balance = token.balanceOfByBond(bondId, activeStates[s], holder);
                if (balance > 0) {
                    bytes32 fromPartition = token.computePartition(bondId, activeStates[s]);
                    bytes memory transferData = abi.encodePacked(PARTITION_CHANGE_FLAG, maturedPartition);
                    token.operatorTransferByPartition(fromPartition, holder, holder, balance, transferData, "0x01");
                }
            }
        }

        if (endIndex == count && _bondInfo[bondId].isActive) {
            _bondInfo[bondId].isActive = false;
            _bondInfo[bondId].isMatured = true;
            _removeFromActiveBonds(bondId);
        }

        emit BondMatured(bondId);
        return (endIndex, endIndex < count);
    }

    function declareDefaultPaginated(
        bytes32 bondId,
        uint256 startIndex,
        uint256 endIndex
    ) external override onlyLifecycleManager returns (uint256 lastIndex, bool hasMore) {
        uint256 count = _allHolderCount[bondId];
        if (startIndex >= count) return (startIndex, false);
        if (endIndex > count) endIndex = count;
        if (endIndex - startIndex > MAX_HOLDERS_PER_TX)
            revert BatchSizeExceedsLimit(endIndex - startIndex, MAX_HOLDERS_PER_TX);

        address[] memory holders = _allHolders[bondId];
        bytes32 defaultPartition = token.computePartition(bondId, DEFAULTED);
        bytes32[7] memory activeStates = [PRIMARY, SECONDARY, REPO, PLEDGED, LENT, LOCKED, MATURED];

        for (uint256 i = startIndex; i < endIndex; i++) {
            address holder = holders[i];
            for (uint256 s = 0; s < 7; s++) {
                uint256 balance = token.balanceOfByBond(bondId, activeStates[s], holder);
                if (balance > 0) {
                    bytes32 fromPartition = token.computePartition(bondId, activeStates[s]);
                    bytes memory transferData = abi.encodePacked(PARTITION_CHANGE_FLAG, defaultPartition);
                    token.operatorTransferByPartition(fromPartition, holder, holder, balance, transferData, "0x01");
                }
            }
        }

        if (endIndex == count && _bondInfo[bondId].isActive) {
            _bondInfo[bondId].isActive = false;
            _bondInfo[bondId].isDefaulted = true;
            _removeFromActiveBonds(bondId);
            _defaultedBonds.push(bondId);
        }

        emit BondDefaulted(bondId);
        return (endIndex, endIndex < count);
    }

    // ──────────────────────────────────────────────────────
    // External: Holder Management
    // ──────────────────────────────────────────────────────

    function addSecondaryHolder(bytes32 bondId, address holder) external onlyLifecycleManager {
        _addSecondaryHolder(bondId, holder);
        _addAllHolder(bondId, holder);
    }

    function registerHolder(bytes32 bondId, address holder) external onlyLifecycleManager {
        _addAllHolder(bondId, holder);
    }

    // ──────────────────────────────────────────────────────
    // External: Views
    // ──────────────────────────────────────────────────────

    function isMatured(bytes32 bondId) external view override returns (bool) {
        return _bondInfo[bondId].isMatured;
    }

    function getBondInfo(bytes32 bondId) external view override returns (
        address bond, uint256 maturityDate, bool isActive, bool isMatured_, bool isDefaulted
    ) {
        BondInfo memory info = _bondInfo[bondId];
        return (info.bondAddress, info.maturityDate, info.isActive, info.isMatured, info.isDefaulted);
    }

    function getActiveBonds() external view override returns (bytes32[] memory) {
        return _activeBonds;
    }

    function getDefaultedBonds() external view override returns (bytes32[] memory) {
        return _defaultedBonds;
    }

    function getSecondaryHolders(bytes32 bondId) external view override returns (address[] memory) {
        uint256 count = _secondaryHolderCount[bondId];
        address[] memory result = new address[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = _secondaryHolders[bondId][i];
        }
        return result;
    }

    function getAllHolders(bytes32 bondId) external view override returns (address[] memory) {
        uint256 count = _allHolderCount[bondId];
        address[] memory result = new address[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = _allHolders[bondId][i];
        }
        return result;
    }

    function getState(bytes32 bondId) external view returns (LifecycleState) {
        uint256 count = _allHolderCount[bondId];
        if (count == 0) return LifecycleState.PRIMARY;

        address[] memory holders = _allHolders[bondId];

        for (uint256 i = 0; i < count; i++) {
            if (token.balanceOfByBond(bondId, DEFAULTED, holders[i]) > 0) return LifecycleState.DEFAULTED;
        }
        for (uint256 i = 0; i < count; i++) {
            if (token.balanceOfByBond(bondId, MATURED, holders[i]) > 0) return LifecycleState.MATURED;
        }
        for (uint256 i = 0; i < count; i++) {
            if (token.balanceOfByBond(bondId, LENT, holders[i]) > 0) return LifecycleState.LENT;
        }
        for (uint256 i = 0; i < count; i++) {
            if (token.balanceOfByBond(bondId, REPO, holders[i]) > 0) return LifecycleState.REPO;
        }
        for (uint256 i = 0; i < count; i++) {
            if (token.balanceOfByBond(bondId, PLEDGED, holders[i]) > 0) return LifecycleState.PLEDGED;
        }
        for (uint256 i = 0; i < count; i++) {
            if (token.balanceOfByBond(bondId, LOCKED, holders[i]) > 0) return LifecycleState.LOCKED;
        }
        for (uint256 i = 0; i < count; i++) {
            if (token.balanceOfByBond(bondId, SECONDARY, holders[i]) > 0) return LifecycleState.SECONDARY;
        }

        return LifecycleState.PRIMARY;
    }

    // ──────────────────────────────────────────────────────
    // Internal
    // ──────────────────────────────────────────────────────

    function _setTransition(bytes32 from, bytes32 to, bool allowed) internal {
        _allowedTransitions[keccak256(abi.encodePacked(from, to))] = allowed;
    }

    function _addSecondaryHolder(bytes32 bondId, address holder) internal {
        if (!_isSecondaryHolder[bondId][holder]) {
            _isSecondaryHolder[bondId][holder] = true;
            _secondaryHolders[bondId].push(holder);
            _secondaryHolderCount[bondId]++;
        }
    }

    function _addAllHolder(bytes32 bondId, address holder) internal {
        if (!_isAllHolder[bondId][holder]) {
            _isAllHolder[bondId][holder] = true;
            _allHolders[bondId].push(holder);
            _allHolderCount[bondId]++;
        }
    }

    function _removeFromActiveBonds(bytes32 bondId) internal {
        for (uint256 i = 0; i < _activeBonds.length; i++) {
            if (_activeBonds[i] == bondId) {
                _activeBonds[i] = _activeBonds[_activeBonds.length - 1];
                _activeBonds.pop();
                break;
            }
        }
    }
}
