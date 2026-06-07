// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

interface IRepoService {
    struct RepoAgreement {
        bytes32 repoId;
        bytes32 bondId;
        address seller;
        address buyer;
        uint256 amount;
        uint256 repoRate;
        uint256 tenor;
        uint256 purchasePrice;
        uint256 repurchasePrice;
        bool isActive;
    }

    function initiateRepo(
        bytes32 bondId,
        address seller,
        address buyer,
        uint256 amount,
        uint256 repoRate,
        uint256 tenor
    ) external returns (bytes32 repoId);

    function unwindRepo(bytes32 repoId) external;

    function getRepo(bytes32 repoId) external view returns (RepoAgreement memory);
}