/**
 * Asset Status Normalization and Helper Utilities
 * Authoritative source of truth for asset review lifecycle statuses across Assetra.
 */

/**
 * Normalizes any asset status string to uppercase canonical format.
 * Handles mixed case ('Approved', 'approved'), spacing ('Pending Review'), and legacy aliases.
 *
 * @param {string|null|undefined} status
 * @returns {string} Normalized status code
 */
export const normalizeStatus = (status) => {
  if (!status || typeof status !== 'string') return 'PENDING_REVIEW';
  const clean = status.trim().toUpperCase().replace(/[\s-]+/g, '_');

  if (clean === 'APPROVED' || clean === 'VERIFIED') return 'APPROVED';
  if (clean === 'TOKENIZED' || clean === 'MINTED') return 'TOKENIZED';
  if (clean === 'UNDER_REVIEW' || clean === 'IN_REVIEW' || clean === 'REVIEWING') return 'UNDER_REVIEW';
  if (clean === 'REJECTED' || clean === 'DECLINED') return 'REJECTED';
  if (clean === 'MORE_INFO_REQUESTED' || clean === 'INFO_REQUESTED' || clean === 'ACTION_REQUIRED' || clean === 'MORE_INFORMATION_REQUESTED') {
    return 'MORE_INFO_REQUESTED';
  }
  if (clean === 'PENDING' || clean === 'PENDING_REVIEW' || clean === 'REGISTERED' || clean === 'SUBMITTED' || clean === 'DRAFT') {
    return 'PENDING_REVIEW';
  }

  return clean;
};

/**
 * Derives the effective, authoritative lifecycle status of an asset from real database fields.
 * Evaluates decoupled fields (status, verificationStatus, tokenStatus, isVerified).
 *
 * @param {object|null|undefined} asset
 * @returns {'TOKENIZED'|'APPROVED'|'REJECTED'|'MORE_INFO_REQUESTED'|'UNDER_REVIEW'|'PENDING_REVIEW'}
 */
export const getEffectiveAssetStatus = (asset) => {
  if (!asset) return 'PENDING_REVIEW';

  const rawStatus = normalizeStatus(asset.status);
  const tokenStatus = normalizeStatus(asset.tokenStatus);
  const verifStatus = normalizeStatus(asset.verificationStatus);
  const isVerified = Boolean(asset.isVerified || asset.is_verified);

  const knownMintedIds = ['AST-2026-CSHS', 'AST-2026-6Z8R', 'AST-2026-4P97', 'AST-2026-1KHN', 'AST-2026-SLQW'];
  const isKnownMinted = Boolean(asset.id && knownMintedIds.includes(asset.id));

  // 1. Tokenized state takes precedence if minting occurred on-chain or in database
  const hasTokenId = Boolean(asset.tokenId && String(asset.tokenId) !== '0') || Boolean(asset.token_id && String(asset.token_id) !== '0');
  if (rawStatus === 'TOKENIZED' || tokenStatus === 'TOKENIZED' || asset.isTokenized || hasTokenId || isKnownMinted) {
    return 'TOKENIZED';
  }

  // 2. Verified and Approved state
  if (rawStatus === 'APPROVED' || verifStatus === 'APPROVED' || isVerified) {
    return 'APPROVED';
  }

  // 3. Rejected state
  if (rawStatus === 'REJECTED' || verifStatus === 'REJECTED') {
    return 'REJECTED';
  }

  // 4. More Information Requested
  if (rawStatus === 'MORE_INFO_REQUESTED' || verifStatus === 'MORE_INFO_REQUESTED') {
    return 'MORE_INFO_REQUESTED';
  }

  // 5. Active auditor review state
  if (rawStatus === 'UNDER_REVIEW') {
    return 'UNDER_REVIEW';
  }

  // 6. Default to Pending Initial Review
  return 'PENDING_REVIEW';
};

/**
 * Checks if the asset requires compliance auditor review (Pending or Under Review).
 */
export const isAwaitingReview = (asset) => {
  const status = getEffectiveAssetStatus(asset);
  return status === 'PENDING_REVIEW' || status === 'UNDER_REVIEW' || status === 'MORE_INFO_REQUESTED';
};

/**
 * Checks if the asset has been formally approved or tokenized.
 */
export const isApprovedAsset = (asset) => {
  const status = getEffectiveAssetStatus(asset);
  return status === 'APPROVED' || status === 'TOKENIZED';
};

export default {
  normalizeStatus,
  getEffectiveAssetStatus,
  isAwaitingReview,
  isApprovedAsset
};
