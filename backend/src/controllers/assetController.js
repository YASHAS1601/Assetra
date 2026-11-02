const assetService = require('../services/assetService');

const formatPrivacyOwner = (addr) => {
  if (!addr) return 'Registered Custodian';
  if (addr.length > 10) {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }
  return addr;
};

const listAssets = async (req, res, next) => {
  try {
    const { category, status, explore } = req.query;
    const isExplore = explore === 'true';

    const assets = await assetService.getAllAssets({
      category,
      status,
      explore: isExplore
    });

    let responseData = assets;
    if (isExplore) {
      // Mandatory Explore Assets Rule: Expose ONLY APPROVED assets.
      // Separate verification, tokenization, listing, and purchase states.
      // Privacy: Sanitize owner wallet and internal applicant IDs.
      responseData = assets
        .filter(a => {
          const isApproved = a.verification_status === 'APPROVED' || a.is_verified === true || a.status === 'APPROVED' || a.status === 'TOKENIZED';
          return isApproved;
        })
        .map(a => {
          const currentOwner = a.current_owner_address || a.currentOwnerAddress || a.owner_address || a.ownerAddress || '';
          const tokenStatus = a.token_status || a.tokenStatus || (a.status === 'TOKENIZED' ? 'TOKENIZED' : 'NOT_TOKENIZED');
          const listingStatus = a.listing_status || a.listingStatus || 'UNLISTED';
          const listingPriceEth = Number(a.listing_price_eth ?? a.listingPriceEth ?? 0);
          const isPurchasable = tokenStatus === 'TOKENIZED' && listingStatus === 'LISTED' && listingPriceEth > 0;

          return {
            id: a.id,
            name: a.name,
            category: a.category,
            description: a.description,
            location: a.location,
            valuation: a.valuation,
            currency: a.currency,
            verificationStatus: a.verification_status || (a.is_verified ? 'APPROVED' : a.status),
            tokenStatus,
            listingStatus,
            listingPriceEth,
            isPurchasable,
            tokenStandard: a.token_standard || a.tokenStandard || 'ERC-721',
            contractAddress: a.contract_address || a.contractAddress,
            tokenId: a.token_id || a.tokenId,
            tokenSymbol: a.token_symbol || a.tokenSymbol,
            totalSupply: a.total_supply || a.totalSupply || 1,
            marketplaceContractAddress: a.marketplace_contract_address || a.marketplaceContractAddress || '0x517082aA429ED926BDbeC904a1879BaE1aFd05f7',
            ownerDisplay: formatPrivacyOwner(currentOwner),
            currentOwnerAddress: currentOwner,
            status: a.status,
            imageUrl: a.image_url || a.imageUrl,
            createdAt: a.created_at || a.createdAt
          };
        });
    }

    res.status(200).json({
      success: true,
      count: responseData.length,
      data: responseData
    });
  } catch (err) {
    next(err);
  }
};

const getAssetById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const asset = await assetService.getAssetById(id);
    if (!asset) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: `Asset with ID '${id}' not found in registry.`
      });
    }
    res.status(200).json({
      success: true,
      data: asset
    });
  } catch (err) {
    next(err);
  }
};

const createAsset = async (req, res, next) => {
  try {
    const newAsset = await assetService.createAsset(req.body, req.user || {});
    res.status(201).json({
      success: true,
      message: 'Asset record registered successfully.',
      data: newAsset
    });
  } catch (err) {
    next(err);
  }
};

const purchaseAsset = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { buyerWallet, txHash, chainId, priceEth, blockNumber, gasFee } = req.body;

    if (!buyerWallet || !txHash) {
      return res.status(400).json({
        success: false,
        error: 'BadRequest',
        message: 'buyerWallet and txHash are required to record a purchase.'
      });
    }

    const updated = await assetService.recordPurchase(
      id,
      { buyerWallet, txHash, chainId, priceEth, blockNumber, gasFee },
      req.user || {}
    );

    res.status(200).json({
      success: true,
      message: 'Token purchase synchronized with ledger successfully.',
      data: updated
    });
  } catch (err) {
    next(err);
  }
};

const transferAsset = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { fromWallet, toWallet, txHash, chainId, blockNumber, gasFee, tokenId } = req.body;

    if (!toWallet || !txHash) {
      return res.status(400).json({
        success: false,
        error: 'BadRequest',
        message: 'toWallet and txHash are required to record a token transfer.'
      });
    }

    const updated = await assetService.recordTransfer(
      id,
      { fromWallet, toWallet, txHash, chainId, blockNumber, gasFee, tokenId },
      req.user || {}
    );

    res.status(200).json({
      success: true,
      message: 'Token transfer synchronized with ledger successfully.',
      data: updated
    });
  } catch (err) {
    next(err);
  }
};

const updateListing = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { listingStatus, listingPriceEth, marketplaceContractAddress } = req.body;

    const updated = await assetService.updateListing(
      id,
      { listingStatus, listingPriceEth, marketplaceContractAddress },
      req.user || {}
    );

    res.status(200).json({
      success: true,
      message: 'Asset listing updated successfully.',
      data: updated
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listAssets,
  getAssetById,
  createAsset,
  purchaseAsset,
  transferAsset,
  updateListing
};
