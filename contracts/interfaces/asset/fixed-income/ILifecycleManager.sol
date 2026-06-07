// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/// @title ILifecycleManager
/// @notice Interface for the partition lifecycle state machine.
interface ILifecycleManager {
    enum LifecycleState { PRIMARY, SECONDARY, REPO, PLEDGED, LENT, LOCKED, MATURED, DEFAULTED }

    function transition(bytes32 bondId, address holder, uint256 amount, bytes32 fromState, bytes32 toState, bytes calldata data) external;
    function canTransition(bytes32 bondId, bytes32 fromState, bytes32 toState, address caller) external view returns (bool);
    function matureBond(bytes32 bondId) external;
    function declareDefault(bytes32 bondId) external;
    function getState(bytes32 bondId) external view returns (LifecycleState);

    // Pagination methods
    function matureBondPaginated(bytes32 bondId, uint256 startIndex, uint256 endIndex) external returns (uint256 lastIndex, bool hasMore);
    function declareDefaultPaginated(bytes32 bondId, uint256 startIndex, uint256 endIndex) external returns (uint256 lastIndex, bool hasMore);

    // Bond management functions
    function registerBond(address bond, uint256 maturityDate) external returns (bytes32 bondId);
    function isMatured(bytes32 bondId) external view returns (bool);
    function getBondInfo(bytes32 bondId) external view returns (address bond, uint256 maturityDate, bool isActive, bool isMatured, bool isDefaulted);
    function getActiveBonds() external view returns (bytes32[] memory);
    function getDefaultedBonds() external view returns (bytes32[] memory);
    function getSecondaryHolders(bytes32 bondId) external view returns (address[] memory);
    function getAllHolders(bytes32 bondId) external view returns (address[] memory);

    /// @notice Register a holder that received bonds directly into PRIMARY partition (via issuance).
    function registerHolder(bytes32 bondId, address holder) external;

    /// @notice Transfer bond between two different holders (e.g. pledge enforcement: pledgor → pledgee).
    function crossHolderTransition(
        bytes32 bondId,
        address fromHolder,
        address toHolder,
        uint256 amount,
        bytes32 fromState,
        bytes32 toState
    ) external;
}