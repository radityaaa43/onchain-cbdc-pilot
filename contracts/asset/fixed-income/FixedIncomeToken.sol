// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../universal-token/IERC1400.sol";
import {ZeroAddress, ZeroAmount, NotIssuable, UnknownPartition, InsufficientPartitionBalance, CannotAuthorizeSelf, InvalidTokenHolder, URIEmpty, DocumentNotFound, InsufficientAllowance} from "../../library/Errors.sol";

/**
 * @title FixedIncomeToken
 * @notice ERC1400 partitioned security token for digital bonds (SBN, SRBI, SBSN/Sukuk).
 *         Supports multiple bond series in a single contract via bondId-scoped partitions.
 * @custom:security-contact security@yourproject.xyz
 */
contract FixedIncomeToken is Initializable, ERC20Upgradeable, AccessControlUpgradeable, UUPSUpgradeable, IERC1400 {
    using EnumerableSet for EnumerableSet.Bytes32Set;
    using EnumerableSet for EnumerableSet.AddressSet;

    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    bytes32 public constant LIFECYCLE_MANAGER_ROLE = keccak256("LIFECYCLE_MANAGER_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant DATA_MANAGER_ROLE = keccak256("DATA_MANAGER_ROLE");

    bytes32 public constant PRIMARY = keccak256("PRIMARY");
    bytes32 public constant SECONDARY = keccak256("SECONDARY");
    bytes32 public constant REPO = keccak256("REPO");
    bytes32 public constant PLEDGED = keccak256("PLEDGED");
    bytes32 public constant LOCKED = keccak256("LOCKED");
    bytes32 public constant LENT = keccak256("LENT");
    bytes32 public constant MATURED = keccak256("MATURED");
    bytes32 public constant DEFAULTED = keccak256("DEFAULTED");

    uint256 private _granularity;
    uint256 private _chainId;
    bytes32[] private _defaultPartitions;

    mapping(bytes32 => mapping(bytes32 => mapping(address => uint256))) private _balancesByBondAndPartition;
    mapping(bytes32 => mapping(bytes32 => uint256)) private _totalSupplyByBondAndPartition;
    mapping(bytes32 => bytes32[]) private _validPartitionsByBond;
    mapping(bytes32 => mapping(bytes32 => bool)) private _isValidPartitionByBond;

    // Reverse lookup: partition hash → bondId (populated on _addValidPartition)
    mapping(bytes32 partition => bytes32 bondId) private _partitionToBondId;

    // Bond registry (separate from document names)
    bytes32[] private _registeredBonds;
    mapping(bytes32 bondId => bool) private _isBondRegistered;

    mapping(address => mapping(address => uint256)) private _allowances;
    mapping(bytes32 => mapping(address => mapping(address => uint256))) private _allowancesByPartition;

    mapping(address => EnumerableSet.AddressSet) private _authorizedOperators;
    mapping(bytes32 => mapping(address => EnumerableSet.AddressSet)) private _authorizedOperatorsByPartition;

    mapping(bytes32 => Document) private _documents;
    bytes32[] private _documentNames;

    struct Document {
        string uri;
        bytes32 documentHash;
        uint256 lastModified;
    }

    bool private _isControllable;
    bool private _isIssuable;

    // Gap 2: ISIN (ISO 6166) and CFI (ISO 10962) per bond for interop with legacy CSDs
    mapping(bytes32 => string) private _isin;
    mapping(bytes32 => string) private _cfi;

    uint256[50] private __gap;

    bytes4 private constant IERC1400_INTERFACE_ID = 0x766a08d5;
    bytes4 private constant IERC20_INTERFACE_ID = 0x36372b07;

    function supportsInterface(bytes4 interfaceId) public view override(AccessControlUpgradeable) returns (bool) {
        return interfaceId == IERC1400_INTERFACE_ID || interfaceId == IERC20_INTERFACE_ID || super.supportsInterface(interfaceId);
    }


    /**
     * @notice Initialize the fixed income token.
     * @param name_              Token name
     * @param symbol_            Token symbol
     * @param granularity_       Minimum transfer granularity (> 0)
     * @param controllers_       Addresses granted OPERATOR_ROLE
     * @param defaultPartitions_ Default partition bytes32 array
     * @param chainId_           Chain identifier
     * @param admin_             Address granted all initial roles
     */
    function initialize(
        string memory name_,
        string memory symbol_,
        uint256 granularity_,
        address[] memory controllers_,
        bytes32[] memory defaultPartitions_,
        uint256 chainId_,
        address admin_
    ) external initializer {
        if (granularity_ == 0) revert ZeroAmount();
        if (admin_ == address(0)) revert ZeroAddress();

        __ERC20_init(name_, symbol_);
        __AccessControl_init();


        _granularity = granularity_;
        _chainId = chainId_;
        _defaultPartitions = defaultPartitions_;
        _isControllable = true;
        _isIssuable = true;

        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(ISSUER_ROLE, admin_);
        _grantRole(LIFECYCLE_MANAGER_ROLE, admin_);
        _grantRole(OPERATOR_ROLE, admin_);
        _grantRole(DATA_MANAGER_ROLE, admin_);

        for (uint256 i = 0; i < controllers_.length; i++) {
            _grantRole(OPERATOR_ROLE, controllers_[i]);
        }
    }

    /**
     * @notice Pente-compatible initializer — no array params (Pente EVM cannot encode dynamic arrays in function calls).
     *         Equivalent to initialize(...) with empty controllers_ and defaultPartitions_.
     */
    function initializeBasic(
        string memory name_,
        string memory symbol_,
        uint256 granularity_,
        uint256 chainId_,
        address admin_
    ) external initializer {
        if (granularity_ == 0) revert ZeroAmount();
        if (admin_ == address(0)) revert ZeroAddress();

        __ERC20_init(name_, symbol_);
        __AccessControl_init();

        _granularity = granularity_;
        _chainId = chainId_;
        _isControllable = true;
        _isIssuable = true;

        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(ISSUER_ROLE, admin_);
        _grantRole(LIFECYCLE_MANAGER_ROLE, admin_);
        _grantRole(OPERATOR_ROLE, admin_);
        _grantRole(DATA_MANAGER_ROLE, admin_);
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    // ─── ISIN / CFI registry (ISO 6166 / ISO 10962) ──────────────────────────

    event ISINSet(bytes32 indexed bondId, string isin);
    event CFISet(bytes32 indexed bondId, string cfi);

    function setISIN(bytes32 bondId, string calldata isin) external onlyRole(DATA_MANAGER_ROLE) {
        _isin[bondId] = isin;
        emit ISINSet(bondId, isin);
    }

    function setCFI(bytes32 bondId, string calldata cfi) external onlyRole(DATA_MANAGER_ROLE) {
        _cfi[bondId] = cfi;
        emit CFISet(bondId, cfi);
    }

    function getISIN(bytes32 bondId) external view returns (string memory) {
        return _isin[bondId];
    }

    function getCFI(bytes32 bondId) external view returns (string memory) {
        return _cfi[bondId];
    }

    function granularity() external view returns (uint256) {
        return _granularity;
    }

    function defaultPartitions() external view returns (bytes32[] memory) {
        return _defaultPartitions;
    }

    function computePartition(bytes32 bondId, bytes32 state) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(bondId, state));
    }

    function balanceOfByBond(bytes32 bondId, bytes32 state, address holder) public view returns (uint256) {
        bytes32 partition = computePartition(bondId, state);
        return _balancesByBondAndPartition[bondId][partition][holder];
    }

    function totalSupplyByBond(bytes32 bondId, bytes32 state) public view returns (uint256) {
        bytes32 partition = computePartition(bondId, state);
        return _totalSupplyByBondAndPartition[bondId][partition];
    }

    function balanceOfByPartition(bytes32 partition, address tokenHolder) external view returns (uint256) {
        bytes32 bondId = _decodePartition(partition);
        return _balancesByBondAndPartition[bondId][partition][tokenHolder];
    }

    function partitionsOf(address tokenHolder) external view returns (bytes32[] memory) {
        uint256 totalPartitions = 0;
        for (uint256 i = 0; i < _registeredBonds.length; i++) {
            bytes32 bondId = _registeredBonds[i];
            bytes32[] memory bondPartitions = _validPartitionsByBond[bondId];
            for (uint256 j = 0; j < bondPartitions.length; j++) {
                if (_balancesByBondAndPartition[bondId][bondPartitions[j]][tokenHolder] > 0) totalPartitions++;
            }
        }
        bytes32[] memory result = new bytes32[](totalPartitions);
        uint256 index = 0;
        for (uint256 i = 0; i < _registeredBonds.length; i++) {
            bytes32 bondId = _registeredBonds[i];
            bytes32[] memory bondPartitions = _validPartitionsByBond[bondId];
            for (uint256 j = 0; j < bondPartitions.length; j++) {
                if (_balancesByBondAndPartition[bondId][bondPartitions[j]][tokenHolder] > 0) {
                    result[index++] = bondPartitions[j];
                }
            }
        }
        return result;
    }

    /// @dev Returns the bondId for a registered partition. Reverts if partition unknown.
    function _decodePartition(bytes32 partition) internal view returns (bytes32 bondId) {
        bondId = _partitionToBondId[partition];
        if (bondId == bytes32(0)) revert UnknownPartition(partition);
    }

    function transferWithData(address to, uint256 value, bytes calldata data) external override {
        _transferWithData(msg.sender, to, value, data, "");
    }

    function transferFromWithData(address from, address to, uint256 value, bytes calldata data) external override {
        _spendAllowanceCustom(from, msg.sender, value);
        _transferWithData(from, to, value, data, "");
    }

    function _transferWithData(address from, address to, uint256 value, bytes memory data, bytes memory) internal {
        if (from == address(0)) revert ZeroAddress();
        if (to == address(0)) revert ZeroAddress();

        bytes32 bondId = _extractBondIdFromData(data);

        bytes32 partition = computePartition(bondId, PRIMARY);
        _moveBalanceByPartition(bondId, partition, from, to, value);
        emit TransferByPartition(partition, msg.sender, from, to, value, data, "");
    }

    function _extractBondIdFromData(bytes memory data) internal pure returns (bytes32 bondId) {
        if (data.length >= 32) {
            assembly {
                bondId := mload(add(data, 32))
            }
        }
    }

    function transferByPartition(bytes32 partition, address to, uint256 value, bytes calldata data) external override returns (bytes32) {
        bytes32 bondId = _decodePartition(partition);
        if (_balancesByBondAndPartition[bondId][partition][msg.sender] < value)
            revert InsufficientPartitionBalance(msg.sender, partition, _balancesByBondAndPartition[bondId][partition][msg.sender], value);
        _moveBalanceByPartition(bondId, partition, msg.sender, to, value);
        emit TransferByPartition(partition, msg.sender, msg.sender, to, value, data, "");
        return partition;
    }

    function operatorTransferByPartition(
        bytes32 fromPartition,
        address from,
        address to,
        uint256 value,
        bytes calldata data,
        bytes calldata operatorData
    ) external override onlyRole(OPERATOR_ROLE) returns (bytes32) {
        bytes32 bondId = _decodePartition(fromPartition);
        if (_balancesByBondAndPartition[bondId][fromPartition][from] < value)
            revert InsufficientPartitionBalance(from, fromPartition, _balancesByBondAndPartition[bondId][fromPartition][from], value);

        bytes32 toPartition = fromPartition;
        if (data.length >= 64) {
            bytes32 flag;
            bytes32 potentialPartition;
            assembly {
                flag := calldataload(data.offset)
                potentialPartition := calldataload(add(data.offset, 32))
            }
            if (flag == bytes32(0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff)) {
                toPartition = potentialPartition;
            }
        }

        _moveBalanceByPartition(bondId, fromPartition, from, address(0), value);
        _moveBalanceByPartition(bondId, toPartition, address(0), to, value);

        if (fromPartition != toPartition) {
            _addValidPartition(bondId, toPartition);
            _totalSupplyByBondAndPartition[bondId][fromPartition] -= value;
            _totalSupplyByBondAndPartition[bondId][toPartition] += value;
            emit ChangedPartition(fromPartition, toPartition, value);
        }

        emit TransferByPartition(fromPartition, msg.sender, from, to, value, data, operatorData);
        return toPartition;
    }

    function _moveBalanceByPartition(bytes32 bondId, bytes32 partition, address from, address to, uint256 value) internal {
        if (value == 0) return;

        if (from != address(0)) {
            _balancesByBondAndPartition[bondId][partition][from] -= value;
        }

        if (to != address(0)) {
            _balancesByBondAndPartition[bondId][partition][to] += value;
        }
    }

    function _spendAllowanceCustom(address owner, address spender, uint256 value) internal {
        uint256 currentAllowance = _allowances[owner][spender];
        if (currentAllowance != type(uint256).max) {
            if (currentAllowance < value) revert InsufficientAllowance(owner, currentAllowance, value);
            _allowances[owner][spender] = currentAllowance - value;
        }
    }

    event ApprovalByPartition(bytes32 indexed partition, address indexed owner, address indexed spender, uint256 amount);

    function allowanceByPartition(bytes32 partition, address owner, address spender) external view returns (uint256) {
        return _allowancesByPartition[partition][owner][spender];
    }

    function approveByPartition(bytes32 partition, address spender, uint256 amount) external returns (bool) {
        if (spender == address(0)) revert ZeroAddress();
        _allowancesByPartition[partition][msg.sender][spender] = amount;
        emit ApprovalByPartition(partition, msg.sender, spender, amount);
        return true;
    }

    function allowance(address owner, address spender) public view override(ERC20Upgradeable, IERC20) returns (uint256) {
        return _allowances[owner][spender];
    }

    function approve(address spender, uint256 amount) public override(ERC20Upgradeable, IERC20) returns (bool) {
        _allowances[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function approveV2(address spender, uint256 amount) external {
        _allowances[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
    }

    function transfer(address to, uint256 value) public override(ERC20Upgradeable, IERC20) returns (bool) {
        _transferWithData(msg.sender, to, value, "", "");
        return true;
    }

    function transferFrom(address from, address to, uint256 value) public override(ERC20Upgradeable, IERC20) returns (bool) {
        _spendAllowanceCustom(from, msg.sender, value);
        _transferWithData(from, to, value, "", "");
        return true;
    }

    function balanceOf(address account) public view override(ERC20Upgradeable, IERC20) returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 0; i < _registeredBonds.length; i++) {
            bytes32 bondId = _registeredBonds[i];
            bytes32[] memory bondPartitions = _validPartitionsByBond[bondId];
            for (uint256 j = 0; j < bondPartitions.length; j++) {
                total += _balancesByBondAndPartition[bondId][bondPartitions[j]][account];
            }
        }
        return total;
    }

    function totalSupply() public view override(ERC20Upgradeable, IERC20) returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 0; i < _registeredBonds.length; i++) {
            bytes32 bondId = _registeredBonds[i];
            bytes32[] memory bondPartitions = _validPartitionsByBond[bondId];
            for (uint256 j = 0; j < bondPartitions.length; j++) {
                total += _totalSupplyByBondAndPartition[bondId][bondPartitions[j]];
            }
        }
        return total;
    }

    /// @notice Returns total supply for a specific partition (required by IFixedIncomeToken).
    function totalSupplyByPartition(bytes32 partition) external view returns (uint256) {
        bytes32 bondId = _partitionToBondId[partition];
        if (bondId == bytes32(0)) return 0;
        return _totalSupplyByBondAndPartition[bondId][partition];
    }

    /// @notice Operator burn from a specific partition (required by IFixedIncomeToken / RedemptionService).
    function redeemFromPartition(bytes32 partition, address from, uint256 value, bytes calldata data)
        external
        onlyRole(OPERATOR_ROLE)
    {
        bytes32 bondId = _decodePartition(partition);
        _burnByPartition(bondId, partition, from, value);
        emit RedeemedByPartition(partition, msg.sender, from, value, data);
    }

    function isControllable() external view returns (bool) {
        return _isControllable;
    }

    function authorizeOperator(address operator) external override {
        if (operator == msg.sender) revert CannotAuthorizeSelf();
        _authorizedOperators[msg.sender].add(operator);
        emit AuthorizedOperator(operator, msg.sender);
    }

    function revokeOperator(address operator) external override {
        _authorizedOperators[msg.sender].remove(operator);
        emit RevokedOperator(operator, msg.sender);
    }

    function authorizeOperatorByPartition(bytes32 partition, address operator) external override {
        if (operator == msg.sender) revert CannotAuthorizeSelf();
        _authorizedOperatorsByPartition[partition][msg.sender].add(operator);
        emit AuthorizedOperatorByPartition(partition, operator, msg.sender);
    }

    function revokeOperatorByPartition(bytes32 partition, address operator) external override {
        _authorizedOperatorsByPartition[partition][msg.sender].remove(operator);
        emit RevokedOperatorByPartition(partition, operator, msg.sender);
    }

    function isOperator(address operator, address tokenHolder) external view returns (bool) {
        return _authorizedOperators[tokenHolder].contains(operator);
    }

    function isOperatorForPartition(bytes32 partition, address operator, address tokenHolder) external view returns (bool) {
        return _authorizedOperatorsByPartition[partition][tokenHolder].contains(operator);
    }

    function isIssuable() external view returns (bool) {
        return _isIssuable;
    }

    function issue(address tokenHolder, uint256 value, bytes calldata data) external override onlyRole(ISSUER_ROLE) {
        if (tokenHolder == address(0)) revert ZeroAddress();
        if (!_isIssuable) revert NotIssuable();

        bytes32 bondId = _extractBondIdFromData(data);

        bytes32 partition = computePartition(bondId, PRIMARY);
        _addValidPartition(bondId, partition);
        _mintByPartition(bondId, partition, tokenHolder, value);
        emit Issued(msg.sender, tokenHolder, value, data);
    }

    function issueByPartition(bytes32 partition, address tokenHolder, uint256 value, bytes calldata data)
        external override onlyRole(ISSUER_ROLE) {
        _issueByPartition(partition, tokenHolder, value, data);
    }

    function issueToPartition(bytes32 partition, address tokenHolder, uint256 value, bytes calldata data)
        external onlyRole(ISSUER_ROLE) {
        _issueByPartition(partition, tokenHolder, value, data);
    }

    function _issueByPartition(bytes32 partition, address tokenHolder, uint256 value, bytes calldata data) internal {
        if (tokenHolder == address(0)) revert ZeroAddress();
        if (!_isIssuable) revert NotIssuable();

        bytes32 bondId = _partitionToBondId[partition];
        if (bondId == bytes32(0)) {
            bondId = _extractBondIdFromData(data);
            if (bondId == bytes32(0)) revert UnknownPartition(partition);
        }
        _addValidPartition(bondId, partition);
        _mintByPartition(bondId, partition, tokenHolder, value);
        emit IssuedByPartition(partition, msg.sender, tokenHolder, value, data, "");
    }

    function _mintByPartition(bytes32 bondId, bytes32 partition, address to, uint256 value) internal {
        _balancesByBondAndPartition[bondId][partition][to] += value;
        _totalSupplyByBondAndPartition[bondId][partition] += value;
    }

    function _burnByPartition(bytes32 bondId, bytes32 partition, address from, uint256 value) internal {
        if (_balancesByBondAndPartition[bondId][partition][from] < value)
            revert InsufficientPartitionBalance(from, partition, _balancesByBondAndPartition[bondId][partition][from], value);
        _balancesByBondAndPartition[bondId][partition][from] -= value;
        _totalSupplyByBondAndPartition[bondId][partition] -= value;
    }

    function _addValidPartition(bytes32 bondId, bytes32 partition) internal {
        if (!_isValidPartitionByBond[bondId][partition]) {
            _isValidPartitionByBond[bondId][partition] = true;
            _validPartitionsByBond[bondId].push(partition);
            _partitionToBondId[partition] = bondId;
        }
        if (!_isBondRegistered[bondId]) {
            _isBondRegistered[bondId] = true;
            _registeredBonds.push(bondId);
        }
    }

    function redeem(uint256 value, bytes calldata data) external override {
        _redeemFrom(msg.sender, value, data, "");
    }

    function redeemFrom(address tokenHolder, uint256 value, bytes calldata data) external override onlyRole(OPERATOR_ROLE) {
        _redeemFrom(tokenHolder, value, data, "");
    }

    function _redeemFrom(address tokenHolder, uint256 value, bytes memory data, bytes memory) internal {
        if (tokenHolder == address(0)) revert InvalidTokenHolder();

        bytes32 bondId = _extractBondIdFromData(data);

        bytes32 partition = PRIMARY;
        if (data.length >= 64) {
            assembly {
                partition := mload(add(data, 64))
            }
            partition = computePartition(bondId, partition);
        } else {
            partition = computePartition(bondId, PRIMARY);
        }
        _burnByPartition(bondId, partition, tokenHolder, value);
        emit Redeemed(msg.sender, tokenHolder, value, data);
    }

    function redeemByPartition(bytes32 partition, uint256 value, bytes calldata data) external override {
        bytes32 bondId = _decodePartition(partition);
        _burnByPartition(bondId, partition, msg.sender, value);
        emit RedeemedByPartition(partition, msg.sender, msg.sender, value, data);
    }

    function operatorRedeemByPartition(bytes32 partition, address tokenHolder, uint256 value, bytes calldata operatorData)
        external override onlyRole(OPERATOR_ROLE) {
        bytes32 bondId = _decodePartition(partition);
        _burnByPartition(bondId, partition, tokenHolder, value);
        emit RedeemedByPartition(partition, msg.sender, tokenHolder, value, operatorData);
    }

    function getDocument(bytes32 _name) external view returns (string memory, bytes32, uint256) {
        Document memory doc = _documents[_name];
        return (doc.uri, doc.documentHash, doc.lastModified);
    }

    function setDocument(bytes32 _name, string memory _uri, bytes32 _documentHash) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        if (bytes(_uri).length == 0) revert URIEmpty();
        Document storage doc = _documents[_name];
        bool isNew = bytes(doc.uri).length == 0;
        doc.uri = _uri;
        doc.documentHash = _documentHash;
        doc.lastModified = block.timestamp;
        if (isNew) {
            _documentNames.push(_name);
        }
        emit DocumentUpdated(_name, _uri, _documentHash);
    }

    function removeDocument(bytes32 _name) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        Document memory doc = _documents[_name];
        if (bytes(doc.uri).length == 0) revert DocumentNotFound();
        delete _documents[_name];
        _removeDocumentName(_name);
        emit DocumentRemoved(_name, doc.uri, doc.documentHash);
    }

    function _removeDocumentName(bytes32 _name) internal {
        for (uint256 i = 0; i < _documentNames.length; i++) {
            if (_documentNames[i] == _name) {
                _documentNames[i] = _documentNames[_documentNames.length - 1];
                _documentNames.pop();
                break;
            }
        }
    }

    function getAllDocuments() external view returns (bytes32[] memory) {
        return _documentNames;
    }

    function chainId() external view returns (uint256) {
        return _chainId;
    }

    function setControllable(bool controllable) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _isControllable = controllable;
    }

    function setIssuable(bool issuable) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _isIssuable = issuable;
    }

    function getValidPartitionsByBond(bytes32 bondId) external view returns (bytes32[] memory) {
        return _validPartitionsByBond[bondId];
    }

    function isValidPartition(bytes32 bondId, bytes32 partition) external view returns (bool) {
        return _isValidPartitionByBond[bondId][partition];
    }
}
