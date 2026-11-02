// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./AssetToken.sol";

/**
 * @title AssetRegistry
 * @notice Central registry for recording, verifying, and tokenizing real-world assets on Assetra Protocol.
 */
contract AssetRegistry is Ownable {
    enum Status { Submitted, Registered, Approved, Rejected, Tokenized, Decommissioned }

    struct AssetRecord {
        string assetId;          // Unique Asset identifier e.g. "AST-2026-001"
        string name;             // Asset Name
        string category;         // Asset Category e.g. "Commercial Real Estate"
        string location;         // Physical Custody Location
        uint256 valuationUSD;    // Appraised Valuation in USD
        string custodian;        // Appraiser or Custodian Firm
        string ipfsHash;         // Cryptographic metadata proof URI
        address ownerAddress;    // Beneficial Owner Wallet
        Status status;           // Tokenization Status
        bool isApproved;         // On-chain approval verification gate
        address approvedBy;      // Verifier address that signed approval
        uint256 approvedAt;      // Timestamp of approval
        uint256 tokenId;         // Minted ERC-721 Token ID
        uint256 registeredAt;    // Timestamp
    }

    AssetToken public tokenContract;
    address public verifierAddress;

    mapping(string => AssetRecord) private _assets;
    mapping(string => bool) private _registeredIds;
    string[] private _assetIds;

    event AssetRegistered(
        string indexed assetId,
        string name,
        string category,
        uint256 valuationUSD,
        address indexed ownerAddress,
        string ipfsHash
    );

    event AssetApproved(
        string indexed assetId,
        address indexed verifier,
        uint256 timestamp
    );

    event AssetRejected(
        string indexed assetId,
        address indexed verifier,
        string reason,
        uint256 timestamp
    );

    event AssetTokenized(
        string indexed assetId,
        uint256 indexed tokenId,
        address indexed ownerAddress,
        address tokenContractAddress
    );

    modifier onlyVerifier() {
        require(
            msg.sender == owner() || (verifierAddress != address(0) && msg.sender == verifierAddress),
            "AssetRegistry: Caller is not an authorized verifier"
        );
        _;
    }

    constructor(address _tokenContractAddress) Ownable(msg.sender) {
        require(_tokenContractAddress != address(0), "Invalid token contract");
        tokenContract = AssetToken(_tokenContractAddress);
        verifierAddress = msg.sender;
    }

    function setVerifierAddress(address _verifier) external onlyOwner {
        require(_verifier != address(0), "Invalid verifier address");
        verifierAddress = _verifier;
    }

    function registerAsset(
        string calldata assetId,
        string calldata name,
        string calldata category,
        string calldata location,
        uint256 valuationUSD,
        string calldata custodian,
        string calldata ipfsHash
    ) external returns (bool) {
        require(bytes(assetId).length > 0, "Asset ID cannot be empty");
        require(bytes(name).length > 0, "Asset name cannot be empty");
        require(valuationUSD > 0, "Valuation must be greater than zero");
        require(!_registeredIds[assetId], "Asset ID already registered");

        _assets[assetId] = AssetRecord({
            assetId: assetId,
            name: name,
            category: category,
            location: location,
            valuationUSD: valuationUSD,
            custodian: custodian,
            ipfsHash: ipfsHash,
            ownerAddress: msg.sender,
            status: Status.Submitted,
            isApproved: false,
            approvedBy: address(0),
            approvedAt: 0,
            tokenId: 0,
            registeredAt: block.timestamp
        });

        _registeredIds[assetId] = true;
        _assetIds.push(assetId);

        emit AssetRegistered(assetId, name, category, valuationUSD, msg.sender, ipfsHash);
        return true;
    }

    function approveAssetOnChain(string calldata assetId) external onlyVerifier returns (bool) {
        require(_registeredIds[assetId], "Asset ID does not exist");
        AssetRecord storage asset = _assets[assetId];
        require(!asset.isApproved, "Asset already approved");
        require(asset.status != Status.Rejected, "Cannot approve a rejected asset");

        asset.isApproved = true;
        asset.approvedBy = msg.sender;
        asset.approvedAt = block.timestamp;
        asset.status = Status.Approved;

        emit AssetApproved(assetId, msg.sender, block.timestamp);
        return true;
    }

    function rejectAssetOnChain(string calldata assetId, string calldata reason) external onlyVerifier returns (bool) {
        require(_registeredIds[assetId], "Asset ID does not exist");
        AssetRecord storage asset = _assets[assetId];
        require(!asset.isApproved, "Cannot reject an already approved asset");
        require(bytes(reason).length > 0, "Rejection reason required");

        asset.status = Status.Rejected;

        emit AssetRejected(assetId, msg.sender, reason, block.timestamp);
        return true;
    }

    function tokenizeAsset(string calldata assetId) external returns (uint256) {
        require(_registeredIds[assetId], "Asset not registered");
        AssetRecord storage asset = _assets[assetId];
        require(msg.sender == asset.ownerAddress || msg.sender == owner(), "Not authorized to tokenize asset");
        require(asset.isApproved, "Asset must be approved on-chain before tokenization");
        require(asset.status == Status.Approved, "Asset already tokenized or not eligible");

        string memory tokenMetadataURI = bytes(asset.ipfsHash).length > 0
            ? asset.ipfsHash
            : string(abi.encodePacked("https://assetra.io/api/metadata/", assetId));

        uint256 mintedTokenId = tokenContract.mintAssetToken(asset.ownerAddress, tokenMetadataURI);

        asset.status = Status.Tokenized;
        asset.tokenId = mintedTokenId;

        emit AssetTokenized(assetId, mintedTokenId, asset.ownerAddress, address(tokenContract));

        return mintedTokenId;
    }

    function getAsset(string calldata assetId)
        external
        view
        returns (AssetRecord memory)
    {
        require(_registeredIds[assetId], "Asset ID does not exist");
        return _assets[assetId];
    }

    function getTotalAssets() external view returns (uint256) {
        return _assetIds.length;
    }

    function isRegistered(string calldata assetId) external view returns (bool) {
        return _registeredIds[assetId];
    }
}
