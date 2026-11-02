// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AssetToken
 * @notice ERC-721 Non-Fungible Token representing tokenized real-world assets on Assetra Protocol.
 */
contract AssetToken is ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;
    address public registryContract;

    event TokenMinted(
        uint256 indexed tokenId,
        address indexed owner,
        string tokenURI
    );

    modifier onlyAuthorized() {
        require(
            msg.sender == owner() || msg.sender == registryContract,
            "AssetToken: Caller is not owner or authorized registry"
        );
        _;
    }

    constructor(address initialOwner)
        ERC721("Assetra Real World Asset Token", "ASTRWA")
        Ownable(initialOwner)
    {
        _nextTokenId = 1;
    }

    function setRegistryContract(address _registry) external onlyOwner {
        require(_registry != address(0), "Invalid registry address");
        registryContract = _registry;
    }

    function mintAssetToken(address to, string calldata metadataURI)
        external
        onlyAuthorized
        returns (uint256)
    {
        require(to != address(0), "Cannot mint to zero address");
        require(bytes(metadataURI).length > 0, "Metadata URI cannot be empty");

        uint256 tokenId = _nextTokenId;
        _nextTokenId++;

        _safeMint(to, tokenId);
        _setTokenURI(tokenId, metadataURI);

        emit TokenMinted(tokenId, to, metadataURI);

        return tokenId;
    }

    function getCurrentTokenId() external view returns (uint256) {
        return _nextTokenId - 1;
    }
}
