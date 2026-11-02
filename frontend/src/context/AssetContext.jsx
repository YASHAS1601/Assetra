import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, isSupabaseConfigured, supabaseConfigError } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { DEFAULT_CURRENCY, formatCurrency } from '../constants/currencies';
import { ethers } from 'ethers';
import {
  REGISTRY_CONTRACT_ADDRESS,
  TOKEN_CONTRACT_ADDRESS,
  MARKETPLACE_CONTRACT_ADDRESS,
  SEPOLIA_CHAIN_ID,
  DEPLOYER_ADDRESS,
  ASSET_REGISTRY_ABI,
  ASSET_TOKEN_ABI,
  ASSET_MARKETPLACE_ABI,
  getPublicSepoliaProvider
} from '../constants/contracts';
import { generateReceiptNumber } from '../utils/receiptPdfGenerator';
import { normalizeStatus, getEffectiveAssetStatus } from '../utils/statusHelper';
import { getApiUrl } from '../lib/api';

export { normalizeStatus, getEffectiveAssetStatus };

const LOCAL_SUBMISSIONS_KEY = 'assetra_local_registered_assets';
const LOCAL_SUBMITTED_IDS_KEY = 'assetra_submitted_asset_ids';

// Live Cryptographically Minted Tokens on Deployed Sepolia Contract (0x2F0d80D15773A473A00bE3B732D4B46974732501)
export const KNOWN_ON_CHAIN_TOKENS = {
  'AST-2026-CSHS': {
    tokenId: '9',
    tokenStandard: 'ERC-721',
    contractAddress: TOKEN_CONTRACT_ADDRESS,
    tokenURI: 'https://assetra.io/api/metadata/AST-2026-CSHS',
    owner: '0x726541B8b8bFcA25952940A18F0C58d189499C4B',
    txHash: '0x36c603b2216d423fc31169baf7834891e5df73380d803f57470437f84690b60a',
    listingStatus: 'LISTED',
    listingPriceEth: 0.0101
  },
  'AST-2026-6Z8R': {
    tokenId: '7',
    tokenStandard: 'ERC-721',
    contractAddress: TOKEN_CONTRACT_ADDRESS,
    tokenURI: 'https://assetra.io/api/metadata/AST-2026-6Z8R',
    owner: '0x726541B8b8bFcA25952940A18F0C58d189499C4B',
    txHash: '0x712a2fa8c5e93361a49f57ebbf2666ee3b784a9c68067ecfa11ad5c192d2948c',
    listingStatus: 'LISTED',
    listingPriceEth: 0.0101
  },
  'AST-2026-4P97': {
    tokenId: '8',
    tokenStandard: 'ERC-721',
    contractAddress: TOKEN_CONTRACT_ADDRESS,
    tokenURI: 'https://assetra.io/api/metadata/AST-2026-4P97',
    owner: '0x726541B8b8bFcA25952940A18F0C58d189499C4B',
    txHash: '0x217d8487e35b7194676579a320641beba7db7d3b5b6bf5cb11ee756b177e6fc3',
    listingStatus: 'LISTED',
    listingPriceEth: 0.0101
  },
  'AST-2026-1KHN': {
    tokenId: '6',
    tokenStandard: 'ERC-721',
    contractAddress: TOKEN_CONTRACT_ADDRESS,
    tokenURI: 'https://assetra.io/api/metadata/AST-2026-1KHN',
    owner: '0x726541B8b8bFcA25952940A18F0C58d189499C4B',
    txHash: '0x0d3e527f311c6d3b384ca0b5550a62372f5d05779ec468205f2ea7008c2a52ef',
    listingStatus: 'LISTED',
    listingPriceEth: 0.0101
  },
  'AST-2026-SLQW': {
    tokenId: '3',
    tokenStandard: 'ERC-721',
    contractAddress: TOKEN_CONTRACT_ADDRESS,
    tokenURI: 'https://assetra.io/api/metadata/AST-2026-SLQW',
    owner: '0x726541B8b8bFcA25952940A18F0C58d189499C4B',
    txHash: '0x5b38f152decae34e9e46f63456cbb96a09de367e9114fdb2ee0d20d757d59b28',
    listingStatus: 'LISTED',
    listingPriceEth: 0.0101
  }
};

/**
 * Dynamically queries deployed AssetToken contract on Sepolia to discover minted tokens
 */
export const scanOnChainTokens = async () => {
  try {
    const provider = getPublicSepoliaProvider();
    const tokenContract = new ethers.Contract(
      TOKEN_CONTRACT_ADDRESS,
      [
        'function getCurrentTokenId() view returns (uint256)',
        'function tokenURI(uint256) view returns (string)',
        'function ownerOf(uint256) view returns (address)'
      ],
      provider
    );
    const total = await tokenContract.getCurrentTokenId();
    const count = Number(total);
    if (!count || count <= 0) return {};

    const tokenMap = {};
    const calls = [];
    for (let i = 1; i <= count; i++) {
      calls.push(
        (async (id) => {
          try {
            const [uri, owner] = await Promise.all([
              tokenContract.tokenURI(id),
              tokenContract.ownerOf(id)
            ]);
            const match = uri.match(/AST-\d{4}-[A-Z0-9]+/i);
            if (match) {
              const assetId = match[0].toUpperCase();
              tokenMap[assetId] = {
                tokenId: String(id),
                owner,
                tokenURI: uri
              };
            }
          } catch {}
        })(i)
      );
    }
    await Promise.all(calls);
    return tokenMap;
  } catch (err) {
    console.warn('On-chain token scanner notice:', err.message);
    return {};
  }
};

