// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "../asset/policy/IPolicy.sol";

/**
 * @title PolicyRunner
 * @notice Chain-of-responsibility pattern for policy enforcement
 * @dev Integrated into CBToken to enforce policy checks on transfers
 */
abstract contract PolicyRunner {
    IPolicy private _firstPolicy;

    event PolicyChainUpdated(address indexed firstPolicy);

    /**
     * @dev Set the first policy in the chain
     * @param firstPolicy Address of the first policy contract
     */
    function _setFirstPolicy(IPolicy firstPolicy) internal {
        _firstPolicy = firstPolicy;
        emit PolicyChainUpdated(address(firstPolicy));
    }

    /**
     * @dev Get the first policy in the chain
     */
    function getFirstPolicy() public view returns (address) {
        return address(_firstPolicy);
    }

    /**
     * @dev Check transfer through policy chain
     * @param from Sender address
     * @param to Recipient address
     * @param amount Transfer amount
     * @return from_ Validated sender address
     * @return to_ Validated recipient address
     * @return amount_ Validated amount
     */
    function _checkPolicy(address from, address to, uint256 amount) internal returns (address from_, address to_, uint256 amount_) {
        if (address(_firstPolicy) == address(0)) {
            // No policy set - allow by default
            return (from, to, amount);
        }

        return _firstPolicy.check(from, to, amount);
    }

    /**
     * @dev Set first policy - must be implemented by inheriting contract with access control
     */
    function setFirstPolicy(IPolicy firstPolicy) external virtual;
}
