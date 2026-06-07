// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "../IPolicy.sol";
import "../../../library/CBAccessControl.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {BankCannotChangeAuthenticator, SenderNotAuthenticated, ContractAlreadyAuthenticated, NotBankOrOwner} from "../../../library/Errors.sol";

contract AuthenticatedPolicy is IPolicy, CBAccessControl {
    // The maximum time interval that a person's authentication should be considered valid
    uint256 internal authTTL;

    struct Authentication {
        address bank;
        uint256 timestamp;
    }

    mapping(address wallet => Authentication) internal authenticationOf;
    mapping(address contractAddress => address owner) internal ownerOfContract; // Contracts with an owner are authenticated for transactions
    mapping(address wallet => string bankName) internal bankNameOf;

    event PersonAuthenticatedContract(address indexed contractAddress, address indexed owner);
    event ContractRevoked(address indexed contractAddress, address indexed owner);

    constructor() {
        authTTL = 90 days;
    }

    function check(address from, address to, uint256 amount) external override returns (address from_, address to_, uint256 amount_) {
        if (_validSender(from) && _validRecipient(to)) return (from, to, amount);
        if (nextPolicyAddress != NO_NEXT_POLICY_ADDRESS) return IPolicy._nextPolicy(from, to, amount);
        revert SenderNotAuthenticated();
    }

    function setTTL(uint256 _ttl) external onlyRole(DEFAULT_ADMIN_ROLE) {
        authTTL = _ttl;
    }

    function setAuthenticatedPerson(address _address) external onlyRole(BANK_ROLE) {
        // If the person is already authenticated, update the timestamp. Only the same bank as previous authentication can do this.
        if (authenticationOf[_address].bank != address(0)) {
            if (authenticationOf[_address].bank != msg.sender) revert BankCannotChangeAuthenticator(_address, authenticationOf[_address].bank);
        }

        authenticationOf[_address] = Authentication(msg.sender, block.timestamp);
    }

    function revokeAuthenticationPerson(address _address) external {
        if (authenticationOf[_address].bank != msg.sender) revert BankCannotChangeAuthenticator(_address, authenticationOf[_address].bank);
        delete authenticationOf[_address].timestamp;
    }

    function setAuthenticatedContract(address _address) external {
        if (authenticationOf[msg.sender].timestamp == 0) revert SenderNotAuthenticated();
        if (ownerOfContract[_address] != address(0)) revert ContractAlreadyAuthenticated(_address);

        ownerOfContract[_address] = msg.sender;
        emit PersonAuthenticatedContract(_address, msg.sender);
    }

    function revokeAuthenticationContract(address _address) external {
        address owner = ownerOfContract[_address];
        address ownerBank = authenticationOf[owner].bank;
        if (owner != msg.sender && ownerBank != msg.sender) revert NotBankOrOwner(msg.sender);

        emit ContractRevoked(_address, ownerOfContract[_address]);
        delete ownerOfContract[_address];
    }

    function setNextPolicy(address nextPolicyAddress_) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        nextPolicyAddress = nextPolicyAddress_;
    }

    function authenticateBank(address _bankAddress, string calldata _bankName) external onlyRole(DEFAULT_ADMIN_ROLE) {
        bankNameOf[_bankAddress] = _bankName;
        grantRole(BANK_ROLE, _bankAddress);
    }

    function changeBankName(address _bankAddress, string calldata _bankName) external onlyRole(DEFAULT_ADMIN_ROLE) {
        bankNameOf[_bankAddress] = _bankName;
    }

    function revokeBank(address bank) external onlyRole(DEFAULT_ADMIN_ROLE) {
        revokeRole(BANK_ROLE, bank);
    }

    function getBankOf(address _address) external view returns (address) {
        return authenticationOf[_address].bank;
    }

    function getBankName(address _bankAddress) external view returns (string memory) {
        return bankNameOf[_bankAddress];
    }

    // This function checks if the address is authenticated or not.
    // It checks if the address is the bank address, if the transaction is a burn address,
    // or if the address has authenticated previously.
    function checkAuthenticatedOnce(address _address) public view returns (bool) {
        bool isBank = hasRole(BANK_ROLE, _address) || hasRole(DEFAULT_ADMIN_ROLE, _address);
        bool contractHasOwner = ownerOfContract[_address] != address(0);
        bool personHasAuthTime = authenticationOf[_address].timestamp != 0;
        bool isBurn = _address == address(0);
        return contractHasOwner || personHasAuthTime || isBank || isBurn;
    }

    function checkAuthenticated(address _address) public view returns (bool) {
        return (hasRole(DEFAULT_ADMIN_ROLE, _address) ||
            hasRole(BANK_ROLE, _address) ||
            _isContractAuthenticated(_address) ||
            _isPersonAuthenticated(_address));
    }

    function _isContractAuthenticated(address _address) internal view returns (bool) {
        address owner = ownerOfContract[_address];
        return owner != address(0) && authenticationOf[owner].timestamp > 0;
    }

    function _isPersonAuthenticated(address _address) internal view returns (bool) {
        uint256 authTime = authenticationOf[_address].timestamp;
        uint256 cutoffTime = authTime + authTTL;
        bool isBetweenZeroAndCutoffTime = authTime > 0 && block.timestamp < cutoffTime;
        return isBetweenZeroAndCutoffTime;
    }

    function _validSender(address from) internal view returns (bool) {
        return from == address(0) || checkAuthenticated(from);
    }

    function _validRecipient(address to) internal view returns (bool) {
        return checkAuthenticatedOnce(to);
    }
}