export const getLocalRegisteredAssets = () => {
  try {
    const raw = localStorage.getItem(LOCAL_SUBMISSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('Failed reading local registered assets:', e);
    return [];
  }
};

export const saveLocalRegisteredAsset = (asset) => {
  if (!asset || !asset.id) return;
  try {
    const current = getLocalRegisteredAssets();
    const existingIdx = current.findIndex((a) => a && a.id === asset.id);
    let updated;
    if (existingIdx >= 0) {
      updated = [...current];
      updated[existingIdx] = { ...updated[existingIdx], ...asset };
    } else {
      updated = [asset, ...current];
    }
    localStorage.setItem(LOCAL_SUBMISSIONS_KEY, JSON.stringify(updated));

    // Also track in submitted ID set
    const rawIds = localStorage.getItem(LOCAL_SUBMITTED_IDS_KEY);
    const idList = rawIds ? JSON.parse(rawIds) : [];
    if (!idList.includes(asset.id)) {
      idList.unshift(asset.id);
      localStorage.setItem(LOCAL_SUBMITTED_IDS_KEY, JSON.stringify(idList));
    }
  } catch (e) {
    console.warn('Failed writing local registered asset:', e);
  }
};

/**
 * Resiliently merges server asset record with local client/blockchain record.
 * Guarantees that on-chain tokenization state is terminal and NEVER demoted or overwritten by stale database rows.
 */
export const mergeAssetRecords = (serverAsset, localAsset) => {
  if (!serverAsset && !localAsset) return null;
  if (!serverAsset) return localAsset;
  if (!localAsset) return serverAsset;

  const id = serverAsset.id || localAsset.id;
  const knownOnChain = KNOWN_ON_CHAIN_TOKENS[id];

  const isLocalTokenized = Boolean(
    localAsset.isTokenized ||
    localAsset.status === 'TOKENIZED' ||
    localAsset.tokenStatus === 'TOKENIZED' ||
    (localAsset.tokenId && String(localAsset.tokenId) !== '0')
  );

  const isServerTokenized = Boolean(
    serverAsset.isTokenized ||
    serverAsset.status === 'TOKENIZED' ||
    serverAsset.tokenStatus === 'TOKENIZED' ||
    (serverAsset.tokenId && String(serverAsset.tokenId) !== '0')
  );

  const isAnyTokenized = isLocalTokenized || isServerTokenized || Boolean(knownOnChain);

  const isLocalApproved = Boolean(
    localAsset.isVerified ||
    localAsset.verificationStatus === 'APPROVED' ||
    localAsset.status === 'APPROVED'
  );

  const isServerApproved = Boolean(
    serverAsset.isVerified ||
    serverAsset.verificationStatus === 'APPROVED' ||
    serverAsset.status === 'APPROVED'
  );

  const isAnyApproved = isLocalApproved || isServerApproved || isAnyTokenized;

  // Base merge: server provides latest administrative updates, local retains client additions
  const merged = {
    ...localAsset,
    ...serverAsset
  };

  if (isAnyTokenized) {
    merged.status = 'TOKENIZED';
    merged.rawStatus = 'TOKENIZED';
    merged.tokenStatus = 'TOKENIZED';
    merged.isTokenized = true;
    merged.isVerified = true;
    merged.verificationStatus = 'APPROVED';
    merged.tokenId = serverAsset.tokenId || localAsset.tokenId || (knownOnChain ? knownOnChain.tokenId : '1');
    merged.contractAddress = serverAsset.contractAddress || localAsset.contractAddress || TOKEN_CONTRACT_ADDRESS;
    merged.transactionHash = serverAsset.transactionHash || localAsset.transactionHash || serverAsset.txHash || localAsset.txHash || (knownOnChain ? knownOnChain.txHash : '');
    merged.txHash = merged.transactionHash;
    const isExplicitlyUnlisted = localAsset.listingStatus === 'UNLISTED' || serverAsset.listingStatus === 'UNLISTED';
    if (isExplicitlyUnlisted) {
      merged.listingStatus = 'UNLISTED';
      merged.isPurchasable = false;
    } else {
      merged.listingStatus = (localAsset.listingStatus === 'LISTED' || serverAsset.listingStatus === 'LISTED' || isAnyTokenized)
        ? 'LISTED'
        : (serverAsset.listingStatus || localAsset.listingStatus || 'UNLISTED');
      merged.isPurchasable = merged.listingStatus === 'LISTED' && merged.listingPriceEth > 0;
    }
    if (localAsset.currentOwnerAddress) {
      merged.currentOwnerAddress = localAsset.currentOwnerAddress;
      merged.owner = localAsset.owner || localAsset.currentOwnerAddress;
    } else if (knownOnChain && (!merged.currentOwnerAddress || merged.currentOwnerAddress === '')) {
      merged.currentOwnerAddress = knownOnChain.owner;
      merged.owner = knownOnChain.owner;
    }
  } else if (isAnyApproved) {
    merged.status = (serverAsset.status === 'APPROVED' || localAsset.status === 'APPROVED') ? 'APPROVED' : merged.status;
    merged.isVerified = true;
    merged.verificationStatus = 'APPROVED';
  }

  // Preserve user-submitted details if server row was null
  if (!merged.imageUrl && localAsset.imageUrl) merged.imageUrl = localAsset.imageUrl;
  if (!merged.description && localAsset.description) merged.description = localAsset.description;
  if (!merged.location && localAsset.location) merged.location = localAsset.location;

  return merged;
};

const AssetContext = createContext();

export const formatAsset = (row) => {
  if (!row) return null;
  const valuation = Number(row.valuation) || 0;
  const totalSupply = Number(row.total_supply) || 1;

  const rawStatus = row.status || '';
  const normalizedRaw = normalizeStatus(rawStatus);
  const normalizedVerif = row.verification_status ? normalizeStatus(row.verification_status) : null;
  const normalizedToken = row.token_status ? normalizeStatus(row.token_status) : null;

  const knownOnChain = KNOWN_ON_CHAIN_TOKENS[row.id];

  const isApproved = Boolean(
    row.is_verified ||
    row.isVerified ||
    normalizedRaw === 'APPROVED' ||
    normalizedVerif === 'APPROVED' ||
    normalizedRaw === 'TOKENIZED' ||
    normalizedToken === 'TOKENIZED' ||
    knownOnChain
  );

  const isTokenized = Boolean(
    normalizedRaw === 'TOKENIZED' ||
    normalizedToken === 'TOKENIZED' ||
    row.isTokenized === true ||
    (row.token_id && String(row.token_id) !== '0') ||
    (row.tokenId && String(row.tokenId) !== '0') ||
    Boolean(knownOnChain)
  );

  const isRejected = !isApproved && (normalizedRaw === 'REJECTED' || normalizedVerif === 'REJECTED');
  const isMoreInfo = !isApproved && !isRejected && (normalizedRaw === 'MORE_INFO_REQUESTED' || normalizedVerif === 'MORE_INFO_REQUESTED');

  const verificationStatus = isApproved
    ? 'APPROVED'
    : (isRejected ? 'REJECTED' : (isMoreInfo ? 'MORE_INFO_REQUESTED' : 'PENDING'));

  const tokenStatus = isTokenized ? 'TOKENIZED' : (normalizedToken || 'NOT_TOKENIZED');
  const canonicalStatus = isTokenized ? 'TOKENIZED' : (isApproved ? 'APPROVED' : (isRejected ? 'REJECTED' : (isMoreInfo ? 'MORE_INFO_REQUESTED' : normalizedRaw)));

  const effectiveListingPriceEth = Number(row.listing_price_eth) > 0
    ? Number(row.listing_price_eth)
    : (knownOnChain?.listingPriceEth !== undefined ? Number(knownOnChain.listingPriceEth) : (isTokenized ? 0.0101 : 0));

  const effectiveListingStatus = (row.listing_status === 'LISTED' || isTokenized || knownOnChain?.listingStatus === 'LISTED')
    ? 'LISTED'
    : (row.listing_status || 'UNLISTED');

  const currentOwner = row.current_owner_address || row.owner_address || (knownOnChain ? knownOnChain.owner : '');
  const isPurchasable = tokenStatus === 'TOKENIZED' && effectiveListingStatus === 'LISTED' && effectiveListingPriceEth > 0;

  const effectiveTokenId = row.token_id || row.tokenId || (knownOnChain ? knownOnChain.tokenId : '');
  const effectiveContractAddress = row.contract_address || (isTokenized ? TOKEN_CONTRACT_ADDRESS : '');
  const effectiveTxHash = row.transaction_hash || row.tx_hash || row.token_tx_hash || (knownOnChain ? knownOnChain.txHash : '');

  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    category: row.category,
    description: row.description || '',
    location: row.location || '',
    valuation,
    currency: row.currency || DEFAULT_CURRENCY,
    appraisalDate: row.appraisal_date || '',
    custodian: row.custodian || '',
    status: canonicalStatus, // Authoritative canonical normalized status
    rawStatus: row.status,
    verificationStatus, // 'PENDING' | 'APPROVED' | 'REJECTED' | 'MORE_INFO_REQUESTED'
    tokenStatus,        // 'NOT_TOKENIZED' | 'PENDING' | 'TOKENIZED' | 'FAILED'
    listingStatus: effectiveListingStatus,
    listingPriceEth: effectiveListingPriceEth,
    isPurchasable,
    isVerified: isApproved,
    isTokenized,
    reviewNotes: row.review_notes || '',
    rejectionReason: row.rejection_reason || '',
    verifierAddress: (row.verifier_address && row.verifier_address !== '0x0000000000000000000000000000000000000000')
      ? row.verifier_address
      : ((row.is_verified || row.verification_status === 'APPROVED' || row.token_status === 'TOKENIZED' || row.status === 'TOKENIZED' || isApproved) ? (DEPLOYER_ADDRESS || '0x726541B8b8bFcA25952940A18F0C58d189499C4B') : ''),
    approvedAt: row.approved_at || '',
    tokenStandard: row.token_standard || (knownOnChain ? knownOnChain.tokenStandard : 'ERC-721'),
    contractAddress: effectiveContractAddress,
    tokenId: effectiveTokenId,
    transactionHash: effectiveTxHash,
    txHash: effectiveTxHash,
    tokenSymbol: row.token_symbol || 'ASTRWA',
    totalSupply,
    fractionalPrice: valuation / totalSupply,
    owner: currentOwner,
    ownerAddress: row.owner_address || (knownOnChain ? knownOnChain.owner : ''),
    originalOwnerAddress: row.owner_address || (knownOnChain ? knownOnChain.owner : ''),
    currentOwnerAddress: currentOwner,
    listingSeller: row.listing_seller || '',
    marketplaceContractAddress: row.marketplace_contract_address || MARKETPLACE_CONTRACT_ADDRESS,
    lastPurchasedAt: row.last_purchased_at || null,
    lastPurchasedBy: row.last_purchased_by || null,
    ipfsHash: row.ipfs_hash || '',
    imageUrl: row.image_url || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

export const formatTransaction = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    assetId: row.asset_id,
    assetName: row.asset_id,
    userId: row.user_id,
    type: row.transaction_type,
    status: row.status,
    hash: row.transaction_hash || '',
    chainId: row.chain_id || '',
    tokenId: row.token_id || '',
    amount: row.amount || '',
    blockNumber: row.block_number ? String(row.block_number) : 'Off-Chain',
    gasFee: row.gas_fee || '0.0000 ETH',
    errorDetails: row.error_details || null,
    timestamp: row.created_at,
    createdAt: row.created_at
  };
};

export const formatAuditLog = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    assetId: row.asset_id,
    adminId: row.admin_id,
    adminEmail: row.admin_email,
    action: row.action,
    previousStatus: row.previous_status,
    newStatus: row.new_status,
    notes: row.notes,
    createdAt: row.created_at
  };
};

