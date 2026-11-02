// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AssetMarketplace
 * @notice Trustless marketplace for listing and purchasing tokenized real-world assets on Assetra Protocol.
 * Enforces listed prices, atomic escrow/transfers, and prevents double purchases.
 */
contract AssetMarketplace is ReentrancyGuard, Ownable {
    struct Listing {
        address seller;
        address tokenContract;
        uint256 tokenId;
        uint256 price; // Price in wei
        bool isActive;
        string assetId; // Assetra Protocol Asset Reference ID
    }

    // Mapping: listingId => Listing
    // listingId = keccak256(abi.encodePacked(tokenContract, tokenId))
    mapping(bytes32 => Listing) private _listings;
    bytes32[] private _listingKeys;

    event ItemListed(
        bytes32 indexed listingId,
        string assetId,
        address indexed tokenContract,
        uint256 indexed tokenId,
        address seller,
        uint256 price
    );

    event ItemPurchased(
        bytes32 indexed listingId,
        string assetId,
        address indexed tokenContract,
        uint256 indexed tokenId,
        address seller,
        address buyer,
        uint256 price
    );

    event ItemDelisted(
        bytes32 indexed listingId,
        string assetId,
        address indexed tokenContract,
        uint256 indexed tokenId,
        address seller
    );

    event PriceUpdated(
        bytes32 indexed listingId,
        address indexed tokenContract,
        uint256 indexed tokenId,
        uint256 oldPrice,
        uint256 newPrice
    );

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Computes unique listing hash key for a token.
     */
    function getListingId(address tokenContract, uint256 tokenId) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(tokenContract, tokenId));
    }

    /**
     * @notice Lists an approved and minted ERC-721 token for sale on the marketplace.
     * @param tokenContract Address of the ERC-721 contract.
     * @param tokenId Minted token ID.
     * @param price Listing price in wei.
     * @param assetId Off-chain Assetra asset ID reference.
     */
    function listItem(
        address tokenContract,
        uint256 tokenId,
        uint256 price,
        string calldata assetId
    ) external returns (bytes32) {
        require(tokenContract != address(0), "Marketplace: Invalid token contract");
        require(price > 0, "Marketplace: Price must be greater than zero");

        IERC721 token = IERC721(tokenContract);
        require(token.ownerOf(tokenId) == msg.sender, "Marketplace: Caller does not own token");
        require(
            token.getApproved(tokenId) == address(this) || token.isApprovedForAll(msg.sender, address(this)),
            "Marketplace: Contract not approved to transfer token. Call approve() first."
        );

        bytes32 listingId = getListingId(tokenContract, tokenId);

        _listings[listingId] = Listing({
            seller: msg.sender,
            tokenContract: tokenContract,
            tokenId: tokenId,
            price: price,
            isActive: true,
            assetId: assetId
        });

        _listingKeys.push(listingId);

        emit ItemListed(listingId, assetId, tokenContract, tokenId, msg.sender, price);
        return listingId;
    }

    /**
     * @notice Purchases a listed ERC-721 token by paying the exact price in ETH.
     * Atomically transfers funds to seller and NFT to buyer. Prevents reentrancy and double purchases.
     * @param tokenContract Address of the ERC-721 contract.
     * @param tokenId Minted token ID.
     */
    function buyItem(address tokenContract, uint256 tokenId) external payable nonReentrant {
        bytes32 listingId = getListingId(tokenContract, tokenId);
        Listing storage listing = _listings[listingId];

        require(listing.isActive, "Marketplace: Item is not currently listed for sale");
        require(msg.value >= listing.price, "Marketplace: Insufficient ETH payment");

        IERC721 token = IERC721(tokenContract);
        require(token.ownerOf(tokenId) == listing.seller, "Marketplace: Seller no longer owns this token");
        require(msg.sender != listing.seller, "Marketplace: Buyer cannot be the seller");

        address seller = listing.seller;
        uint256 price = listing.price;
        string memory assetId = listing.assetId;

        // Deactivate listing BEFORE any external transfers (Checks-Effects-Interactions)
        listing.isActive = false;

        // Forward payment to seller
        (bool paymentSuccess, ) = payable(seller).call{value: price}("");
        require(paymentSuccess, "Marketplace: ETH payment transfer to seller failed");

        // Refund any excess payment sent by the buyer
        if (msg.value > price) {
            uint256 excess = msg.value - price;
            (bool refundSuccess, ) = payable(msg.sender).call{value: excess}("");
            require(refundSuccess, "Marketplace: ETH refund of excess payment failed");
        }

        // Transfer ERC-721 token directly from seller to buyer
        token.safeTransferFrom(seller, msg.sender, tokenId);

        emit ItemPurchased(listingId, assetId, tokenContract, tokenId, seller, msg.sender, price);
    }

    /**
     * @notice Cancels an active marketplace listing.
     * @param tokenContract Address of the ERC-721 contract.
     * @param tokenId Minted token ID.
     */
    function delistItem(address tokenContract, uint256 tokenId) external {
        bytes32 listingId = getListingId(tokenContract, tokenId);
        Listing storage listing = _listings[listingId];

        require(listing.isActive, "Marketplace: Listing is not active");
        require(
            msg.sender == listing.seller || msg.sender == owner(),
            "Marketplace: Only seller or owner can delist"
        );

        listing.isActive = false;

        emit ItemDelisted(listingId, listing.assetId, tokenContract, tokenId, listing.seller);
    }

    /**
     * @notice Updates the price of an active listing.
     */
    function updatePrice(address tokenContract, uint256 tokenId, uint256 newPrice) external {
        require(newPrice > 0, "Marketplace: Price must be greater than zero");
        bytes32 listingId = getListingId(tokenContract, tokenId);
        Listing storage listing = _listings[listingId];

        require(listing.isActive, "Marketplace: Listing is not active");
        require(msg.sender == listing.seller, "Marketplace: Only seller can update price");

        uint256 oldPrice = listing.price;
        listing.price = newPrice;

        emit PriceUpdated(listingId, tokenContract, tokenId, oldPrice, newPrice);
    }

    /**
     * @notice View listing details.
     */
    function getListing(address tokenContract, uint256 tokenId) external view returns (Listing memory) {
        bytes32 listingId = getListingId(tokenContract, tokenId);
        return _listings[listingId];
    }

    /**
     * @notice Verifies if a token has an active, valid listing where seller is still the owner.
     */
    function isAvailableForPurchase(address tokenContract, uint256 tokenId) external view returns (bool) {
        bytes32 listingId = getListingId(tokenContract, tokenId);
        Listing memory listing = _listings[listingId];

        if (!listing.isActive) {
            return false;
        }

        IERC721 token = IERC721(tokenContract);
        try token.ownerOf(tokenId) returns (address currentOwner) {
            if (currentOwner != listing.seller) {
                return false;
            }
            return (token.getApproved(tokenId) == address(this) || token.isApprovedForAll(listing.seller, address(this)));
        } catch {
            return false;
        }
    }
}
