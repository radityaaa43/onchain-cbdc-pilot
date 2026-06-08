// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ICBToken} from "../../interfaces/asset/fixed-income/ICBToken.sol";
import {ZeroAddress, ZeroAmount, NettingSessionNotFound, NettingSessionAlreadySettled, EmptyNettingSession, ParticipantNotFound} from "../../library/Errors.sol";

/**
 * @title NettingService
 * @notice Bilateral CBDC netting per CPMI-IOSCO Principle 5 (reduction of credit and liquidity risk).
 *         Aggregates gross payment obligations into net bilateral positions before settlement.
 *         Net payers transfer to net receivers; gross transfers never touch the ledger.
 * @custom:security-contact security@yourproject.xyz
 */
contract NettingService is
    Initializable,
    AccessControlUpgradeable,
    ReentrancyGuard,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;

    bytes32 public constant NETTING_OPERATOR_ROLE = keccak256("NETTING_OPERATOR_ROLE");

    enum SessionStatus { OPEN, SETTLED, CANCELLED }

    struct NettingEntry {
        address from;
        address to;
        uint256 amount;
    }

    struct NettingSession {
        bytes32 sessionId;
        SessionStatus status;
        uint256 createdAt;
        uint256 entryCount;
    }

    ICBToken public cbToken;

    mapping(bytes32 => NettingSession) private _sessions;
    mapping(bytes32 => NettingEntry[]) private _entries;
    uint256 private _sessionCounter;

    uint256[50] private __gap;

    event NettingSessionOpened(bytes32 indexed sessionId);
    event NettingEntryAdded(bytes32 indexed sessionId, address indexed from, address indexed to, uint256 amount);
    event NettingSessionSettled(bytes32 indexed sessionId, uint256 grossCount, uint256 netTransfers);
    event NettingSessionCancelled(bytes32 indexed sessionId);

    function initialize(address cbToken_, address admin_) external initializer {
        if (cbToken_ == address(0)) revert ZeroAddress();
        if (admin_ == address(0)) revert ZeroAddress();
        __AccessControl_init();
        cbToken = ICBToken(cbToken_);
        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(NETTING_OPERATOR_ROLE, admin_);
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    /// @notice Open a new netting session. Returns sessionId.
    function openSession() external onlyRole(NETTING_OPERATOR_ROLE) returns (bytes32 sessionId) {
        sessionId = keccak256(abi.encode(++_sessionCounter, msg.sender));
        _sessions[sessionId] = NettingSession({
            sessionId: sessionId,
            status: SessionStatus.OPEN,
            createdAt: 0,
            entryCount: 0
        });
        emit NettingSessionOpened(sessionId);
    }

    /// @notice Add a gross payment obligation to an open session.
    ///         Both from/to must have pre-approved this contract for sufficient CBDC.
    function addEntry(bytes32 sessionId, address from, address to, uint256 amount)
        external
        onlyRole(NETTING_OPERATOR_ROLE)
    {
        NettingSession storage session = _sessions[sessionId];
        if (session.sessionId != sessionId) revert NettingSessionNotFound(sessionId);
        if (session.status != SessionStatus.OPEN) revert NettingSessionAlreadySettled(sessionId);
        if (from == address(0) || to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        _entries[sessionId].push(NettingEntry({from: from, to: to, amount: amount}));
        session.entryCount++;
        emit NettingEntryAdded(sessionId, from, to, amount);
    }

    /// @notice Settle session by computing net bilateral positions and executing net transfers.
    ///         Algorithm: for each ordered pair (A, B), net = grossA→B - grossB→A.
    ///         If net > 0: A pays net to B. If net == 0: no transfer. grossB→A entries also zeroed.
    ///         Only CBDC net transfers execute on-chain — gross obligations never settle individually.
    function settleSession(bytes32 sessionId) external nonReentrant onlyRole(NETTING_OPERATOR_ROLE) {
        NettingSession storage session = _sessions[sessionId];
        if (session.sessionId != sessionId) revert NettingSessionNotFound(sessionId);
        if (session.status != SessionStatus.OPEN) revert NettingSessionAlreadySettled(sessionId);

        NettingEntry[] storage entries = _entries[sessionId];
        uint256 n = entries.length;
        if (n == 0) revert EmptyNettingSession(sessionId);

        // Collect unique participants
        address[] memory participants = _collectParticipants(entries, n);
        uint256 pLen = participants.length;

        // Build participant index map using inline search (no mapping in memory)
        // net[i][j] = gross flow from participants[i] to participants[j]
        // Using dynamic array of net amounts: netAmounts[i*pLen + j]
        int256[] memory netMatrix = new int256[](pLen * pLen);

        for (uint256 k = 0; k < n; k++) {
            uint256 fi = _indexOf(participants, pLen, entries[k].from);
            uint256 ti = _indexOf(participants, pLen, entries[k].to);
            netMatrix[fi * pLen + ti] += int256(entries[k].amount);
        }

        // Mark session settled before external calls (CEI)
        session.status = SessionStatus.SETTLED;

        // Execute net transfers
        uint256 netTransferCount;
        for (uint256 i = 0; i < pLen; i++) {
            for (uint256 j = i + 1; j < pLen; j++) {
                int256 iToJ = netMatrix[i * pLen + j];
                int256 jToI = netMatrix[j * pLen + i];
                int256 net = iToJ - jToI;

                if (net > 0) {
                    // participants[i] is net payer to participants[j]
                    IERC20(address(cbToken)).safeTransferFrom(participants[i], participants[j], uint256(net));
                    netTransferCount++;
                } else if (net < 0) {
                    // participants[j] is net payer to participants[i]
                    IERC20(address(cbToken)).safeTransferFrom(participants[j], participants[i], uint256(-net));
                    netTransferCount++;
                }
                // net == 0: no transfer needed
            }
        }

        emit NettingSessionSettled(sessionId, n, netTransferCount);
    }

    function cancelSession(bytes32 sessionId) external onlyRole(NETTING_OPERATOR_ROLE) {
        NettingSession storage session = _sessions[sessionId];
        if (session.sessionId != sessionId) revert NettingSessionNotFound(sessionId);
        if (session.status != SessionStatus.OPEN) revert NettingSessionAlreadySettled(sessionId);
        session.status = SessionStatus.CANCELLED;
        emit NettingSessionCancelled(sessionId);
    }

    function getSession(bytes32 sessionId) external view returns (NettingSession memory) {
        return _sessions[sessionId];
    }

    function getEntries(bytes32 sessionId) external view returns (NettingEntry[] memory) {
        return _entries[sessionId];
    }

    // ─── Internal helpers ───

    function _collectParticipants(NettingEntry[] storage entries, uint256 n)
        internal view returns (address[] memory)
    {
        address[] memory temp = new address[](n * 2);
        uint256 count;

        for (uint256 k = 0; k < n; k++) {
            if (!_contains(temp, count, entries[k].from)) {
                temp[count++] = entries[k].from;
            }
            if (!_contains(temp, count, entries[k].to)) {
                temp[count++] = entries[k].to;
            }
        }

        address[] memory result = new address[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = temp[i];
        }
        return result;
    }

    function _contains(address[] memory arr, uint256 len, address target) internal pure returns (bool) {
        for (uint256 i = 0; i < len; i++) {
            if (arr[i] == target) return true;
        }
        return false;
    }

    function _indexOf(address[] memory arr, uint256 len, address target) internal pure returns (uint256) {
        for (uint256 i = 0; i < len; i++) {
            if (arr[i] == target) return i;
        }
        revert ParticipantNotFound(target); // unreachable if entries are consistent
    }
}