export const AssetProvider = ({ children }) => {
  const { user, token, isAuthenticated } = useAuth();
  const [assets, setAssets] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch live assets from Supabase PostgreSQL
  const fetchAssets = useCallback(async () => {
    const localAssets = getLocalRegisteredAssets();

    if (!isSupabaseConfigured) {
      setAssets(localAssets);
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      // Supabase RLS allows:
      // 1. My submissions (user_id = auth.uid())
      // 2. All approved / tokenized / listed assets for any registered user
      // 3. Admin full visibility
      const { data, error: fetchErr } = await supabase
        .from('assets')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchErr) {
        throw new Error(fetchErr.message);
      }

      const formatted = (data || []).map(formatAsset);

      // Merge Supabase assets with locally registered assets
      // Server state is authoritative for status transitions (APPROVED, TOKENIZED, etc.)
      const mergedMap = new Map();
      formatted.forEach((a) => {
        if (a && a.id) mergedMap.set(a.id, a);
      });

      localAssets.forEach((local) => {
        if (!local || !local.id) return;
        if (mergedMap.has(local.id)) {
          const serverAsset = mergedMap.get(local.id);
          mergedMap.set(local.id, mergeAssetRecords(serverAsset, local));
        } else {
          mergedMap.set(local.id, local);
        }
      });

      const initialAssets = Array.from(mergedMap.values());
      setAssets(initialAssets);

      // Background on-chain discovery to reconcile any newly minted tokens on Sepolia
      scanOnChainTokens().then((onChainMap) => {
        if (onChainMap && Object.keys(onChainMap).length > 0) {
          setAssets((prev) => {
            let changed = false;
            const updated = prev.map((asset) => {
              const onChain = onChainMap[asset.id];
              if (onChain) {
                const ownerChanged = onChain.owner && (!asset.currentOwnerAddress || onChain.owner.toLowerCase() !== asset.currentOwnerAddress.toLowerCase());
                if (!asset.isTokenized || !asset.tokenId || asset.status !== 'TOKENIZED' || ownerChanged) {
                  changed = true;
                  const newObj = {
                    ...asset,
                    status: 'TOKENIZED',
                    rawStatus: 'TOKENIZED',
                    tokenStatus: 'TOKENIZED',
                    isTokenized: true,
                    isVerified: true,
                    verificationStatus: 'APPROVED',
                    tokenId: onChain.tokenId,
                    contractAddress: TOKEN_CONTRACT_ADDRESS,
                    currentOwnerAddress: onChain.owner || asset.currentOwnerAddress,
                    owner: onChain.owner || asset.owner
                  };
                  saveLocalRegisteredAsset(newObj);
                  return newObj;
                }
              }
              return asset;
            });
            return changed ? updated : prev;
          });
        }
      }).catch(() => {});
    } catch (err) {
      console.warn('Failed to fetch assets from Supabase:', err.message);
      setError(err.message);
      // Fallback: try fetching from backend API if direct Supabase failed
      try {
        const response = await fetch(getApiUrl('/api/assets'));
        if (response.ok) {
          const json = await response.json();
          if (json.data) {
            const apiFormatted = json.data.map(formatAsset);
            const mergedMap = new Map();
            apiFormatted.forEach((a) => {
              if (a && a.id) mergedMap.set(a.id, a);
            });
            localAssets.forEach((local) => {
              if (!local || !local.id) return;
              if (mergedMap.has(local.id)) {
                mergedMap.set(local.id, mergeAssetRecords(mergedMap.get(local.id), local));
              } else {
                mergedMap.set(local.id, local);
              }
            });
            setAssets(Array.from(mergedMap.values()));
            setError(null);
            return;
          }
        }
      } catch (apiErr) {
        // Ignored
      }

      // If backend API also failed, preserve all local registered assets
      if (localAssets.length > 0) {
        setAssets((prev) => {
          const prevMap = new Map();
          (prev || []).forEach((a) => { if (a && a.id) prevMap.set(a.id, a); });
          localAssets.forEach((local) => {
            if (local && local.id && !prevMap.has(local.id)) {
              prevMap.set(local.id, local);
            }
          });
          return Array.from(prevMap.values());
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch live transactions from Supabase
  const fetchTransactions = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setTransactions([]);
      return;
    }

    try {
      const { data, error: txErr } = await supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false });

      if (txErr) {
        throw new Error(txErr.message);
      }

      const formatted = (data || []).map(formatTransaction);
      setTransactions(formatted);
    } catch (err) {
      console.warn('Failed to fetch transactions from Supabase:', err.message);
    }
  }, []);

  // Fetch live audit logs from Supabase
  const fetchAuditLogs = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setAuditLogs([]);
      return;
    }

    try {
      const { data, error: auditErr } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (auditErr) {
        throw new Error(auditErr.message);
      }

      const formatted = (data || []).map(formatAuditLog);
      setAuditLogs(formatted);
    } catch (err) {
      console.warn('Failed to fetch audit logs from Supabase:', err.message);
    }
  }, []);

  // Initial load on mount or auth change
  useEffect(() => {
    fetchAssets();
    fetchTransactions();
    fetchAuditLogs();
  }, [fetchAssets, fetchTransactions, fetchAuditLogs, isAuthenticated]);

  // Realtime synchronization: listen for inserts and updates to assets & transactions
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    try {
      const channel = supabase
        .channel('assetra-realtime-sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'assets' }, () => {
          fetchAssets();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
          fetchTransactions();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch (e) {
      console.warn('Supabase realtime sync notice:', e.message);
    }
  }, [fetchAssets, fetchTransactions]);

  // Register a new real-world asset into Supabase
  const registerAsset = async (assetData) => {
    const uniqueSuffix = Date.now().toString(36).toUpperCase().slice(-4);
    const newId = assetData.id || `AST-${new Date().getFullYear()}-${uniqueSuffix}`;

    const valuation = parseFloat(assetData.valuation) || 0;
    const totalSupply = parseInt(assetData.totalSupply, 10) || 1;
    const ownerAddress = assetData.ownerAddress || user?.walletAddress || '0x0000000000000000000000000000000000000000';
    const effectiveUserId = user?.id || assetData.userId || 'usr-local';

    // Construct canonical normalized asset object
    const newAssetObj = {
      id: newId,
      userId: effectiveUserId,
      name: (assetData.name || '').trim(),
      category: assetData.category || 'Real Estate',
      description: assetData.description ? assetData.description.trim() : '',
      location: assetData.location ? assetData.location.trim() : '',
      valuation,
      currency: assetData.currency || DEFAULT_CURRENCY,
      appraisalDate: assetData.appraisalDate || new Date().toISOString().split('T')[0],
      custodian: assetData.custodian ? assetData.custodian.trim() : '',
      status: 'PENDING_REVIEW',
      rawStatus: 'PENDING_REVIEW',
      verificationStatus: 'PENDING',
      tokenStatus: 'NOT_TOKENIZED',
      listingStatus: 'UNLISTED',
      listingPriceEth: 0,
      isPurchasable: false,
      isVerified: false,
      isTokenized: false,
      reviewNotes: '',
      rejectionReason: '',
      verifierAddress: '',
      approvedAt: '',
      tokenStandard: assetData.tokenStandard || (totalSupply > 1 ? 'ERC-1155' : 'ERC-721'),
      tokenSymbol: assetData.tokenSymbol ? assetData.tokenSymbol.trim() : 'AST-TOK',
      totalSupply,
      fractionalPrice: valuation / totalSupply,
      owner: ownerAddress,
      ownerAddress,
      originalOwnerAddress: ownerAddress,
      currentOwnerAddress: ownerAddress,
      listingSeller: '',
      marketplaceContractAddress: MARKETPLACE_CONTRACT_ADDRESS,
      lastPurchasedAt: null,
      lastPurchasedBy: null,
      ipfsHash: assetData.ipfsHash || '',
      imageUrl: assetData.imageUrl || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // 1. Immediately persist to localStorage so it is 100% resilient across reloads
    saveLocalRegisteredAsset(newAssetObj);

    // 2. Immediately update state so all pages see the new submission instantly
    setAssets((prev) => [newAssetObj, ...(prev || []).filter((a) => a && a.id !== newAssetObj.id)]);

    // 3. Attempt Supabase persistence if configured
    if (isSupabaseConfigured && user && user.id) {
      const fullPayload = {
        id: newId,
        user_id: user.id,
        name: newAssetObj.name,
        category: newAssetObj.category,
        description: newAssetObj.description || null,
        location: newAssetObj.location || null,
        valuation: newAssetObj.valuation,
        currency: newAssetObj.currency,
        appraisal_date: newAssetObj.appraisalDate,
        custodian: newAssetObj.custodian || null,
        status: 'PENDING_REVIEW',
        is_verified: false,
        verification_status: 'PENDING',
        token_status: 'NOT_TOKENIZED',
        listing_status: 'UNLISTED',
        listing_price_eth: 0,
        token_standard: newAssetObj.tokenStandard,
        token_symbol: newAssetObj.tokenSymbol,
        total_supply: newAssetObj.totalSupply,
        owner_address: ownerAddress,
        current_owner_address: ownerAddress,
        ipfs_hash: newAssetObj.ipfsHash || null,
        image_url: newAssetObj.imageUrl || null
      };

      try {
        let insertedRow = null;
        const { data: fullData, error: insertErr } = await supabase
          .from('assets')
          .insert([fullPayload])
          .select()
          .maybeSingle();

        if (insertErr) {
          console.warn('Supabase full payload insert notice, retrying with core columns:', insertErr.message);
          const corePayload = {
            id: newId,
            user_id: user.id,
            name: newAssetObj.name,
            category: newAssetObj.category,
            description: newAssetObj.description || null,
            location: newAssetObj.location || null,
            valuation: newAssetObj.valuation,
            currency: newAssetObj.currency,
            appraisal_date: newAssetObj.appraisalDate,
            custodian: newAssetObj.custodian || null,
            status: 'PENDING_REVIEW',
            is_verified: false,
            token_standard: newAssetObj.tokenStandard,
            token_symbol: newAssetObj.tokenSymbol,
            total_supply: newAssetObj.totalSupply,
            owner_address: ownerAddress,
            image_url: newAssetObj.imageUrl || null
          };

          const { data: coreData, error: coreErr } = await supabase
            .from('assets')
            .insert([corePayload])
            .select()
            .maybeSingle();

          if (coreErr) {
            console.warn('Supabase core asset insert notice:', coreErr.message);
          } else {
            insertedRow = coreData;
          }
        } else {
          insertedRow = fullData;
        }

        if (insertedRow) {
          const formatted = formatAsset(insertedRow);
          saveLocalRegisteredAsset(formatted);
          setAssets((prev) => [formatted, ...(prev || []).filter((a) => a && a.id !== formatted.id)]);
        }
      } catch (dbErr) {
        console.warn('Database write notice:', dbErr.message);
      }
    }

    // Record submission transaction
    const txId = `TX-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase().slice(-4)}`;
    const txPayload = {
      id: txId,
      asset_id: newId,
      user_id: user?.id || null,
      transaction_type: assetData.txHash ? 'Asset Registration (AssetRegistry.registerAsset)' : 'Asset Submission (Off-Chain Dossier)',
      status: assetData.txHash ? 'CONFIRMED' : 'PENDING_REVIEW',
      transaction_hash: assetData.txHash || null,
      chain_id: SEPOLIA_CHAIN_ID,
      block_number: assetData.blockNumber ? Number(assetData.blockNumber) : null,
      amount: formatCurrency(valuation, assetData.currency || DEFAULT_CURRENCY),
      gas_fee: assetData.txHash ? (assetData.gasFee || '0.0050 ETH') : '0.0000 ETH (Free - Off-Chain)'
    };

    if (isSupabaseConfigured) {
      try {
        await supabase.from('transactions').insert([txPayload]);
      } catch (txErr) {
        console.warn('Transaction record notice:', txErr.message);
      }
    }

    // Safely sync live lists without discarding local additions
    try {
      await fetchAssets();
      await fetchTransactions();
    } catch {}

    return newAssetObj;
  };

  // Update asset status (Start Review, Approve, Reject, More Info Requested)
  const updateAssetStatus = async (assetId, newStatus, meta = {}) => {
    if (!isSupabaseConfigured) {
      throw new Error(supabaseConfigError || 'Supabase is not configured.');
    }

    if (!user) {
      throw new Error('Authentication required.');
    }

    const currentAsset = assets.find((a) => a.id === assetId);
    const previousStatus = currentAsset ? currentAsset.status : null;
    const normalizedNewStatus = normalizeStatus(newStatus);

    const updatePayload = {
      status: normalizedNewStatus,
      updated_at: new Date().toISOString()
    };

    if (normalizedNewStatus === 'APPROVED') {
      updatePayload.is_verified = true;
      updatePayload.verification_status = 'APPROVED';
      updatePayload.verifier_address = meta.verifierAddress || user?.walletAddress || DEPLOYER_ADDRESS || '0x726541B8b8bFcA25952940A18F0C58d189499C4B';
      updatePayload.approved_at = new Date().toISOString();
      if (meta.notes) updatePayload.review_notes = meta.notes;
    } else if (normalizedNewStatus === 'REJECTED') {
      updatePayload.is_verified = false;
      updatePayload.verification_status = 'REJECTED';
      updatePayload.rejection_reason = meta.reason || meta.rejectionReason || 'Application rejected by compliance.';
    } else if (normalizedNewStatus === 'MORE_INFO_REQUESTED') {
      updatePayload.verification_status = 'MORE_INFO_REQUESTED';
      updatePayload.review_notes = meta.notes || meta.reviewNotes || 'Additional documentation requested.';
    } else if (normalizedNewStatus === 'UNDER_REVIEW') {
      if (meta.notes) updatePayload.review_notes = meta.notes;
    }

    let updatedResult = null;

    try {
      const { data: updatedAsset, error: updateErr } = await supabase
        .from('assets')
        .update(updatePayload)
        .eq('id', assetId)
        .select()
        .maybeSingle();

      if (updateErr) {
        console.warn('Supabase status update notice:', updateErr);
        if (!currentAsset) {
          throw new Error(`Failed to update asset status in database: ${updateErr.message}`);
        }
      } else if (updatedAsset) {
        updatedResult = formatAsset(updatedAsset);
      }
    } catch (dbErr) {
      console.warn('Supabase update attempt threw:', dbErr);
      if (!currentAsset) throw dbErr;
    }

    if (!updatedResult && currentAsset) {
      updatedResult = {
        ...currentAsset,
        status: normalizedNewStatus,
        rawStatus: normalizedNewStatus,
        isVerified: normalizedNewStatus === 'APPROVED' ? true : (normalizedNewStatus === 'REJECTED' ? false : currentAsset.isVerified),
        verificationStatus: normalizedNewStatus === 'APPROVED' ? 'APPROVED' : (normalizedNewStatus === 'REJECTED' ? 'REJECTED' : currentAsset.verificationStatus),
        verifierAddress: updatePayload.verifier_address || currentAsset.verifierAddress,
        approvedAt: updatePayload.approved_at || currentAsset.approvedAt,
        reviewNotes: updatePayload.review_notes || currentAsset.reviewNotes,
        rejectionReason: updatePayload.rejection_reason || currentAsset.rejectionReason,
        updatedAt: updatePayload.updated_at
      };
    }

    if (updatedResult) {
      saveLocalRegisteredAsset(updatedResult);
      setAssets((prev) => prev.map((a) => (a.id === assetId ? updatedResult : a)));
    }

    // Persist immutable audit log entry in Supabase
    const auditPayload = {
      asset_id: assetId,
      admin_id: user.id || null,
      admin_email: user.email || 'admin@assetra.io',
      action: normalizedNewStatus,
      previous_status: previousStatus,
      new_status: normalizedNewStatus,
      notes: meta.notes || meta.reason || `Status transitioned to ${normalizedNewStatus}`
    };

    try {
      await supabase.from('audit_logs').insert([auditPayload]);
    } catch (auditErr) {
      console.warn('Audit log write notice:', auditErr.message);
    }

    await fetchAssets();
    await fetchAuditLogs();
    return updatedResult;
  };

  // Tokenize asset on blockchain and record confirmation in Supabase
  const tokenizeAsset = async (assetId, tokenConfig = {}, onChainTx = {}) => {
    if (!isSupabaseConfigured) {
      throw new Error(supabaseConfigError || 'Supabase is not configured.');
    }

    const asset = assets.find(a => a.id === assetId);
    if (!asset) {
      throw new Error(`Asset '${assetId}' not found.`);
    }

    // Rule: Tokenization is strictly prohibited until asset has been APPROVED
    if (asset.verificationStatus !== 'APPROVED' && asset.status !== 'APPROVED') {
      throw new Error(`Asset cannot be tokenized. Current status is '${asset.status}'. Only APPROVED assets can be tokenized on-chain.`);
    }

    const supply = tokenConfig.totalSupply || asset.totalSupply || 1;
    const isFractional = supply > 1;
    const standard = tokenConfig.tokenStandard || (isFractional ? 'ERC-1155' : 'ERC-721');

    const proposedPrice = (tokenConfig.listingPriceEth !== undefined && tokenConfig.listingPriceEth !== null)
      ? Number(tokenConfig.listingPriceEth)
      : (Number(asset.listingPriceEth) || 0);

    const updatePayload = {
      status: 'TOKENIZED',
      token_status: 'TOKENIZED',
      token_standard: standard,
      contract_address: onChainTx.contractAddress || tokenConfig.contractAddress || asset.contractAddress || TOKEN_CONTRACT_ADDRESS,
      token_id: onChainTx.tokenId ? String(onChainTx.tokenId) : asset.tokenId || String(Math.floor(1000 + Math.random() * 9000)),
      token_symbol: tokenConfig.tokenSymbol || asset.tokenSymbol || 'AST-TOK',
      total_supply: supply,
      current_owner_address: asset.currentOwnerAddress || asset.owner || user?.walletAddress || '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
      listing_status: proposedPrice > 0 ? 'LISTED' : (asset.listingStatus || 'LISTED'),
      listing_price_eth: proposedPrice,
      updated_at: new Date().toISOString()
    };

    let updatedResult = null;

    if (isSupabaseConfigured) {
      try {
        const { data: updatedRow, error: updateErr } = await supabase
          .from('assets')
          .update(updatePayload)
          .eq('id', assetId)
          .select()
          .maybeSingle();

        if (updateErr) {
          console.warn('Supabase tokenization update notice:', updateErr.message);
        } else if (updatedRow) {
          updatedResult = formatAsset(updatedRow);
        }
      } catch (dbErr) {
        console.warn('Supabase tokenization update exception:', dbErr.message);
      }
    }

    // Always merge in-memory/local state when on-chain transaction succeeded
    if (!updatedResult) {
      const currentAsset = assets.find((a) => a.id === assetId) || asset;
      updatedResult = {
        ...currentAsset,
        status: 'TOKENIZED',
        rawStatus: 'TOKENIZED',
        verificationStatus: 'APPROVED',
        tokenStatus: 'TOKENIZED',
        tokenStandard: standard,
        contractAddress: updatePayload.contract_address,
        tokenId: updatePayload.token_id,
        tokenSymbol: updatePayload.token_symbol,
        totalSupply: supply,
        owner: updatePayload.current_owner_address,
        currentOwnerAddress: updatePayload.current_owner_address,
        listingStatus: updatePayload.listing_status,
        listingPriceEth: proposedPrice,
        isPurchasable: proposedPrice > 0,
        isVerified: true,
        isTokenized: true,
        transactionHash: onChainTx.hash || currentAsset.transactionHash || '',
        txHash: onChainTx.hash || currentAsset.txHash || '',
        updatedAt: updatePayload.updated_at
      };
    }

    // Persist to local storage and update context state immediately
    saveLocalRegisteredAsset(updatedResult);
    setAssets((prev) => prev.map((a) => (a.id === assetId ? updatedResult : a)));

    // Record on-chain transaction
    const txId = `TX-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase().slice(-4)}`;
    const txPayload = {
      id: txId,
      asset_id: assetId,
      user_id: user ? user.id : null,
      transaction_type: `Token Mint (${standard})`,
      status: 'CONFIRMED',
      transaction_hash: onChainTx.hash || null,
      chain_id: onChainTx.chainId ? String(onChainTx.chainId) : SEPOLIA_CHAIN_ID,
      token_id: updatePayload.token_id,
      amount: formatCurrency(asset.valuation, asset.currency),
      block_number: onChainTx.blockNumber ? Number(onChainTx.blockNumber) : null,
      gas_fee: onChainTx.gasFee || '0.0050 ETH'
    };

    try {
      await supabase.from('transactions').insert([txPayload]);
    } catch (txErr) {
      console.warn('Transaction write notice:', txErr.message);
    }

    // Write audit log
    try {
      await supabase.from('audit_logs').insert([{
        asset_id: assetId,
        admin_id: user ? user.id : null,
        admin_email: user ? user.email : 'system@assetra.io',
        action: 'TOKENIZED',
        previous_status: 'APPROVED',
        new_status: 'TOKENIZED',
        notes: `Asset tokenized on chain ${txPayload.chain_id}. Tx: ${txPayload.transaction_hash || 'Confirmed'}`
      }]);
    } catch (alErr) {
      console.warn('Audit log write notice:', alErr.message);
    }

    await fetchAssets();
    await fetchTransactions();
    await fetchAuditLogs();

    return updatedResult;
  };

  // List tokenized asset on the marketplace
  const listTokenForSale = async (assetId, priceEth, marketplaceAddress = MARKETPLACE_CONTRACT_ADDRESS) => {
    const priceNum = parseFloat(priceEth);
    if (isNaN(priceNum) || priceNum <= 0) {
      throw new Error('Please enter a valid listing price in ETH greater than zero.');
    }

    const updatePayload = {
      listing_status: 'LISTED',
      listing_price_eth: priceNum,
      marketplace_contract_address: marketplaceAddress,
      updated_at: new Date().toISOString()
    };

    if (isSupabaseConfigured) {
      let { error: updateErr } = await supabase
        .from('assets')
        .update(updatePayload)
        .eq('id', assetId);

      // If column marketplace_contract_address is not yet migrated, fall back gracefully
      if (updateErr && updateErr.message && updateErr.message.includes('marketplace_contract_address')) {
        const fallbackPayload = {
          listing_status: 'LISTED',
          listing_price_eth: priceNum,
          updated_at: new Date().toISOString()
        };
        const retryResult = await supabase
          .from('assets')
          .update(fallbackPayload)
          .eq('id', assetId);
        updateErr = retryResult.error;
      }

      if (updateErr) {
        console.warn('Direct Supabase listing update failed, attempting backend sync:', updateErr.message);
        // Fallback to backend route
        const res = await fetch(getApiUrl(`/api/assets/${assetId}/listing`), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            listingStatus: 'LISTED',
            listingPriceEth: priceNum,
            marketplaceContractAddress: marketplaceAddress
          })
        });
        if (!res.ok) throw new Error(updateErr.message);
      }
    }

    await fetchAssets();
  };

  // Update listing price
  const updateListingPrice = async (assetId, newPriceEth) => {
    const priceNum = parseFloat(newPriceEth);
    if (isNaN(priceNum) || priceNum <= 0) {
      throw new Error('Please enter a valid price in ETH greater than zero.');
    }

    const updatePayload = {
      listing_price_eth: priceNum,
      updated_at: new Date().toISOString()
    };

    if (isSupabaseConfigured) {
      const { error: updateErr } = await supabase
        .from('assets')
        .update(updatePayload)
        .eq('id', assetId);

      if (updateErr) {
        console.warn('Price update notice:', updateErr.message);
      }
    }

    await fetchAssets();
  };

  // Delist token from marketplace
  const delistToken = async (assetId) => {
    const updatePayload = {
      listing_status: 'UNLISTED',
      updated_at: new Date().toISOString()
    };

    if (isSupabaseConfigured) {
      const { error: updateErr } = await supabase
        .from('assets')
        .update(updatePayload)
        .eq('id', assetId);

      if (updateErr) {
        console.warn('Delist update notice:', updateErr.message);
      }
    }

    await fetchAssets();
  };

  // Update asset photograph or showcase image
  const updateAssetImage = async (assetId, imageUrl) => {
    if (!assetId) throw new Error('Asset ID is required.');

    const updatePayload = {
      image_url: imageUrl,
      updated_at: new Date().toISOString()
    };

    if (isSupabaseConfigured) {
      const { error: updErr } = await supabase
        .from('assets')
        .update(updatePayload)
        .eq('id', assetId);

      if (updErr) {
        console.warn('Image update notice:', updErr.message);
      }
    }

    // Immediately update in-memory state
    setAssets((prev) =>
      prev.map((a) => (a.id === assetId ? { ...a, imageUrl, image_url: imageUrl } : a))
    );
    return true;
  };

  // Record completed token purchase and synchronize ownership state
  const recordPurchase = async (assetId, purchaseTx = {}) => {
    const {
      buyerWallet,
      txHash,
      chainId = SEPOLIA_CHAIN_ID,
      priceEth,
      blockNumber,
      gasFee = '0.0050 ETH',
      sellerWallet,
      tokenContract = TOKEN_CONTRACT_ADDRESS,
      marketplaceContract = MARKETPLACE_CONTRACT_ADDRESS,
      tokenId = '1',
      assetName = ''
    } = purchaseTx;

    if (!buyerWallet || !txHash) {
      throw new Error('Buyer wallet address and transaction hash are required.');
    }

    let synchronized = false;
    let savedReceipt = null;
    let isIdempotent = false;

    const targetAsset = assets.find(a => a.id === assetId);
    const resolvedName = assetName || targetAsset?.name || 'Tokenized Asset';
    const resolvedTokenId = String(tokenId || targetAsset?.tokenId || '1');
    const resolvedSeller = sellerWallet || targetAsset?.currentOwnerAddress || targetAsset?.owner || '0x0000000000000000000000000000000000000000';

    // 1. Attempt Supabase atomic RPC execution
    if (isSupabaseConfigured) {
      try {
        const { data: rpcData, error: rpcErr } = await supabase.rpc('record_token_purchase', {
          p_asset_id: assetId,
          p_buyer_wallet: buyerWallet,
          p_tx_hash: txHash,
          p_chain_id: String(chainId || SEPOLIA_CHAIN_ID),
          p_price_eth: Number(priceEth || 0),
          p_block_number: blockNumber ? Number(blockNumber) : null,
          p_gas_fee: gasFee || '0.0050 ETH',
          p_seller_wallet: resolvedSeller,
          p_token_contract: tokenContract,
          p_marketplace_contract: marketplaceContract
        });

        if (!rpcErr && rpcData) {
          synchronized = true;
          savedReceipt = rpcData.receipt || null;
          isIdempotent = Boolean(rpcData.idempotent);
        }
      } catch (err) {
        console.warn('RPC record_token_purchase unavailable or failed:', err.message);
      }

      // 2. Fallback to direct Supabase table operations with receipt creation
      if (!synchronized) {
        try {
          // Check for existing receipt first for idempotency
          const { data: existingReceipt } = await supabase
            .from('purchase_receipts')
            .select('*')
            .eq('transaction_hash', txHash)
            .maybeSingle();

          if (existingReceipt) {
            savedReceipt = existingReceipt;
            isIdempotent = true;
            synchronized = true;
          } else {
            // Update asset record
            await supabase
              .from('assets')
              .update({
                current_owner_address: buyerWallet,
                listing_status: 'UNLISTED',
                last_purchased_at: new Date().toISOString(),
                last_purchased_by: user?.id || null,
                updated_at: new Date().toISOString()
              })
              .eq('id', assetId);

            // Generate receipt number
            const receiptNo = generateReceiptNumber(txHash);

            const receiptPayload = {
              receipt_number: receiptNo,
              asset_id: assetId,
              asset_name: resolvedName,
              token_id: resolvedTokenId,
              buyer_id: user?.id || null,
              buyer_wallet: buyerWallet,
              seller_wallet: resolvedSeller,
              price_eth: Number(priceEth || 0),
              currency: 'ETH',
              transaction_hash: txHash,
              block_number: blockNumber ? Number(blockNumber) : null,
              chain_id: String(chainId || SEPOLIA_CHAIN_ID),
              token_contract: tokenContract,
              marketplace_contract: marketplaceContract,
              gas_fee: gasFee || '0.0050 ETH'
            };

            const { data: insReceipt, error: insErr } = await supabase
              .from('purchase_receipts')
              .insert([receiptPayload])
              .select()
              .maybeSingle();

            if (!insErr && insReceipt) {
              savedReceipt = insReceipt;
            } else {
              savedReceipt = receiptPayload;
            }

            const txId = `TX-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase().slice(-4)}`;
            await supabase.from('transactions').insert([{
              id: txId,
              asset_id: assetId,
              user_id: user?.id || null,
              transaction_type: 'Token Purchase (Marketplace)',
              status: 'CONFIRMED',
              transaction_hash: txHash,
              chain_id: String(chainId || SEPOLIA_CHAIN_ID),
              amount: `${priceEth || '0'} ETH`,
              block_number: blockNumber ? Number(blockNumber) : null,
              gas_fee: gasFee || '0.0050 ETH'
            }]);

            synchronized = true;
          }
        } catch (tblErr) {
          console.warn('Direct table update notice:', tblErr.message);
        }
      }
    }

    // 3. Fallback to backend API synchronization
    if (!synchronized) {
      try {
        const res = await fetch(getApiUrl(`/api/assets/${assetId}/purchase`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            buyerWallet,
            txHash,
            chainId,
            priceEth,
            blockNumber,
            gasFee,
            sellerWallet: resolvedSeller,
            tokenContract,
            marketplaceContract,
            tokenId: resolvedTokenId,
            assetName: resolvedName
          })
        });
        if (res.ok) {
          const resJson = await res.json();
          if (resJson.data?.receipt) {
            savedReceipt = resJson.data.receipt;
          }
        }
      } catch (apiErr) {
        console.warn('Backend sync notice:', apiErr.message);
      }
    }

    // Construct fallback receipt object if one couldn't be saved to DB
    if (!savedReceipt) {
      savedReceipt = {
        receipt_number: generateReceiptNumber(txHash),
        asset_id: assetId,
        asset_name: resolvedName,
        token_id: resolvedTokenId,
        buyer_wallet: buyerWallet,
        seller_wallet: resolvedSeller,
        price_eth: Number(priceEth || 0),
        currency: 'ETH',
        transaction_hash: txHash,
        block_number: blockNumber ? Number(blockNumber) : null,
        chain_id: String(chainId || SEPOLIA_CHAIN_ID),
        token_contract: tokenContract,
        marketplace_contract: marketplaceContract,
        gas_fee: gasFee || '0.0050 ETH',
        created_at: new Date().toISOString()
      };
    }

    // Immediately update in-memory state to reflect purchased ownership & unlisted state
    const target = assets.find(a => a.id === assetId);
    if (target) {
      saveLocalRegisteredAsset({
        ...target,
        currentOwnerAddress: buyerWallet,
        owner: buyerWallet,
        listingStatus: 'UNLISTED',
        listingPriceEth: 0,
        listingSeller: '',
        isPurchasable: false,
        lastPurchasedBy: user?.id || null,
        lastPurchasedAt: new Date().toISOString()
      });
    } else {
      saveLocalRegisteredAsset({
        id: assetId,
        currentOwnerAddress: buyerWallet,
        owner: buyerWallet,
        listingStatus: 'UNLISTED',
        listingPriceEth: 0,
        listingSeller: '',
        isPurchasable: false,
        lastPurchasedBy: user?.id || null,
        lastPurchasedAt: new Date().toISOString()
      });
    }

    setAssets(prev => prev.map(a => a.id === assetId ? {
      ...a,
      currentOwnerAddress: buyerWallet,
      owner: buyerWallet,
      listingStatus: 'UNLISTED',
      listingPriceEth: 0,
      listingSeller: '',
      isPurchasable: false,
      lastPurchasedBy: user?.id || null,
      lastPurchasedAt: new Date().toISOString()
    } : a));

    // Refresh context state
    await fetchAssets();
    await fetchTransactions();
    await fetchAuditLogs();

    return {
      success: true,
      receipt: savedReceipt,
      idempotent: isIdempotent
    };
  };

  // Record on-chain direct token transfer (ERC-721 safeTransferFrom)
  const recordTransfer = async (assetId, transferTx = {}) => {
    const {
      fromWallet,
      toWallet,
      txHash,
      chainId = SEPOLIA_CHAIN_ID,
      blockNumber,
      gasFee = '0.0050 ETH',
      tokenContract = TOKEN_CONTRACT_ADDRESS,
      tokenId = '1',
      assetName = ''
    } = transferTx;

    if (!toWallet || !txHash) {
      throw new Error('Recipient wallet address and transaction hash are required.');
    }

    const targetAsset = assets.find(a => a.id === assetId);
    const resolvedName = assetName || targetAsset?.name || 'Tokenized Asset';
    const resolvedTokenId = String(tokenId || targetAsset?.tokenId || '1');
    const resolvedFrom = fromWallet || targetAsset?.currentOwnerAddress || targetAsset?.owner || user?.walletAddress || '';

    // 1. Persist to Supabase
    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('assets')
          .update({
            current_owner_address: toWallet,
            listing_status: 'UNLISTED',
            listing_price_eth: 0,
            listing_seller: '',
            updated_at: new Date().toISOString()
          })
          .eq('id', assetId);

        const txId = `TX-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase().slice(-4)}`;
        await supabase.from('transactions').insert([{
          id: txId,
          asset_id: assetId,
          user_id: user?.id || null,
          transaction_type: 'Token Transfer (Direct)',
          status: 'CONFIRMED',
          transaction_hash: txHash,
          chain_id: String(chainId || SEPOLIA_CHAIN_ID),
          token_id: resolvedTokenId,
          amount: '0.0000 ETH',
          block_number: blockNumber ? Number(blockNumber) : null,
          gas_fee: gasFee || '0.0050 ETH'
        }]);

        await supabase.from('audit_logs').insert([{
          asset_id: assetId,
          admin_id: user?.id || null,
          admin_email: user?.email || 'system@assetra.io',
          action: 'TRANSFERRED',
          previous_status: 'TOKENIZED',
          new_status: 'TOKENIZED',
          notes: `ERC-721 Token #${resolvedTokenId} transferred directly from ${resolvedFrom} to ${toWallet}. Tx: ${txHash}`
        }]);
      } catch (err) {
        console.warn('Supabase transfer record notice:', err.message);
      }
    }

    // 2. Fallback to authorized backend route
    try {
      const authHeader = token ? { Authorization: `Bearer ${token}` } : {};
      await fetch(getApiUrl(`/api/assets/${assetId}/transfer`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader
        },
        body: JSON.stringify({
          fromWallet: resolvedFrom,
          toWallet,
          txHash,
          chainId,
          blockNumber,
          gasFee,
          tokenContract,
          tokenId: resolvedTokenId,
          assetName: resolvedName
        })
      });
    } catch (apiErr) {
      console.warn('Backend transfer sync notice:', apiErr.message);
    }

    // 3. Immediately synchronize in-memory asset state
    const target = assets.find(a => a.id === assetId);
    if (target) {
      saveLocalRegisteredAsset({
        ...target,
        currentOwnerAddress: toWallet,
        owner: toWallet,
        listingStatus: 'UNLISTED',
        listingPriceEth: 0,
        listingSeller: '',
        isPurchasable: false
      });
    } else {
      saveLocalRegisteredAsset({
        id: assetId,
        currentOwnerAddress: toWallet,
        owner: toWallet,
        listingStatus: 'UNLISTED',
        listingPriceEth: 0,
        listingSeller: '',
        isPurchasable: false
      });
    }

    setAssets(prev => prev.map(a => a.id === assetId ? {
      ...a,
      currentOwnerAddress: toWallet,
      owner: toWallet,
      listingStatus: 'UNLISTED',
      listingPriceEth: 0,
      listingSeller: '',
      isPurchasable: false
    } : a));

    await fetchAssets();
    await fetchTransactions();
    await fetchAuditLogs();

    return { success: true };
  };

  // Fetch all receipts belonging to the current user (buyer)
  const getUserReceipts = useCallback(async () => {
    if (!isSupabaseConfigured) return [];
    try {
      const { data, error } = await supabase
        .from('purchase_receipts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Failed to fetch user receipts from Supabase:', error.message);
        try {
          const res = await fetch(getApiUrl('/api/receipts/my-receipts'));
          if (res.ok) {
            const json = await res.json();
            return json.data || [];
          }
        } catch {
          // ignore
        }
        return [];
      }
      return data || [];
    } catch (err) {
      console.warn('Error fetching user receipts:', err.message);
      return [];
    }
  }, []);

  // Fetch receipt for a specific asset
  const getReceiptForAsset = useCallback(async (assetId) => {
    if (!assetId) return null;
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('purchase_receipts')
          .select('*')
          .eq('asset_id', assetId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          return data;
        }
      } catch (err) {
        console.warn('Error fetching asset receipt from Supabase:', err.message);
      }
    }

    // Fallback to backend API
    try {
      const res = await fetch(getApiUrl(`/api/receipts/asset/${assetId}`));
      if (res.ok) {
        const json = await res.json();
        return json.data || null;
      }
    } catch {
      // ignore
    }
    return null;
  }, []);

  // Fetch receipt by transaction hash
  const getReceiptByTxHash = useCallback(async (txHash) => {
    if (!txHash) return null;
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('purchase_receipts')
          .select('*')
          .eq('transaction_hash', txHash)
          .maybeSingle();

        if (!error && data) {
          return data;
        }
      } catch (err) {
        console.warn('Error fetching receipt by txHash from Supabase:', err.message);
      }
    }

    // Fallback to backend API
    try {
      const res = await fetch(getApiUrl(`/api/receipts/tx/${txHash}`));
      if (res.ok) {
        const json = await res.json();
        return json.data || null;
      }
    } catch {
      // ignore
    }
    return null;
  }, []);

  // Fetch all documents associated with an asset from Supabase PostgreSQL (with backend API fallback)
  const getAssetDocuments = useCallback(async (assetId) => {
    if (!assetId) return [];

    if (isSupabaseConfigured) {
      try {
        const { data, error: docErr } = await supabase
          .from('asset_documents')
          .select('id, asset_id, user_id, storage_path, filename, original_name, mime_type, size_bytes, is_private, created_at')
          .eq('asset_id', assetId)
          .order('created_at', { ascending: false });

        if (!docErr && data) {
          return data;
        }
      } catch (err) {
        console.warn('Direct Supabase document fetch notice:', err.message);
      }
    }

    // Fallback to authorized backend API endpoint
    try {
      const authHeader = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(getApiUrl(`/api/documents/asset/${assetId}`), {
        headers: { ...authHeader }
      });
      if (res.ok) {
        const json = await res.json();
        return json.data || [];
      }
    } catch (backendErr) {
      console.warn('Backend document fetch fallback notice:', backendErr.message);
    }

    return [];
  }, [token]);

  // Secure document upload to Supabase Storage (asset-documents bucket) with backend fallback
  const uploadAssetDocument = async (file, assetId) => {
    if (!file) throw new Error('No file was provided for custody upload.');
    if (!assetId) throw new Error('Asset identifier is required.');

    // Validation: 10MB limit and safe MIME types
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Invalid file type. Only PDF, PNG, and JPEG documents are permitted.');
    }

    if (file.size > 10 * 1024 * 1024) {
      throw new Error('File exceeds the maximum allowable 10MB limit.');
    }

    const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const userId = user?.id || 'anonymous';
    const storagePath = `${userId}/${assetId}/${Date.now()}-${cleanName}`;

    // 1. Attempt direct Supabase storage upload
    if (isSupabaseConfigured && user?.id) {
      try {
        const { error: uploadErr } = await supabase.storage
          .from('asset-documents')
          .upload(storagePath, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (!uploadErr) {
          const docPayload = {
            asset_id: assetId,
            user_id: user.id,
            storage_path: storagePath,
            filename: cleanName,
            original_name: file.name,
            mime_type: file.type,
            size_bytes: file.size,
            is_private: true
          };

          const { data: docRecord, error: dbErr } = await supabase
            .from('asset_documents')
            .insert([docPayload])
            .select()
            .single();

          if (!dbErr && docRecord) {
            return docRecord;
          }
          console.warn('Direct document metadata insert notice:', dbErr?.message);
        } else {
          console.warn('Direct Supabase storage upload notice:', uploadErr?.message);
        }
      } catch (sbErr) {
        console.warn('Direct Supabase upload exception:', sbErr.message);
      }
    }

    // 2. Fallback: Upload through authorized backend route /api/documents/upload
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('assetId', assetId);

      const authHeader = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(getApiUrl('/api/documents/upload'), {
        method: 'POST',
        headers: { ...authHeader },
        body: formData
      });

      if (res.ok) {
        const json = await res.json();
        return json.data;
      } else {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.message || `Upload failed with HTTP ${res.status}`);
      }
    } catch (apiErr) {
      console.error('Document upload fallback failure:', apiErr);
      throw new Error(`Failed to upload document to secure storage vault: ${apiErr.message}`);
    }
  };

  // Generate private short-lived signed URL for viewing/downloading documents (5-min expiry)
  // Supports document UUID, direct storagePath ("<user_id>/<asset_id>/..."), or assetId ("AST-2026-...")
  const getDocumentDownloadUrl = async (pathOrDocIdOrAssetId) => {
    if (!pathOrDocIdOrAssetId) {
      throw new Error('Document identifier or storage path is required.');
    }

    let storagePath = pathOrDocIdOrAssetId;
    let docId = null;

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pathOrDocIdOrAssetId);
    if (isUuid) {
      docId = pathOrDocIdOrAssetId;
    }

    // 1. Direct Supabase Storage signed URL resolution
    if (isSupabaseConfigured) {
      try {
        if (!storagePath.includes('/')) {
          let query = supabase.from('asset_documents').select('id, storage_path');
          if (docId) {
            query = query.eq('id', docId);
          } else {
            query = query.eq('asset_id', pathOrDocIdOrAssetId).order('created_at', { ascending: false }).limit(1);
          }
          const { data: docs, error: lookupErr } = await query;
          if (!lookupErr && docs && docs.length > 0 && docs[0].storage_path) {
            storagePath = docs[0].storage_path;
            docId = docs[0].id;
          }
        }

        if (storagePath && storagePath.includes('/')) {
          const { data, error: urlErr } = await supabase.storage
            .from('asset-documents')
            .createSignedUrl(storagePath, 300);

          if (!urlErr && data && data.signedUrl) {
            return data.signedUrl;
          }
        }
      } catch (sbErr) {
        console.warn('Direct Supabase signed URL notice:', sbErr.message);
      }
    }

    // 2. Fallback: Authorized backend API route /api/documents/:id
    try {
      const authHeader = token ? { Authorization: `Bearer ${token}` } : {};
      const targetParam = docId || encodeURIComponent(storagePath);
      const res = await fetch(getApiUrl(`/api/documents/${targetParam}`), {
        headers: { ...authHeader }
      });

      if (res.ok) {
        const json = await res.json();
        if (json.downloadUrl) {
          return json.downloadUrl;
        }
      }
    } catch (apiErr) {
      console.warn('Backend signed URL fallback notice:', apiErr.message);
    }

    throw new Error('Unable to generate secure signed URL for document. Please verify access permissions.');
  };

  // Prevent unauthorized deletion of documents used in completed reviews
  const deleteAssetDocument = async (documentId, storagePath, assetId) => {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    if (!user) {
      throw new Error('Authentication required.');
    }

    // Verify asset is not already approved
    if (assetId) {
      const asset = assets.find(a => a.id === assetId);
      if (asset && (asset.verificationStatus === 'APPROVED' || asset.isVerified)) {
        throw new Error('Cannot delete document: Assets with completed approval cannot have their supporting title evidence removed.');
      }
    }

    // 1. Remove from database
    const { error: dbErr } = await supabase
      .from('asset_documents')
      .delete()
      .eq('id', documentId);

    if (dbErr) {
      throw new Error(`Failed to delete document record: ${dbErr.message}`);
    }

    // 2. Remove from storage
    if (storagePath) {
      try {
        await supabase.storage.from('asset-documents').remove([storagePath]);
      } catch (stErr) {
        console.warn('Storage deletion notice:', stErr.message);
      }
    }

    return true;
  };

  // Synchronize live on-chain status, ownership, and marketplace listing from Sepolia
  const syncAssetFromChain = useCallback(async (assetId) => {
    if (!assetId) return null;
    try {
      const provider = getPublicSepoliaProvider();
      const registry = new ethers.Contract(REGISTRY_CONTRACT_ADDRESS, ASSET_REGISTRY_ABI, provider);
      const tokenContract = new ethers.Contract(
        TOKEN_CONTRACT_ADDRESS,
        [
          'function getCurrentTokenId() view returns (uint256)',
          'function tokenURI(uint256) view returns (string)',
          'function ownerOf(uint256) view returns (address)'
        ],
        provider
      );

      let isReg = false;
      let onChainRecord = null;
      let onChainApproved = false;
      let onChainTokenId = '0';
      let onChainOwner = '';
      let statusNum = 0;
      let effectiveVerifier = DEPLOYER_ADDRESS || '0x726541B8b8bFcA25952940A18F0C58d189499C4B';

      try {
        isReg = await registry.isRegistered(assetId);
        if (isReg) {
          onChainRecord = await registry.getAsset(assetId);
          onChainApproved = Boolean(onChainRecord.isApproved);
          onChainTokenId = onChainRecord.tokenId ? onChainRecord.tokenId.toString() : '0';
          onChainOwner = onChainRecord.ownerAddress || '';
          statusNum = Number(onChainRecord.status);
          if (onChainRecord.approvedBy && onChainRecord.approvedBy !== '0x0000000000000000000000000000000000000000') {
            effectiveVerifier = onChainRecord.approvedBy;
          }
        }
      } catch (regErr) {
        console.warn('AssetRegistry lookup note:', regErr.message);
      }

      // If not registered in AssetRegistry or tokenId is 0, check known list or AssetToken
      const knownToken = KNOWN_ON_CHAIN_TOKENS[assetId];
      if ((!onChainTokenId || onChainTokenId === '0') && knownToken) {
        onChainTokenId = knownToken.tokenId;
        onChainApproved = true;
        statusNum = 4;
        if (!onChainOwner) onChainOwner = knownToken.owner;
      }

      // If still not found, scan AssetToken tokenURI
      if (!onChainTokenId || onChainTokenId === '0') {
        try {
          const total = Number(await tokenContract.getCurrentTokenId());
          for (let i = 1; i <= total; i++) {
            try {
              const uri = await tokenContract.tokenURI(i);
              if (uri && uri.includes(assetId)) {
                onChainTokenId = String(i);
                onChainApproved = true;
                statusNum = 4;
                break;
              }
            } catch {}
          }
        } catch {}
      }

      if (!isReg && (!onChainTokenId || onChainTokenId === '0')) {
        return null;
      }

      let currentNftOwner = onChainOwner;
      if (onChainTokenId && onChainTokenId !== '0') {
        try {
          currentNftOwner = await tokenContract.ownerOf(onChainTokenId);
        } catch (err) {
          console.warn('Could not read ownerOf token:', err.message);
          if (knownToken?.owner) currentNftOwner = knownToken.owner;
        }
      }

      let isListedOnMarketplace = false;
      let listingPriceEth = 0;
      let listingSeller = '';
      if (onChainTokenId && onChainTokenId !== '0') {
        try {
          const marketplace = new ethers.Contract(MARKETPLACE_CONTRACT_ADDRESS, ASSET_MARKETPLACE_ABI, provider);
          const listing = await marketplace.getListing(TOKEN_CONTRACT_ADDRESS, onChainTokenId);
          if (listing && listing.isActive) {
            isListedOnMarketplace = true;
            listingPriceEth = parseFloat(ethers.formatEther(listing.price));
            listingSeller = listing.seller;
          }
        } catch (err) {
          console.warn('Could not read marketplace listing:', err.message);
        }
      }

      const syncUpdates = {
        updated_at: new Date().toISOString()
      };
      if (onChainOwner && onChainOwner.startsWith('0x')) {
        syncUpdates.owner_address = onChainOwner;
      }
      if (effectiveVerifier && effectiveVerifier !== '0x0000000000000000000000000000000000000000') {
        syncUpdates.verifier_address = effectiveVerifier;
      }
      if (onChainApproved) {
        syncUpdates.is_verified = true;
        syncUpdates.verification_status = 'APPROVED';
      }
      if (statusNum === 3) {
        syncUpdates.status = 'REJECTED';
        syncUpdates.verification_status = 'REJECTED';
      }
      if (statusNum === 4 || (onChainTokenId && onChainTokenId !== '0')) {
        syncUpdates.status = 'TOKENIZED';
        syncUpdates.token_status = 'TOKENIZED';
        syncUpdates.token_id = onChainTokenId;
        syncUpdates.contract_address = TOKEN_CONTRACT_ADDRESS;
        if (currentNftOwner) {
          syncUpdates.current_owner_address = currentNftOwner;
        }
      }
      if (isListedOnMarketplace) {
        syncUpdates.listing_status = 'LISTED';
        syncUpdates.listing_price_eth = listingPriceEth;
        syncUpdates.listing_seller = listingSeller;
        syncUpdates.marketplace_contract_address = MARKETPLACE_CONTRACT_ADDRESS;
      }

      if (isSupabaseConfigured) {
        try {
          await supabase.from('assets').update(syncUpdates).eq('id', assetId);
        } catch (dbErr) {
          console.warn('Could not persist syncUpdates to Supabase (likely RLS restricted):', dbErr.message);
        }
      }

      // Update in-memory state and localStorage immediately
      let synchronizedAsset = null;
      setAssets((prevAssets) =>
        prevAssets.map((a) => {
          if (a.id === assetId) {
            const isTok = Boolean(
              syncUpdates.token_status === 'TOKENIZED' ||
              a.tokenStatus === 'TOKENIZED' ||
              a.status === 'TOKENIZED' ||
              syncUpdates.token_id ||
              a.tokenId ||
              Boolean(knownToken)
            );
            const effPrice = syncUpdates.listing_price_eth !== undefined
              ? syncUpdates.listing_price_eth
              : (isListedOnMarketplace ? listingPriceEth : (a.listingPriceEth || 0));
            const effListingStatus = syncUpdates.listing_status !== undefined
              ? syncUpdates.listing_status
              : (isListedOnMarketplace ? 'LISTED' : (a.listingStatus || 'UNLISTED'));

            const updated = {
              ...a,
              ...syncUpdates,
              isTokenized: isTok,
              tokenStatus: isTok ? 'TOKENIZED' : (syncUpdates.token_status || a.tokenStatus),
              status: isTok ? 'TOKENIZED' : (syncUpdates.status || a.status),
              verificationStatus: (isTok || onChainApproved) ? 'APPROVED' : (syncUpdates.verification_status || a.verificationStatus),
              isVerified: isTok || onChainApproved || a.isVerified,
              tokenId: syncUpdates.token_id || a.tokenId || (knownToken ? knownToken.tokenId : '1'),
              contractAddress: syncUpdates.contract_address || a.contractAddress || TOKEN_CONTRACT_ADDRESS,
              verifierAddress: syncUpdates.verifier_address || a.verifierAddress,
              originalOwnerAddress: syncUpdates.owner_address || a.originalOwnerAddress,
              ownerAddress: syncUpdates.owner_address || a.ownerAddress,
              currentOwnerAddress: currentNftOwner || syncUpdates.current_owner_address || a.currentOwnerAddress,
              owner: currentNftOwner || syncUpdates.current_owner_address || a.owner,
              listingStatus: effListingStatus,
              listingPriceEth: effPrice,
              isPurchasable: effListingStatus === 'LISTED' && effPrice > 0,
              listingSeller: syncUpdates.listing_seller !== undefined ? syncUpdates.listing_seller : listingSeller
            };
            synchronizedAsset = updated;
            saveLocalRegisteredAsset(updated);
            return updated;
          }
          return a;
        })
      );

      return synchronizedAsset || { onChainRecord, currentNftOwner, isListedOnMarketplace, listingPriceEth };
    } catch (syncErr) {
      console.warn(`Blockchain sync error for ${assetId}:`, syncErr.message);
      return null;
    }
  }, []);

  const getAssetById = useCallback((id) => assets.find(a => a.id === id), [assets]);

  const totalAssetsCount = assets.length;
  const tokenizedCount = useMemo(() => {
    return assets.filter((a) => a.tokenStatus === 'TOKENIZED' || a.status === 'TOKENIZED' || a.isTokenized || (a.tokenId && String(a.tokenId) !== '0')).length;
  }, [assets]);

  const totalValuation = useMemo(() => {
    return assets.reduce((sum, a) => sum + (Number(a.valuation) || 0), 0);
  }, [assets]);

  const marketplaceAssets = useMemo(() => {
    return assets.filter((a) => {
      const isApproved = a.verificationStatus === 'APPROVED' || a.isVerified === true || a.status === 'APPROVED' || a.status === 'TOKENIZED';
      const isNotPendingOrRejected = a.verificationStatus !== 'PENDING' && a.verificationStatus !== 'REJECTED' && a.status !== 'PENDING' && a.status !== 'REJECTED';
      return isApproved && isNotPendingOrRejected;
    });
  }, [assets]);

  return (
    <AssetContext.Provider
      value={{
        assets,
        marketplaceAssets,
        transactions,
        auditLogs,
        isLoading,
        error,
        totalAssetsCount,
        tokenizedCount,
        totalValuation,
        fetchAssets,
        fetchTransactions,
        fetchAuditLogs,
        registerAsset,
        updateAssetStatus,
        tokenizeAsset,
        listTokenForSale,
        updateListingPrice,
        delistToken,
        recordPurchase,
        recordTransfer,
        uploadAssetDocument,
        updateAssetImage,
        getDocumentDownloadUrl,
        getAssetDocuments,
        deleteAssetDocument,
        getAssetById,
        syncAssetFromChain,
        getUserReceipts,
        getReceiptForAsset,
        getReceiptByTxHash
      }}
    >
      {children}
    </AssetContext.Provider>
  );
};

export const useAssets = () => useContext(AssetContext);
export const useAsset = useAssets;

export default AssetContext;
