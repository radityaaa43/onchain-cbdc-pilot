// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {IReportingService} from "../../interfaces/service/asset-support/IReportingService.sol";
import {ZeroAddress} from "../../library/Errors.sol";

/**
 * @title ReportingService
 * @notice Regulatory reporting, SAR generation, and transaction log export for compliance audits.
 * @custom:security-contact security@yourproject.xyz
 */
contract ReportingService is Initializable, AccessControlUpgradeable, UUPSUpgradeable, IReportingService {
    bytes32 public constant REPORTER_ROLE = keccak256("REPORTER_ROLE");

    uint256 private _transactionCount;
    mapping(uint256 => TransactionRecord) private _transactions;
    mapping(address => uint256[]) private _entityTransactionIds;
    mapping(address => bytes32[]) private _entitySARIds;
    mapping(bytes32 => SARRecord) private _sarRecords;
    uint256 private _sarCount;

    uint256[49] private __gap;

    event TransactionLogged(
        bytes32 indexed assetId,
        address indexed from,
        address indexed to,
        uint256 amount,
        bytes32 ref,
        uint256 timestamp
    );
    event SARGenerated(bytes32 indexed reportId, address indexed entity, uint256 timestamp);

    function initialize(address admin_) external initializer {
        if (admin_ == address(0)) revert ZeroAddress();
        __AccessControl_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(REPORTER_ROLE, admin_);
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    function logTransaction(bytes32 assetId, address from, address to, uint256 amount, bytes32 ref)
        external
        onlyRole(REPORTER_ROLE)
    {
        uint256 txId = _transactionCount++;

        _transactions[txId] = TransactionRecord({
            assetId: assetId,
            from: from,
            to: to,
            amount: amount,
            ref: ref,
            timestamp: 0,
            blockNumber: block.number
        });

        _entityTransactionIds[from].push(txId);
        _entityTransactionIds[to].push(txId);

        emit TransactionLogged(assetId, from, to, amount, ref, 0);
    }

    function getTransactions(address entity, uint256 fromBlock, uint256 toBlock)
        external
        view
        returns (TransactionRecord[] memory)
    {
        uint256[] storage txIds = _entityTransactionIds[entity];
        uint256 count = 0;
        for (uint256 i = 0; i < txIds.length; i++) {
            TransactionRecord storage record = _transactions[txIds[i]];
            if (record.blockNumber >= fromBlock && record.blockNumber <= toBlock) count++;
        }

        TransactionRecord[] memory result = new TransactionRecord[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < txIds.length; i++) {
            TransactionRecord storage record = _transactions[txIds[i]];
            if (record.blockNumber >= fromBlock && record.blockNumber <= toBlock) {
                result[index++] = record;
            }
        }
        return result;
    }

    function generateSAR(address entity) external onlyRole(REPORTER_ROLE) returns (bytes32 reportId) {
        reportId = keccak256(abi.encode(entity, _sarCount++, _entitySARIds[entity].length));
        _sarRecords[reportId] = SARRecord({
            reportId: reportId,
            entity: entity,
            timestamp: 0,
            filed: true
        });
        _entitySARIds[entity].push(reportId);
        emit SARGenerated(reportId, entity, 0);
    }

    /// @dev Unbounded scan — kept for backwards compatibility. Use exportTransactionLogPaginated for large datasets.
    function exportTransactionLog(bytes32 assetId, uint256 fromBlock, uint256 toBlock)
        external
        view
        onlyRole(REPORTER_ROLE)
        returns (bytes memory)
    {
        uint256 count = 0;
        for (uint256 i = 0; i < _transactionCount; i++) {
            TransactionRecord storage record = _transactions[i];
            if (record.assetId == assetId && record.blockNumber >= fromBlock && record.blockNumber <= toBlock) count++;
        }

        TransactionRecord[] memory records = new TransactionRecord[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < _transactionCount; i++) {
            TransactionRecord storage record = _transactions[i];
            if (record.assetId == assetId && record.blockNumber >= fromBlock && record.blockNumber <= toBlock) {
                records[index++] = record;
            }
        }
        return abi.encode(records);
    }

    /// @notice Paginated version of exportTransactionLog. Iterates all transactions by sequential ID.
    /// @param offset Starting index into the global transaction list.
    /// @param limit  Maximum number of records to return.
    /// @return records Up to `limit` TransactionRecords starting at `offset`.
    /// @return total   Total number of transactions logged (use to compute page count).
    function exportTransactionLogPaginated(uint256 offset, uint256 limit)
        external
        view
        onlyRole(REPORTER_ROLE)
        returns (TransactionRecord[] memory records, uint256 total)
    {
        total = _transactionCount;

        if (offset >= total || limit == 0) {
            return (new TransactionRecord[](0), total);
        }

        uint256 end = offset + limit;
        if (end > total) end = total;

        uint256 size = end - offset;
        records = new TransactionRecord[](size);
        for (uint256 i = 0; i < size; i++) {
            records[i] = _transactions[offset + i];
        }
    }
}
