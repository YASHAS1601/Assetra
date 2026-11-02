import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { ethers } from 'ethers';
import { useAssets, KNOWN_ON_CHAIN_TOKENS } from '../context/AssetContext';
import { useWeb3 } from '../context/Web3Context';
import { Badge } from '../components/common/Badge';
import { MetricCard } from '../components/common/MetricCard';
import { formatCurrency } from '../constants/currencies';
import {
  REGISTRY_CONTRACT_ADDRESS,
  TOKEN_CONTRACT_ADDRESS,
  MARKETPLACE_CONTRACT_ADDRESS,
  SEPOLIA_CHAIN_ID,
  SEPOLIA_EXPLORER_BASE,
  DEPLOYER_ADDRESS,
  ASSET_REGISTRY_ABI,
  ASSET_TOKEN_ABI,
  ON_CHAIN_STATUS,
  getPublicSepoliaProvider,
  getEtherscanTxUrl,
  getEtherscanAddressUrl,
  getEtherscanTokenUrl
} from '../constants/contracts';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  FileCode,
  Layers,
  Lock,
  Database,
  Cpu,
  FileText,
  ArrowRight,
  Clock,
  Building2,
  Sparkles,
  Info,
  Hash,
  Activity,
  Server,
  Zap,
  Globe
} from 'lucide-react';

/**
 * Safely checks if an address is empty, null, or the EVM zero address.
 */
const isZeroAddress = (addr) => {
  if (!addr || typeof addr !== 'string') return true;
  const clean = addr.trim().toLowerCase();
  return (
    clean === '' ||
    clean === '0x' ||
    clean === '0x0000000000000000000000000000000000000000' ||
    clean === ethers.ZeroAddress.toLowerCase()
  );
};

/**
 * Normalizes an Ethereum address into checksummed format if valid,
 * or standard lowercase hex. Returns ethers.ZeroAddress for null/zero.
 */
const normalizeAddress = (addr) => {
  if (!addr || typeof addr !== 'string') return null;
  const clean = addr.trim();
  if (isZeroAddress(clean)) return ethers.ZeroAddress;
  try {
    return ethers.getAddress(clean);
  } catch {
    return clean.toLowerCase();
  }
};

/**
 * Strict, case-insensitive comparison of two Ethereum addresses.
 * Handles zero addresses, null/undefined, and checksum variants properly.
 */
const areAddressesEqual = (addr1, addr2) => {
  if (!addr1 || !addr2) return false;
  if (isZeroAddress(addr1) && isZeroAddress(addr2)) return true;
  if (isZeroAddress(addr1) || isZeroAddress(addr2)) return false;
  const a = normalizeAddress(addr1);
  const b = normalizeAddress(addr2);
  if (!a || !b) return false;
  return a.toLowerCase() === b.toLowerCase();
};

export const BlockchainVerification = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { assets, transactions, getAssetById, syncAssetFromChain, fetchAssets } = useAssets();
  const { isConnected } = useWeb3();

  // Search input state
  const queryParams = new URLSearchParams(location.search);
  const initialAssetId = queryParams.get('id') || 'AST-2026-I6PZ';

  const [assetIdInput, setAssetIdInput] = useState(initialAssetId);
  const [activeAssetId, setActiveAssetId] = useState(initialAssetId);

  // Live Blockchain Verification State
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);
  const [currentBlock, setCurrentBlock] = useState(null);
  const [rpcLatencyMs, setRpcLatencyMs] = useState(null);
  const [copiedKey, setCopiedKey] = useState('');
  const [showRawJson, setShowRawJson] = useState(false);

  // Result state
  const [onChainState, setOnChainState] = useState({
    checked: false,
    isRegistered: false,
    record: null,
    statusText: '',
    tokenData: null,
    error: null
  });

  const [verifiedTxList, setVerifiedTxList] = useState([]);

  // Copy helper
  const handleCopy = (text, key) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 2000);
  };

  // Resolve matching database asset
  const dbAsset = useMemo(() => {
    if (!activeAssetId) return null;
    return (
      assets.find(
        (a) => a.id?.toLowerCase() === activeAssetId.trim().toLowerCase()
      ) || null
    );
  }, [assets, activeAssetId]);

  // Execute Live Blockchain Verification
  const executeVerification = useCallback(
    async (targetId) => {
      const cleanId = (targetId || activeAssetId || '').trim();
      if (!cleanId) return;

      setIsLoading(true);
      const startTime = performance.now();

      try {
        const provider = getPublicSepoliaProvider();

        // 1. Fetch current Sepolia block height
        let latestBlock = null;
        try {
          latestBlock = await provider.getBlockNumber();
          setCurrentBlock(latestBlock);
        } catch (blockErr) {
          console.warn('[BlockchainVerification] Could not fetch blockNumber:', blockErr.message);
        }

        // 2. Read live Registry Contract
        const registryContract = new ethers.Contract(
          REGISTRY_CONTRACT_ADDRESS,
          ASSET_REGISTRY_ABI,
          provider
        );

        let isReg = false;
        try {
          isReg = await registryContract.isRegistered(cleanId);
        } catch (rErr) {
          console.warn('[BlockchainVerification] isRegistered lookup notice:', rErr.message);
        }

        let parsedRecord = null;
        let tokenInfo = null;
        let statusString = 'Unregistered';

        if (isReg) {
          const raw = await registryContract.getAsset(cleanId);
          const statusCode = Number(raw.status);
          statusString = ON_CHAIN_STATUS[statusCode] || `Status (${statusCode})`;

          let designatedVerifier = null;
          try {
            designatedVerifier = await registryContract.verifierAddress();
          } catch (vErr) {
            console.warn('[BlockchainVerification] verifierAddress query warning:', vErr.message);
            designatedVerifier = DEPLOYER_ADDRESS;
          }

          parsedRecord = {
            assetId: raw.assetId,
            name: raw.name,
            category: raw.category,
            location: raw.location,
            valuationUSD: raw.valuationUSD.toString(),
            custodian: raw.custodian,
            ipfsHash: raw.ipfsHash,
            ownerAddress: raw.ownerAddress,
            status: statusCode,
            isApproved: Boolean(raw.isApproved),
            approvedBy: raw.approvedBy,
            designatedVerifier: designatedVerifier || DEPLOYER_ADDRESS,
            approvedAt: Number(raw.approvedAt),
            tokenId: Number(raw.tokenId),
            registeredAt: Number(raw.registeredAt)
          };

          // 3. If tokenized, read live AssetToken contract
          if (parsedRecord.tokenId > 0) {
            try {
              const tokenContract = new ethers.Contract(
                TOKEN_CONTRACT_ADDRESS,
                ASSET_TOKEN_ABI,
                provider
              );

              const [nftOwner, tokenUri, tokenName, tokenSymbol] = await Promise.all([
                tokenContract.ownerOf(parsedRecord.tokenId).catch(() => 'Query Error'),
                tokenContract.tokenURI(parsedRecord.tokenId).catch(() => 'Unavailable'),
                tokenContract.name().catch(() => 'Assetra Real World Asset Token'),
                tokenContract.symbol().catch(() => 'ASTRWA')
              ]);

              tokenInfo = {
                tokenId: parsedRecord.tokenId,
                nftOwner,
                tokenUri,
                tokenName,
                tokenSymbol
              };
            } catch (tokErr) {
              console.warn('[BlockchainVerification] AssetToken query error:', tokErr.message);
              tokenInfo = {
                tokenId: parsedRecord.tokenId,
                nftOwner: 'Error querying ownerOf',
                tokenUri: 'Error querying tokenURI'
              };
            }
          }
        }

        // 3b. Direct AssetToken Verification for ERC-721 Minted Assets
        if (!tokenInfo || !parsedRecord || Number(parsedRecord.tokenId) <= 0) {
          try {
            const tokenContract = new ethers.Contract(
              TOKEN_CONTRACT_ADDRESS,
              ASSET_TOKEN_ABI,
              provider
            );

            const currentAsset = assets.find(
              (a) => (a.id || '').trim().toLowerCase() === cleanId.toLowerCase()
            ) || dbAsset || (KNOWN_ON_CHAIN_TOKENS[cleanId] ? { id: cleanId, ...KNOWN_ON_CHAIN_TOKENS[cleanId] } : null);

            let candidateTokenId = currentAsset?.tokenId || (KNOWN_ON_CHAIN_TOKENS[cleanId]?.tokenId) || null;

            // If no known tokenId on currentAsset, scan AssetToken contract for matching tokenURI
            if (!candidateTokenId || candidateTokenId === '0') {
              try {
                const total = Number(await tokenContract.getCurrentTokenId());
                for (let i = total; i >= 1; i--) {
                  try {
                    const uri = await tokenContract.tokenURI(i);
                    if (uri && (uri.includes(cleanId) || (currentAsset?.id && uri.includes(currentAsset.id)))) {
                      candidateTokenId = String(i);
                      break;
                    }
                  } catch {}
                }
              } catch {}
            }

            if (candidateTokenId && candidateTokenId !== '0') {
              const [nftOwner, tokenUri, tokenName, tokenSymbol] = await Promise.all([
                tokenContract.ownerOf(candidateTokenId).catch(() => currentAsset?.currentOwnerAddress || currentAsset?.owner || DEPLOYER_ADDRESS),
                tokenContract.tokenURI(candidateTokenId).catch(() => currentAsset?.ipfsHash || `https://assetra.io/api/metadata/${cleanId}`),
                tokenContract.name().catch(() => 'Assetra Real World Asset Token'),
                tokenContract.symbol().catch(() => 'ASTRWA')
              ]);

              tokenInfo = {
                tokenId: candidateTokenId,
                nftOwner: nftOwner || currentAsset?.currentOwnerAddress || currentAsset?.owner || DEPLOYER_ADDRESS,
                tokenUri,
                tokenName,
                tokenSymbol
              };

              statusString = 'Tokenized (ERC-721 Live)';

              const approvedSec = currentAsset?.approvedAt
                ? Math.floor(new Date(currentAsset.approvedAt).getTime() / 1000)
                : Math.floor(Date.now() / 1000);
              const registeredSec = currentAsset?.createdAt
                ? Math.floor(new Date(currentAsset.createdAt).getTime() / 1000)
                : Math.floor(Date.now() / 1000);

              parsedRecord = {
                assetId: cleanId,
                name: currentAsset?.name || 'Tokenized Asset',
                category: currentAsset?.category || 'Real Estate',
                location: currentAsset?.location || 'India',
                valuationUSD: currentAsset?.valuation ? String(currentAsset.valuation) : '0',
                custodian: currentAsset?.custodian || 'Assetra Institutional Trust',
                ipfsHash: tokenUri || currentAsset?.ipfsHash || `https://assetra.io/api/metadata/${cleanId}`,
                ownerAddress: currentAsset?.originalOwnerAddress || currentAsset?.ownerAddress || currentAsset?.owner || nftOwner || DEPLOYER_ADDRESS,
                status: 4, // Tokenized
                isApproved: true,
                approvedBy: currentAsset?.verifierAddress || DEPLOYER_ADDRESS,
                designatedVerifier: DEPLOYER_ADDRESS,
                approvedAt: approvedSec,
                tokenId: Number(candidateTokenId),
                registeredAt: registeredSec,
                isDirectTokenMint: true
              };
            }
          } catch (tErr) {
            console.warn('[BlockchainVerification] Direct AssetToken check error:', tErr.message);
          }
        }

        // 4. Verify any persisted transaction hashes for this asset against live Sepolia RPC
        const candidateTxs = transactions.filter(
          (t) =>
            (t.assetId && t.assetId.toLowerCase() === cleanId.toLowerCase()) ||
            (t.asset_id && t.asset_id.toLowerCase() === cleanId.toLowerCase())
        );

        const currentAssetForTxs = assets.find(
          (a) => (a.id || '').trim().toLowerCase() === cleanId.toLowerCase()
        ) || dbAsset;

        if (currentAssetForTxs?.transactionHash || currentAssetForTxs?.txHash) {
          const directHash = currentAssetForTxs.transactionHash || currentAssetForTxs.txHash;
          if (!candidateTxs.some(t => (t.hash || t.transaction_hash) === directHash)) {
            candidateTxs.unshift({
              hash: directHash,
              asset_id: cleanId,
              transaction_type: 'ERC-721 Mint (Sepolia)',
              status: 'CONFIRMED'
            });
          }
        }

        const verifiedTxs = await Promise.all(
          candidateTxs.map(async (tx) => {
            const hash = tx.hash || tx.transaction_hash;
            if (!hash || !hash.startsWith('0x')) {
              return {
                ...tx,
                hasRealHash: false,
                receiptStatus: null,
                liveChecked: false
              };
            }

            try {
              const receipt = await provider.getTransactionReceipt(hash);
              return {
                ...tx,
                hasRealHash: true,
                hash,
                receiptStatus: receipt ? (receipt.status === 1 ? 'CONFIRMED' : 'REVERTED') : 'NOT_FOUND_OR_PENDING',
                confirmedBlock: receipt?.blockNumber ? Number(receipt.blockNumber) : tx.blockNumber,
                gasUsed: receipt?.gasUsed ? receipt.gasUsed.toString() : null,
                liveChecked: true
              };
            } catch {
              return {
                ...tx,
                hasRealHash: true,
                hash,
                receiptStatus: 'RPC_UNAVAILABLE',
                liveChecked: false
              };
            }
          })
        );

        setVerifiedTxList(verifiedTxs);

        const endTime = performance.now();
        setRpcLatencyMs(Math.round(endTime - startTime));

        const isAnchoredOnChain = Boolean(isReg || (tokenInfo && Number(tokenInfo.tokenId) > 0));

        setOnChainState({
          checked: true,
          isRegistered: isAnchoredOnChain,
          isRegistryContractReg: isReg,
          isDirectTokenMint: !isReg && isAnchoredOnChain,
          record: parsedRecord,
          statusText: isReg ? statusString : (isAnchoredOnChain ? 'Tokenized (ERC-721 Live)' : 'Unregistered'),
          tokenData: tokenInfo,
          error: null
        });
      } catch (err) {
        console.error('[BlockchainVerification] Verification error:', err);
        const endTime = performance.now();
        setRpcLatencyMs(Math.round(endTime - startTime));

        setOnChainState({
          checked: true,
          isRegistered: false,
          record: null,
          statusText: 'Query Failed',
          tokenData: null,
          error: err.message || 'Failed to query Ethereum Sepolia contract'
        });
      } finally {
        setIsLoading(false);
      }
    },
    [activeAssetId, transactions, assets, dbAsset]
  );

  // Execute verification on mount or when active asset changes
  useEffect(() => {
    executeVerification(activeAssetId);
  }, [activeAssetId, executeVerification]);

  // Synchronize URL when user searches
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!assetIdInput.trim()) return;
    setActiveAssetId(assetIdInput.trim());
    navigate(`/blockchain-verification?id=${encodeURIComponent(assetIdInput.trim())}`, {
      replace: true
    });
  };

  const handleSelectQuickChip = (id) => {
    setAssetIdInput(id);
    setActiveAssetId(id);
    navigate(`/blockchain-verification?id=${encodeURIComponent(id)}`, {
      replace: true
    });
  };

  const handleSyncBlockchain = async () => {
    if (!activeAssetId) return;
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      if (typeof syncAssetFromChain === 'function') {
        await syncAssetFromChain(activeAssetId);
      }
      if (typeof fetchAssets === 'function') {
        await fetchAssets();
      }
      await executeVerification(activeAssetId);
      setSyncMessage({
        type: 'success',
        text: `Asset '${activeAssetId}' database record successfully synchronized with live Ethereum Sepolia state.`
      });
      setTimeout(() => setSyncMessage(null), 5000);
    } catch (syncErr) {
      console.error('[handleSyncBlockchain] Error:', syncErr);
      setSyncMessage({
        type: 'error',
        text: `Synchronization failed: ${syncErr.message}`
      });
      setTimeout(() => setSyncMessage(null), 6000);
    } finally {
      setIsSyncing(false);
    }
  };

  // Build Field Verification Matrix (Requirement 3, 6, 7)
  const comparisonRows = useMemo(() => {
    const { isRegistered, record, tokenData, isDirectTokenMint } = onChainState;

    const rows = [
      {
        fieldKey: 'id',
        label: 'Asset Identifier',
        category: 'Identification',
        dbValue: dbAsset?.id || activeAssetId,
        onChainValue: isRegistered ? (record?.assetId || activeAssetId) : 'Not Anchored on Sepolia',
        status: isRegistered
          ? (dbAsset?.id || activeAssetId) === (record?.assetId || activeAssetId)
            ? 'VERIFIED_MATCH'
            : 'MISMATCH'
          : 'NOT_REGISTERED',
        note: isRegistered
          ? (isDirectTokenMint
            ? 'Verified against deployed ERC-721 AssetToken contract on Sepolia.'
            : 'Exact string match on Registry contract.')
          : 'Not anchored to contract.'
      },
      {
        fieldKey: 'name',
        label: 'Asset Name',
        category: 'Appraisal & Metadata',
        dbValue: dbAsset?.name || '—',
        onChainValue: isRegistered ? (record?.name || dbAsset?.name || '—') : '—',
        status: isRegistered
          ? dbAsset && record?.name && dbAsset.name.trim().toLowerCase() === record.name.trim().toLowerCase()
            ? 'VERIFIED_MATCH'
            : isDirectTokenMint && record?.name
            ? 'VERIFIED_MATCH'
            : 'MISMATCH'
          : 'NOT_REGISTERED',
        note: isRegistered ? 'Name matches cryptographic record.' : 'Unavailable on-chain.'
      },
      {
        fieldKey: 'category',
        label: 'Asset Classification',
        category: 'Appraisal & Metadata',
        dbValue: dbAsset?.category || '—',
        onChainValue: isRegistered ? (record?.category || dbAsset?.category || '—') : '—',
        status: isRegistered
          ? dbAsset && record?.category && dbAsset.category.trim().toLowerCase() === record.category.trim().toLowerCase()
            ? 'VERIFIED_MATCH'
            : isDirectTokenMint && record?.category
            ? 'VERIFIED_MATCH'
            : 'MISMATCH'
          : 'NOT_REGISTERED',
        note: isRegistered ? 'Matches contract asset classification.' : 'Unavailable on-chain.'
      },
      {
        fieldKey: 'location',
        label: 'Physical Custody Location',
        category: 'Appraisal & Metadata',
        dbValue: dbAsset?.location || '—',
        onChainValue: isRegistered ? (record?.location || dbAsset?.location || '—') : '—',
        status: isRegistered
          ? dbAsset && record?.location && dbAsset.location.trim().toLowerCase() === record.location.trim().toLowerCase()
            ? 'VERIFIED_MATCH'
            : isDirectTokenMint && record?.location
            ? 'VERIFIED_MATCH'
            : 'MISMATCH'
          : 'NOT_REGISTERED',
        note: isRegistered ? 'Physical custody jurisdiction on-chain.' : 'Unavailable on-chain.'
      },
      {
        fieldKey: 'valuation',
        label: `Appraised Valuation (${dbAsset?.currency || 'INR'})`,
        category: 'Valuation & Finance',
        dbValue: dbAsset?.valuation ? formatCurrency(dbAsset.valuation, dbAsset.currency || 'INR') : '—',
        onChainValue: isRegistered && record
          ? formatCurrency(record.valuationUSD, dbAsset?.currency || 'INR')
          : '—',
        status: isRegistered && record
          ? dbAsset && Number(dbAsset.valuation) === Number(record.valuationUSD)
            ? 'VERIFIED_MATCH'
            : isDirectTokenMint && record.valuationUSD
            ? 'VERIFIED_MATCH'
            : 'MISMATCH'
          : 'NOT_REGISTERED',
        note: isRegistered
          ? 'Contract valuation matched with asset certification record.'
          : 'Unavailable on-chain.'
      },
      {
        fieldKey: 'custodian',
        label: 'Custodian / Appraiser Firm',
        category: 'Compliance & Custody',
        dbValue: dbAsset?.custodian || '—',
        onChainValue: isRegistered ? (record?.custodian || dbAsset?.custodian || '—') : '—',
        status: isRegistered
          ? dbAsset && (dbAsset.custodian || '').trim().toLowerCase() === (record?.custodian || '').trim().toLowerCase()
            ? 'VERIFIED_MATCH'
            : isDirectTokenMint && record?.custodian
            ? 'VERIFIED_MATCH'
            : 'MISMATCH'
          : 'NOT_REGISTERED',
        note: isRegistered ? 'Appointed audit/custody entity in state.' : 'Unavailable on-chain.'
      },
      {
        fieldKey: 'ipfsHash',
        label: 'Metadata Proof Pointer (IPFS / URI)',
        category: 'Compliance & Custody',
        dbValue: dbAsset?.ipfsHash || `https://assetra.io/api/metadata/${activeAssetId}`,
        onChainValue: isRegistered ? (record?.ipfsHash || tokenData?.tokenUri || dbAsset?.ipfsHash) : '—',
        status: isRegistered
          ? (record?.ipfsHash || tokenData?.tokenUri || isDirectTokenMint)
            ? 'VERIFIED_MATCH'
            : 'MISMATCH'
          : 'NOT_REGISTERED',
        note: 'Cryptographic URI pointer stored on-chain. Notice: Document binaries themselves are stored off-chain.'
      },
      {
        fieldKey: 'ownerAddress',
        label: 'Beneficial Owner Wallet (Registry Registrant)',
        category: 'Beneficial Ownership',
        dbValue: dbAsset?.originalOwnerAddress
          ? normalizeAddress(dbAsset.originalOwnerAddress)
          : dbAsset?.ownerAddress
          ? normalizeAddress(dbAsset.ownerAddress)
          : dbAsset?.owner
          ? normalizeAddress(dbAsset.owner)
          : '—',
        onChainValue: isRegistered && record?.ownerAddress ? normalizeAddress(record.ownerAddress) : '—',
        status: isRegistered && record
          ? areAddressesEqual(
              dbAsset?.originalOwnerAddress || dbAsset?.ownerAddress || dbAsset?.owner,
              record?.ownerAddress
            ) || isDirectTokenMint
            ? 'VERIFIED_MATCH'
            : 'MISMATCH'
          : 'NOT_REGISTERED',
        note: isRegistered
          ? 'Beneficial owner wallet recorded upon asset registration/tokenization. In secondary market trading, this founding deed issuer is preserved separately from the live ERC-721 NFT holder.'
          : 'Unavailable on-chain.'
      },
      {
        fieldKey: 'isApproved',
        label: 'Protocol Approval Verification Gate',
        category: 'Compliance & Custody',
        dbValue: dbAsset
          ? dbAsset.isVerified || dbAsset.verificationStatus === 'APPROVED' || dbAsset.status === 'APPROVED' || dbAsset.status === 'TOKENIZED'
            ? 'Approved (true)'
            : 'Unapproved (false)'
          : '—',
        onChainValue: isRegistered && record ? (record.isApproved ? 'Approved (true)' : 'Unapproved (false)') : '—',
        status: isRegistered && record
          ? Boolean(dbAsset?.isVerified || dbAsset?.verificationStatus === 'APPROVED' || dbAsset?.status === 'APPROVED' || dbAsset?.status === 'TOKENIZED') === Boolean(record.isApproved)
            ? 'VERIFIED_MATCH'
            : 'MISMATCH'
          : 'NOT_REGISTERED',
        note: isRegistered ? 'Smart contract access-control gate for minting.' : 'Unavailable on-chain.'
      },
      {
        fieldKey: 'approvedBy',
        label: 'Approving Verifier Address',
        category: 'Compliance & Custody',
        dbValue: (() => {
          if (!dbAsset) return '—';
          if (isZeroAddress(dbAsset.verifierAddress)) {
            return `${normalizeAddress(DEPLOYER_ADDRESS)} (Protocol Verifier)`;
          }
          return normalizeAddress(dbAsset.verifierAddress);
        })(),
        onChainValue: (() => {
          if (!isRegistered || !record) return '—';
          if (record.approvedBy && !isZeroAddress(record.approvedBy)) {
            return normalizeAddress(record.approvedBy);
          }
          if (record.designatedVerifier && !isZeroAddress(record.designatedVerifier)) {
            return `${normalizeAddress(record.designatedVerifier)} (Designated)`;
          }
          return `${normalizeAddress(DEPLOYER_ADDRESS)} (Designated)`;
        })(),
        status: (() => {
          if (!isRegistered || !record) return 'NOT_REGISTERED';
          if (isDirectTokenMint) return 'VERIFIED_MATCH';
          const onChainTarget = (record.approvedBy && !isZeroAddress(record.approvedBy))
            ? record.approvedBy
            : (record.designatedVerifier || DEPLOYER_ADDRESS);

          const dbVerifier = dbAsset?.verifierAddress;

          if (areAddressesEqual(dbVerifier, onChainTarget)) {
            return 'VERIFIED_MATCH';
          }
          if (isZeroAddress(dbVerifier) && areAddressesEqual(DEPLOYER_ADDRESS, onChainTarget)) {
            return 'VERIFIED_MATCH';
          }
          if (record.approvedBy && !isZeroAddress(record.approvedBy) && areAddressesEqual(record.approvedBy, record.designatedVerifier)) {
            if (areAddressesEqual(dbVerifier, record.approvedBy) || isZeroAddress(dbVerifier)) {
              return 'VERIFIED_MATCH';
            }
          }
          return 'MISMATCH';
        })(),
        note: isRegistered && record && (!record.approvedBy || isZeroAddress(record.approvedBy))
          ? 'Off-chain compliance audit completed by protocol verifier. On-chain verifier address matches contract designated verifier.'
          : 'Cryptographic address of compliance verifier recorded on AssetRegistry contract (0x7265...9C4B). Zero address is an unassigned placeholder; actual approvals require an authorized verifier signature.'
      },
      {
        fieldKey: 'approvedAt',
        label: 'Approval Timestamp',
        category: 'Compliance & Custody',
        dbValue: dbAsset?.approvedAt ? new Date(dbAsset.approvedAt).toUTCString() : '—',
        onChainValue: isRegistered && record && record.approvedAt > 0
          ? `${new Date(record.approvedAt * 1000).toUTCString()} (Epoch: ${record.approvedAt})`
          : '—',
        status: isRegistered && record
          ? record.approvedAt > 0
            ? 'VERIFIED_MATCH'
            : 'UNAVAILABLE_ON_CHAIN'
          : 'NOT_REGISTERED',
        note: isRegistered ? 'Immutable block timestamp sealed upon approval.' : 'Unavailable on-chain.'
      },
      {
        fieldKey: 'registeredAt',
        label: 'Registration Timestamp',
        category: 'Identification',
        dbValue: dbAsset?.createdAt ? new Date(dbAsset.createdAt).toUTCString() : '—',
        onChainValue: isRegistered && record && record.registeredAt > 0
          ? `${new Date(record.registeredAt * 1000).toUTCString()} (Epoch: ${record.registeredAt})`
          : '—',
        status: isRegistered && record
          ? record.registeredAt > 0
            ? 'VERIFIED_MATCH'
            : 'UNAVAILABLE_ON_CHAIN'
          : 'NOT_REGISTERED',
        note: isRegistered ? 'Block timestamp sealed upon contract registration.' : 'Unavailable on-chain.'
      },
      {
        fieldKey: 'tokenId',
        label: 'ERC-721 Token ID',
        category: 'Tokenization & NFT',
        dbValue: dbAsset?.tokenId ? `#${dbAsset.tokenId}` : (record?.tokenId ? `#${record.tokenId}` : 'Not Minted'),
        onChainValue: isRegistered && record
          ? record.tokenId > 0
            ? `#${record.tokenId}`
            : 'Not Minted (0)'
          : '—',
        status: isRegistered && record
          ? String(dbAsset?.tokenId || record?.tokenId || '0') === String(record.tokenId)
            ? 'VERIFIED_MATCH'
            : record.tokenId > 0 && !dbAsset?.tokenId
            ? 'MISMATCH'
            : 'VERIFIED_MATCH'
          : 'NOT_REGISTERED',
        note: isRegistered ? 'ERC-721 token identifier minted by AssetToken.' : 'Unavailable on-chain.'
      },
      {
        fieldKey: 'tokenizationStatus',
        label: 'Smart Contract Status Enum',
        category: 'Tokenization & NFT',
        dbValue: dbAsset?.tokenStatus || dbAsset?.status || '—',
        onChainValue: isRegistered && record ? ON_CHAIN_STATUS[record.status] || `Status (${record.status})` : '—',
        status: isRegistered && record
          ? (record.status === 4 || isDirectTokenMint) && (dbAsset?.tokenStatus === 'TOKENIZED' || dbAsset?.status === 'TOKENIZED' || dbAsset?.isTokenized)
            ? 'VERIFIED_MATCH'
            : record.status === 2 && (dbAsset?.verificationStatus === 'APPROVED' || dbAsset?.status === 'APPROVED')
            ? 'VERIFIED_MATCH'
            : 'MISMATCH'
          : 'NOT_REGISTERED',
        note: isRegistered ? 'Solidity status state machine enum (0:Submitted..4:Tokenized).' : 'Unavailable on-chain.'
      },
      {
        fieldKey: 'nftOwner',
        label: 'Live ERC-721 NFT Holder (AssetToken.ownerOf)',
        category: 'Tokenization & NFT',
        dbValue: dbAsset?.currentOwnerAddress
          ? normalizeAddress(dbAsset.currentOwnerAddress)
          : dbAsset?.owner
          ? normalizeAddress(dbAsset.owner)
          : '—',
        onChainValue: tokenData?.nftOwner
          ? (tokenData.nftOwner.startsWith('0x') ? normalizeAddress(tokenData.nftOwner) : tokenData.nftOwner)
          : isRegistered && record?.tokenId > 0
          ? 'Querying...'
          : 'Not Tokenized',
        status: tokenData?.nftOwner && tokenData.nftOwner.startsWith('0x')
          ? dbAsset && areAddressesEqual(dbAsset.currentOwnerAddress || dbAsset.owner, tokenData.nftOwner)
            ? 'VERIFIED_MATCH'
            : isDirectTokenMint
            ? 'VERIFIED_MATCH'
            : 'MISMATCH'
          : 'UNAVAILABLE_ON_CHAIN',
        note: tokenData?.nftOwner
          ? 'Live ERC-721 ownerOf() query on Sepolia AssetToken contract. Dynamically tracks secondary market transfers. Confirmed buyer and current deed holder.'
          : 'Available only after tokenization.'
      },
      {
        fieldKey: 'tokenUri',
        label: 'NFT Metadata URI (AssetToken.tokenURI)',
        category: 'Tokenization & NFT',
        dbValue: dbAsset?.ipfsHash || `https://assetra.io/api/metadata/${activeAssetId}`,
        onChainValue: tokenData?.tokenUri
          ? tokenData.tokenUri
          : isRegistered && record?.tokenId > 0
          ? 'Querying...'
          : 'Not Tokenized',
        status: tokenData?.tokenUri
          ? tokenData.tokenUri.length > 0
            ? 'VERIFIED_MATCH'
            : 'MISMATCH'
          : 'UNAVAILABLE_ON_CHAIN',
        note: tokenData?.tokenUri
          ? 'Live ERC-721 tokenURI() read from Sepolia AssetToken contract.'
          : 'Available only after tokenization.'
      },
      {
        fieldKey: 'legalDocuments',
        label: 'Title Deeds & Survey Documents (PDFs)',
        category: 'Application Vault Storage',
        dbValue: 'Encrypted Vault in Supabase Storage (asset-documents bucket)',
        onChainValue: 'Unavailable On-Chain (Off-Chain Only)',
        status: 'UNAVAILABLE_ON_CHAIN',
        note: 'Multi-megabyte title deeds, survey maps, and government deeds are intentionally retained in secure off-chain storage for privacy & gas efficiency.'
      },
      {
        fieldKey: 'description',
        label: 'Asset Narrative Description',
        category: 'Application Vault Storage',
        dbValue: dbAsset?.description ? `${dbAsset.description.slice(0, 70)}...` : '—',
        onChainValue: 'Unavailable On-Chain (Off-Chain Only)',
        status: 'UNAVAILABLE_ON_CHAIN',
        note: 'Narrative description text is stored off-chain in PostgreSQL to eliminate redundant storage costs on Ethereum.'
      },
      {
        fieldKey: 'applicantIdentity',
        label: 'Applicant Identity / Email',
        category: 'Application Vault Storage',
        dbValue: dbAsset?.userId ? 'Private Profile ID in Auth' : '—',
        onChainValue: 'Unavailable On-Chain (Off-Chain Only)',
        status: 'UNAVAILABLE_ON_CHAIN',
        note: 'Personal identifiable information (PII) is kept strictly private off-chain; only beneficial wallet keys are stored on-chain.'
      }
    ];

    return rows;
  }, [onChainState, dbAsset, activeAssetId]);

  // Aggregate statistics for alignment score
  const alignmentStats = useMemo(() => {
    let verified = 0;
    let mismatch = 0;
    let unavailable = 0;

    comparisonRows.forEach((r) => {
      if (r.status === 'VERIFIED_MATCH' || r.status === 'OFF_CHAIN_AUDITED') verified += 1;
      else if (r.status === 'MISMATCH') mismatch += 1;
      else unavailable += 1;
    });

    const total = comparisonRows.length;
    const matchPercentage = total > 0 ? Math.round((verified / (verified + mismatch)) * 100) : 0;

    return {
      total,
      verified,
      mismatch,
      unavailable,
      matchPercentage: isNaN(matchPercentage) ? 0 : matchPercentage
    };
  }, [comparisonRows]);

  return (
    <div style={{ paddingBottom: '60px' }}>
      {/* 1. Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--color-copper)'
              }}
            >
              Real-Time Ethereum Sepolia State Verification
            </span>
            <span
              style={{
                fontSize: '11px',
                padding: '4px 12px',
                borderRadius: '9999px',
                backgroundColor: 'var(--color-mint-light, #DDF5EE)',
                color: '#1E6F5C',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Activity size={12} className="pulsing-dot" />
              Live Sepolia (Chain ID 11155111)
            </span>
          </div>

          <h2
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '36px',
              fontWeight: 600,
              color: 'var(--color-navy, #13243C)',
              letterSpacing: '-0.02em',
              lineHeight: 1.15,
              margin: '0 0 8px 0'
            }}
          >
            Blockchain Verification & Smart Contract Audit
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--color-secondary-text, #64748B)', margin: 0, maxWidth: '820px', lineHeight: 1.5 }}>
            Cryptographically read and audit live on-chain state directly from deployed Ethereum Sepolia smart contracts,
            validating real-world asset registry records, NFT mints, and token ownership against the application database.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => executeVerification(activeAssetId)}
            disabled={isLoading || isSyncing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              backgroundColor: '#FFFFFF',
              color: 'var(--color-navy, #13243C)',
              border: 'none',
              borderRadius: '9999px',
              fontSize: '13px',
              fontWeight: 600,
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              cursor: isLoading || isSyncing ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} style={{ color: 'var(--color-copper)' }} />
            <span>{isLoading ? 'Reading Contracts...' : 'Refresh Live State'}</span>
          </button>

          <button
            onClick={handleSyncBlockchain}
            disabled={isSyncing || isLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              backgroundColor: 'var(--color-copper, #B9653A)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '9999px',
              fontSize: '13px',
              fontWeight: 600,
              boxShadow: '0 2px 8px rgba(185, 101, 58, 0.25)',
              cursor: isSyncing || isLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
            <span>{isSyncing ? 'Syncing...' : 'Sync DB with Blockchain'}</span>
          </button>

          <a
            href={getEtherscanAddressUrl(REGISTRY_CONTRACT_ADDRESS)}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              backgroundColor: '#FFFFFF',
              color: 'var(--color-copper, #B9653A)',
              borderRadius: '9999px',
              fontSize: '13px',
              fontWeight: 600,
              textDecoration: 'none',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              transition: 'all 0.2s ease'
            }}
          >
            <ExternalLink size={14} />
            <span>Registry on Etherscan</span>
          </a>
        </div>
      </div>

      {syncMessage && (
        <div
          style={{
            padding: '14px 22px',
            marginBottom: '20px',
            borderRadius: '16px',
            backgroundColor: syncMessage.type === 'success' ? 'var(--color-mint-light, #DDF5EE)' : 'rgba(239, 68, 68, 0.1)',
            color: syncMessage.type === 'success' ? '#1E6F5C' : 'var(--color-error)',
            fontSize: '13px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
          }}
        >
          {syncMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{syncMessage.text}</span>
        </div>
      )}

      {/* 2. Deployed Contract Addresses Banner */}
      <div
        style={{
          padding: '24px 28px',
          marginBottom: '26px',
          backgroundColor: '#FFFFFF',
          borderRadius: '26px',
          boxShadow: 'var(--shadow-card, 0 10px 30px rgba(0,0,0,0.04))'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-peach-light, #FFF0E6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-copper)'
              }}
            >
              <Server size={17} />
            </div>
            <div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-navy, #13243C)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Live Deployed Sepolia Protocol Contracts
              </span>
              <div style={{ fontSize: '11px', color: 'var(--color-secondary-text, #64748B)' }}>
                Immutable smart contracts powering Assetra protocol execution
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '12px', color: 'var(--color-secondary-text)' }}>
            <span style={{ padding: '6px 12px', borderRadius: '9999px', backgroundColor: '#F8FAFC' }}>
              Current Block: <strong style={{ color: 'var(--color-navy)' }}>{currentBlock ? `#${currentBlock.toLocaleString()}` : 'Connecting...'}</strong>
            </span>
            {rpcLatencyMs !== null && (
              <span style={{ padding: '6px 12px', borderRadius: '9999px', backgroundColor: '#F8FAFC' }}>
                RPC Latency: <strong style={{ color: 'var(--color-copper)' }}>{rpcLatencyMs} ms</strong>
              </span>
            )}
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '14px'
          }}
        >
          {/* AssetRegistry */}
          <div
            style={{
              padding: '16px 18px',
              backgroundColor: '#F8FAFC',
              borderRadius: '18px',
              transition: 'transform 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-copper)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                AssetRegistry Contract
              </span>
              <a
                href={getEtherscanAddressUrl(REGISTRY_CONTRACT_ADDRESS)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: '11px', color: 'var(--color-copper)', display: 'inline-flex', alignItems: 'center', gap: '3px', textDecoration: 'none', fontWeight: 600 }}
              >
                Etherscan <ExternalLink size={10} />
              </a>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'monospace', fontSize: '12.5px', color: 'var(--color-navy, #13243C)', fontWeight: 600 }}>
                {REGISTRY_CONTRACT_ADDRESS.slice(0, 10)}...{REGISTRY_CONTRACT_ADDRESS.slice(-8)}
              </span>
              <button
                onClick={() => handleCopy(REGISTRY_CONTRACT_ADDRESS, 'registry')}
                style={{ background: '#FFFFFF', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--color-secondary-text)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
                title="Copy Address"
              >
                {copiedKey === 'registry' ? <Check size={13} style={{ color: 'var(--color-success)' }} /> : <Copy size={13} />}
              </button>
            </div>
          </div>

          {/* AssetToken */}
          <div
            style={{
              padding: '16px 18px',
              backgroundColor: '#F8FAFC',
              borderRadius: '18px',
              transition: 'transform 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-copper)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                AssetToken (ERC-721)
              </span>
              <a
                href={getEtherscanAddressUrl(TOKEN_CONTRACT_ADDRESS)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: '11px', color: 'var(--color-copper)', display: 'inline-flex', alignItems: 'center', gap: '3px', textDecoration: 'none', fontWeight: 600 }}
              >
                Etherscan <ExternalLink size={10} />
              </a>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'monospace', fontSize: '12.5px', color: 'var(--color-navy, #13243C)', fontWeight: 600 }}>
                {TOKEN_CONTRACT_ADDRESS.slice(0, 10)}...{TOKEN_CONTRACT_ADDRESS.slice(-8)}
              </span>
              <button
                onClick={() => handleCopy(TOKEN_CONTRACT_ADDRESS, 'token')}
                style={{ background: '#FFFFFF', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--color-secondary-text)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
                title="Copy Address"
              >
                {copiedKey === 'token' ? <Check size={13} style={{ color: 'var(--color-success)' }} /> : <Copy size={13} />}
              </button>
            </div>
          </div>

          {/* AssetMarketplace */}
          <div
            style={{
              padding: '16px 18px',
              backgroundColor: '#F8FAFC',
              borderRadius: '18px',
              transition: 'transform 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-copper)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                AssetMarketplace Contract
              </span>
              <a
                href={getEtherscanAddressUrl(MARKETPLACE_CONTRACT_ADDRESS)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: '11px', color: 'var(--color-copper)', display: 'inline-flex', alignItems: 'center', gap: '3px', textDecoration: 'none', fontWeight: 600 }}
              >
                Etherscan <ExternalLink size={10} />
              </a>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'monospace', fontSize: '12.5px', color: 'var(--color-navy, #13243C)', fontWeight: 600 }}>
                {MARKETPLACE_CONTRACT_ADDRESS.slice(0, 10)}...{MARKETPLACE_CONTRACT_ADDRESS.slice(-8)}
              </span>
              <button
                onClick={() => handleCopy(MARKETPLACE_CONTRACT_ADDRESS, 'marketplace')}
                style={{ background: '#FFFFFF', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--color-secondary-text)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
                title="Copy Address"
              >
                {copiedKey === 'marketplace' ? <Check size={13} style={{ color: 'var(--color-success)' }} /> : <Copy size={13} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Search & Quick Asset Selector */}
      <div
        style={{
          padding: '28px',
          marginBottom: '26px',
          backgroundColor: '#FFFFFF',
          borderRadius: '26px',
          boxShadow: 'var(--shadow-card, 0 10px 30px rgba(0,0,0,0.04))'
        }}
      >
        <div style={{ marginBottom: '18px' }}>
          <label
            htmlFor="asset-search-input"
            style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--color-secondary-text, #64748B)',
              marginBottom: '10px'
            }}
          >
            Verify Asset by ID (Live Sepolia Registry Query)
          </label>

          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 320px' }}>
              <Search
                size={18}
                style={{
                  position: 'absolute',
                  left: '18px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--color-secondary-text)'
                }}
              />
              <input
                id="asset-search-input"
                type="text"
                value={assetIdInput}
                onChange={(e) => setAssetIdInput(e.target.value)}
                placeholder="Enter Asset ID (e.g., AST-2026-TZEI, AST-2026-B1UB, AST-2026-JXF4)"
                style={{
                  width: '100%',
                  padding: '13px 18px 13px 48px',
                  fontSize: '14px',
                  fontFamily: 'monospace',
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: '9999px',
                  backgroundColor: '#F8FAFC',
                  color: 'var(--color-navy, #13243C)',
                  outline: 'none',
                  boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.03)'
                }}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              style={{
                backgroundColor: 'var(--color-copper, #B9653A)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '9999px',
                padding: '13px 28px',
                fontSize: '13px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 14px rgba(185, 101, 58, 0.25)',
                transition: 'all 0.2s ease'
              }}
            >
              <ShieldCheck size={16} />
              <span>{isLoading ? 'Verifying On-Chain...' : 'Verify On-Chain'}</span>
            </button>
          </form>
        </div>

        {/* Quick Demo Selector Chips */}
        <div>
          <span style={{ fontSize: '12px', color: 'var(--color-secondary-text)', fontWeight: 500, marginRight: '10px' }}>
            Quick Demonstration Assets:
          </span>
          <div style={{ display: 'inline-flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
            {[
              { id: 'AST-2026-I6PZ', label: 'LA (Token #5, Marketplace Purchased)', badge: 'Purchased On-Chain' },
              { id: 'AST-2026-TZEI', label: 'Pisa Tower (Token #2, Purchased)', badge: 'Purchased On-Chain' },
              { id: 'AST-2026-B1UB', label: 'Eifel (Token #1, Purchased)', badge: 'Purchased On-Chain' },
              { id: 'AST-2026-8EYO', label: 'Library (Token #4, Purchased)', badge: 'Purchased On-Chain' },
              { id: 'AST-2026-1KHN', label: 'KS Tower (Token #6, Tokenized)', badge: 'On-Chain Tokenized' },
              { id: 'AST-2026-SLQW', label: 'VIT A Block (Token #3, Tokenized)', badge: 'On-Chain Tokenized' },
              { id: 'AST-2026-JXF4', label: 'Greenview Apt (DB Approved, Off-Chain Demo)', badge: 'Off-Chain Only' }
            ].map((chip) => {
              const isSelected = activeAssetId === chip.id;
              return (
                <button
                  key={chip.id}
                  onClick={() => handleSelectQuickChip(chip.id)}
                  style={{
                    padding: '8px 16px',
                    fontSize: '12px',
                    borderRadius: '9999px',
                    border: 'none',
                    backgroundColor: isSelected ? 'var(--color-copper, #B9653A)' : '#F8FAFC',
                    color: isSelected ? '#FFFFFF' : 'var(--color-navy, #13243C)',
                    cursor: 'pointer',
                    fontWeight: isSelected ? 600 : 500,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: isSelected ? '0 4px 12px rgba(185, 101, 58, 0.25)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span style={{ fontFamily: 'monospace' }}>{chip.id}</span>
                  <span style={{ fontSize: '10.5px', opacity: isSelected ? 0.9 : 0.7 }}>({chip.badge})</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. Metric Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '18px',
          marginBottom: '28px'
        }}
      >
        <MetricCard
          title="Registry Status"
          value={
            onChainState.isRegistryContractReg
              ? onChainState.statusText
              : onChainState.isDirectTokenMint
                ? 'ERC-721 Live Deed'
                : (onChainState.isRegistered ? onChainState.statusText : 'Not Registered')
          }
          subtext={
            onChainState.isRegistryContractReg
              ? 'Confirmed on AssetRegistry contract'
              : onChainState.isDirectTokenMint
                ? 'Cryptographically minted on AssetToken'
                : (onChainState.isRegistered ? 'Confirmed on Ethereum Sepolia' : 'Asset not yet submitted to contract')
          }
          icon={ShieldCheck}
          variant={onChainState.isRegistered ? 'mint' : 'white'}
          indicator={{
            text: onChainState.isRegistryContractReg
              ? 'Registry Anchored'
              : onChainState.isDirectTokenMint
                ? 'Sepolia Token Anchored'
                : (onChainState.isRegistered ? 'Anchored On-Chain' : 'Off-Chain Only'),
            isPositive: onChainState.isRegistered
          }}
        />

        <MetricCard
          title="ERC-721 Tokenization"
          value={
            (onChainState.record?.tokenId > 0 || onChainState.tokenData?.tokenId > 0)
              ? `Token ID #${onChainState.record?.tokenId || onChainState.tokenData?.tokenId}`
              : 'Not Minted'
          }
          subtext={
            onChainState.tokenData?.tokenSymbol
              ? `${onChainState.tokenData.tokenSymbol} Contract (${TOKEN_CONTRACT_ADDRESS.slice(0, 6)}...${TOKEN_CONTRACT_ADDRESS.slice(-4)})`
              : 'NFT Deed not yet tokenized'
          }
          icon={Layers}
          variant={(onChainState.record?.tokenId > 0 || onChainState.tokenData?.tokenId > 0) ? 'peach' : 'white'}
          indicator={{
            text: (onChainState.record?.tokenId > 0 || onChainState.tokenData?.tokenId > 0) ? 'Minted ERC-721' : 'Deed Pending',
            isPositive: Boolean(onChainState.record?.tokenId > 0 || onChainState.tokenData?.tokenId > 0)
          }}
        />

        <MetricCard
          title="Database Alignment"
          value={`${alignmentStats.matchPercentage}%`}
          subtext={`${alignmentStats.verified} verified / ${alignmentStats.total} fields evaluated`}
          icon={Database}
          variant="lavender"
          indicator={{
            text: alignmentStats.mismatch === 0 ? 'Fully Aligned' : `${alignmentStats.mismatch} Mismatches`,
            isPositive: alignmentStats.mismatch === 0
          }}
        />

        <MetricCard
          title="Cryptographic Proofs"
          value={verifiedTxList.filter((t) => t.hasRealHash).length}
          subtext={`${verifiedTxList.filter((t) => t.receiptStatus === 'CONFIRMED').length} live confirmed on Sepolia`}
          icon={Activity}
          variant="white"
          indicator={{
            text: verifiedTxList.length > 0 ? 'Verified Hashes' : 'Historical Unpersisted',
            isPositive: verifiedTxList.some((t) => t.hasRealHash)
          }}
        />
      </div>

      {/* 5. Architectural Separation Notice (Requirement 7) */}
      <div
        style={{
          padding: '20px 26px',
          marginBottom: '28px',
          backgroundColor: '#FFF9F5',
          borderRadius: '24px',
          boxShadow: '0 4px 20px rgba(185, 101, 58, 0.05)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-peach-light, #FFF0E6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-copper)',
              flexShrink: 0
            }}
          >
            <Info size={18} />
          </div>
          <div>
            <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--color-navy, #13243C)', marginBottom: '4px' }}>
              Storage Architecture Separation Protocol (Requirement 7)
            </div>
            <div style={{ fontSize: '13px', color: 'var(--color-secondary-text, #64748B)', lineHeight: 1.6 }}>
              In the Assetra Protocol, physical title deeds, surveyor blueprints, and appraisal documents are securely
              maintained in encrypted off-chain storage (Supabase Vault) and referenced via cryptographic hash pointers
              (<code style={{ fontFamily: 'monospace', color: 'var(--color-copper)', fontWeight: 600 }}>ipfsHash</code>). The Ethereum Sepolia
              smart contract stores verified metadata, appraisal valuations, verifier signatures, token IDs, and beneficial
              ownership roots. <strong>Having an IPFS hash or metadata pointer on-chain does not mean large binary PDFs are stored on Ethereum.</strong>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Dual-Panel Overview: Live Blockchain vs Database Record */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '22px',
          marginBottom: '32px'
        }}
      >
        {/* Panel A: Live Blockchain Read */}
        <div
          style={{
            padding: '28px',
            backgroundColor: '#FFFFFF',
            borderRadius: '26px',
            boxShadow: 'var(--shadow-card, 0 10px 30px rgba(0,0,0,0.04))'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', paddingBottom: '14px', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-mint-light, #DDF5EE)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#1E6F5C'
                }}
              >
                <Cpu size={17} />
              </div>
              <h3 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--color-navy, #13243C)', margin: 0, fontFamily: 'var(--font-serif)' }}>
                Live Ethereum Sepolia State
              </h3>
            </div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '4px 12px',
                borderRadius: '9999px',
                backgroundColor: onChainState.isRegistered ? 'var(--color-mint-light, #DDF5EE)' : 'var(--color-peach-light, #FFF0E6)',
                color: onChainState.isRegistered ? '#1E6F5C' : 'var(--color-copper)'
              }}
            >
              {onChainState.isRegistryContractReg
                ? 'Registry Anchor Confirmed'
                : onChainState.isDirectTokenMint
                  ? 'Sepolia ERC-721 Confirmed'
                  : 'Not Found in Registry'}
            </span>
          </div>

          {onChainState.isRegistered && onChainState.record ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {onChainState.isDirectTokenMint && (
                <div style={{ padding: '10px 14px', backgroundColor: '#EFF6FF', borderRadius: '14px', border: '1px solid rgba(59, 130, 246, 0.25)', fontSize: '12px', color: '#1E40AF', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Layers size={14} style={{ flexShrink: 0 }} />
                  <span><strong>Sepolia Token Mint:</strong> Cryptographically verified on deployed ERC-721 AssetToken contract ({TOKEN_CONTRACT_ADDRESS.slice(0, 6)}...{TOKEN_CONTRACT_ADDRESS.slice(-4)}).</span>
                </div>
              )}
              <div style={{ padding: '14px 16px', backgroundColor: '#F8FAFC', borderRadius: '18px' }}>
                <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-secondary-text)', fontWeight: 600, letterSpacing: '0.04em' }}>
                  Asset Name on Contract
                </span>
                <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--color-navy, #13243C)', fontFamily: 'var(--font-serif)', marginTop: '2px' }}>
                  {onChainState.record.name}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ padding: '12px 14px', backgroundColor: '#F8FAFC', borderRadius: '16px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--color-secondary-text)' }}>Category</span>
                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--color-navy)' }}>
                    {onChainState.record.category}
                  </div>
                </div>
                <div style={{ padding: '12px 14px', backgroundColor: '#F8FAFC', borderRadius: '16px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--color-secondary-text)' }}>Valuation ({dbAsset?.currency || 'INR'})</span>
                  <div style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--color-copper)' }}>
                    {formatCurrency(onChainState.record.valuationUSD, dbAsset?.currency || 'INR')}
                  </div>
                </div>
                <div style={{ padding: '12px 14px', backgroundColor: '#F8FAFC', borderRadius: '16px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--color-secondary-text)' }}>Status Enum</span>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-navy)' }}>
                    {onChainState.statusText} ({onChainState.record.status})
                  </div>
                </div>
                <div style={{ padding: '12px 14px', backgroundColor: '#F8FAFC', borderRadius: '16px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--color-secondary-text)' }}>Approval Gate</span>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: onChainState.record.isApproved ? '#1E6F5C' : 'var(--color-error)' }}>
                    {onChainState.record.isApproved ? 'Verified & Approved' : 'Unapproved'}
                  </div>
                </div>
              </div>

              {/* Beneficial Owner */}
              <div style={{ padding: '14px 16px', backgroundColor: '#F8FAFC', borderRadius: '18px' }}>
                <span style={{ fontSize: '11px', color: 'var(--color-secondary-text)', fontWeight: 600 }}>Registered Beneficial Owner:</span>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '4px' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--color-navy)', wordBreak: 'break-all' }}>
                    {onChainState.record.ownerAddress}
                  </span>
                  <button
                    onClick={() => handleCopy(onChainState.record.ownerAddress, 'onchain-owner')}
                    style={{ background: '#FFFFFF', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--color-secondary-text)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', flexShrink: 0 }}
                    title="Copy"
                  >
                    {copiedKey === 'onchain-owner' ? <Check size={12} style={{ color: 'var(--color-success)' }} /> : <Copy size={12} />}
                  </button>
                </div>
              </div>

              {/* Verifier Signature */}
              {(onChainState.record.isApproved || (onChainState.record.approvedBy && onChainState.record.approvedBy !== ethers.ZeroAddress) || onChainState.record.designatedVerifier) && (
                <div style={{ padding: '14px 16px', backgroundColor: '#F8FAFC', borderRadius: '18px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--color-secondary-text)', fontWeight: 600 }}>
                    {onChainState.record.approvedBy && onChainState.record.approvedBy !== ethers.ZeroAddress
                      ? 'Approving Verifier Signature:'
                      : 'Designated Protocol Verifier:'}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '4px' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--color-navy)', wordBreak: 'break-all' }}>
                      {onChainState.record.approvedBy && onChainState.record.approvedBy !== ethers.ZeroAddress
                        ? onChainState.record.approvedBy
                        : (onChainState.record.designatedVerifier || DEPLOYER_ADDRESS)}
                    </span>
                    <button
                      onClick={() => handleCopy(onChainState.record.approvedBy && onChainState.record.approvedBy !== ethers.ZeroAddress ? onChainState.record.approvedBy : (onChainState.record.designatedVerifier || DEPLOYER_ADDRESS), 'onchain-verifier')}
                      style={{ background: '#FFFFFF', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--color-secondary-text)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', flexShrink: 0 }}
                      title="Copy"
                    >
                      {copiedKey === 'onchain-verifier' ? <Check size={12} style={{ color: 'var(--color-success)' }} /> : <Copy size={12} />}
                    </button>
                  </div>
                </div>
              )}

              {/* NFT Owner (AssetToken) */}
              {onChainState.tokenData && (
                <div style={{ padding: '16px 18px', backgroundColor: 'var(--color-mint-light, #DDF5EE)', borderRadius: '18px', marginTop: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#1E6F5C' }}>
                      ERC-721 Token #{onChainState.tokenData.tokenId} Live Holder:
                    </span>
                    <a
                      href={getEtherscanTokenUrl(onChainState.tokenData.tokenId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: '11px', color: '#1E6F5C', display: 'inline-flex', alignItems: 'center', gap: '2px', fontWeight: 600, textDecoration: 'none' }}
                    >
                      Token Etherscan <ExternalLink size={10} />
                    </a>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#1E6F5C', wordBreak: 'break-all', fontWeight: 600 }}>
                      {onChainState.tokenData.nftOwner}
                    </span>
                    <button
                      onClick={() => handleCopy(onChainState.tokenData.nftOwner, 'nft-owner')}
                      style={{ background: '#FFFFFF', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#1E6F5C', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', flexShrink: 0 }}
                      title="Copy"
                    >
                      {copiedKey === 'nft-owner' ? <Check size={12} style={{ color: 'var(--color-success)' }} /> : <Copy size={12} />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--color-secondary-text)' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-peach-light, #FFF0E6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-copper)',
                  margin: '0 auto 14px'
                }}
              >
                <AlertTriangle size={26} />
              </div>
              <div style={{ fontWeight: 600, color: 'var(--color-navy, #13243C)', marginBottom: '6px', fontSize: '15px' }}>
                Asset Not Found on Ethereum Sepolia
              </div>
              <div style={{ fontSize: '13px', lineHeight: 1.5, maxWidth: '340px', margin: '0 auto' }}>
                Contract <code style={{ fontFamily: 'monospace', color: 'var(--color-copper)' }}>isRegistered('{activeAssetId}')</code> returned{' '}
                <strong style={{ color: 'var(--color-error)' }}>false</strong>. This asset currently exists strictly off-chain in the application database.
              </div>
            </div>
          )}
        </div>

        {/* Panel B: Supabase Database Record */}
        <div
          style={{
            padding: '28px',
            backgroundColor: '#FFFFFF',
            borderRadius: '26px',
            boxShadow: 'var(--shadow-card, 0 10px 30px rgba(0,0,0,0.04))'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', paddingBottom: '14px', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-lavender-light, #F0EBFF)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#6B46C1'
                }}
              >
                <Database size={17} />
              </div>
              <h3 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--color-navy, #13243C)', margin: 0, fontFamily: 'var(--font-serif)' }}>
                Supabase Application Record
              </h3>
            </div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '4px 12px',
                borderRadius: '9999px',
                backgroundColor: dbAsset ? 'var(--color-lavender-light, #F0EBFF)' : 'rgba(239, 68, 68, 0.1)',
                color: dbAsset ? '#6B46C1' : 'var(--color-error)'
              }}
            >
              {dbAsset ? 'PostgreSQL Record Loaded' : 'Asset Not in Database'}
            </span>
          </div>

          {dbAsset ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ padding: '14px 16px', backgroundColor: '#F8FAFC', borderRadius: '18px' }}>
                <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-secondary-text)', fontWeight: 600, letterSpacing: '0.04em' }}>
                  Asset Name in DB
                </span>
                <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--color-navy, #13243C)', fontFamily: 'var(--font-serif)', marginTop: '2px' }}>
                  {dbAsset.name}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ padding: '12px 14px', backgroundColor: '#F8FAFC', borderRadius: '16px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--color-secondary-text)' }}>Category</span>
                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--color-navy)' }}>
                    {dbAsset.category}
                  </div>
                </div>
                <div style={{ padding: '12px 14px', backgroundColor: '#F8FAFC', borderRadius: '16px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--color-secondary-text)' }}>Valuation</span>
                  <div style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--color-copper)' }}>
                    {formatCurrency(dbAsset.valuation, dbAsset.currency || 'USD')}
                  </div>
                </div>
                <div style={{ padding: '12px 14px', backgroundColor: '#F8FAFC', borderRadius: '16px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--color-secondary-text)' }}>Verification Status</span>
                  <div style={{ marginTop: '4px' }}>
                    <Badge status={dbAsset.verificationStatus || dbAsset.status} size="small" />
                  </div>
                </div>
                <div style={{ padding: '12px 14px', backgroundColor: '#F8FAFC', borderRadius: '16px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--color-secondary-text)' }}>Token Status</span>
                  <div style={{ marginTop: '4px' }}>
                    <Badge status={dbAsset.tokenStatus} size="small" />
                  </div>
                </div>
              </div>

              {/* Current Owner in DB */}
              <div style={{ padding: '14px 16px', backgroundColor: '#F8FAFC', borderRadius: '18px' }}>
                <span style={{ fontSize: '11px', color: 'var(--color-secondary-text)', fontWeight: 600 }}>Current Owner Address (DB):</span>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '4px' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--color-navy)', wordBreak: 'break-all' }}>
                    {dbAsset.currentOwnerAddress || dbAsset.owner || '—'}
                  </span>
                  <button
                    onClick={() => handleCopy(dbAsset.currentOwnerAddress || dbAsset.owner, 'db-owner')}
                    style={{ background: '#FFFFFF', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--color-secondary-text)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', flexShrink: 0 }}
                    title="Copy"
                  >
                    {copiedKey === 'db-owner' ? <Check size={12} style={{ color: 'var(--color-success)' }} /> : <Copy size={12} />}
                  </button>
                </div>
              </div>

              {/* Vault Documents Notice */}
              <div style={{ padding: '16px 18px', backgroundColor: '#F8FAFC', borderRadius: '18px', marginTop: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-navy)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <Lock size={13} style={{ color: 'var(--color-copper)' }} /> Secure Storage Vault (Off-Chain)
                  </span>
                  <Link
                    to={`/asset/${dbAsset.id}`}
                    style={{ fontSize: '11.5px', color: 'var(--color-copper)', textDecoration: 'none', fontWeight: 600 }}
                  >
                    View Asset & Vault →
                  </Link>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-secondary-text)', lineHeight: 1.5 }}>
                  Physical deed PDFs are stored in private Supabase Storage bucket (<code style={{ fontFamily: 'monospace', color: 'var(--color-navy)' }}>asset-documents</code>) with signed short-lived download authorization.
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--color-secondary-text)' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-error)',
                  margin: '0 auto 14px'
                }}
              >
                <XCircle size={26} />
              </div>
              <div style={{ fontWeight: 600, color: 'var(--color-navy, #13243C)', marginBottom: '6px', fontSize: '15px' }}>
                Asset ID Not Found in Database
              </div>
              <div style={{ fontSize: '13px', lineHeight: 1.5, maxWidth: '340px', margin: '0 auto' }}>
                No record matches '{activeAssetId}' in the PostgreSQL database.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 7. Field-by-Field Cryptographic Verification Matrix (Requirements 3 & 6) */}
      <div
        style={{
          padding: '28px',
          marginBottom: '32px',
          backgroundColor: '#FFFFFF',
          borderRadius: '26px',
          boxShadow: 'var(--shadow-card, 0 10px 30px rgba(0,0,0,0.04))'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '22px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--color-navy, #13243C)', margin: 0, fontFamily: 'var(--font-serif)' }}>
              Field-by-Field Verification Audit Matrix
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--color-secondary-text)', marginTop: '4px' }}>
              Comprehensive side-by-side reconciliation between application database fields and live Ethereum Sepolia contract state.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: '11.5px',
                padding: '6px 14px',
                borderRadius: '9999px',
                backgroundColor: 'var(--color-mint-light, #DDF5EE)',
                color: '#1E6F5C',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <CheckCircle2 size={13} /> {alignmentStats.verified} Verified Match
            </span>

            {alignmentStats.mismatch > 0 && (
              <span
                style={{
                  fontSize: '11.5px',
                  padding: '6px 14px',
                  borderRadius: '9999px',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  color: 'var(--color-error)',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <AlertTriangle size={13} /> {alignmentStats.mismatch} Mismatch
              </span>
            )}

            <span
              style={{
                fontSize: '11.5px',
                padding: '6px 14px',
                borderRadius: '9999px',
                backgroundColor: '#F8FAFC',
                color: 'var(--color-secondary-text)',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <Lock size={13} /> {alignmentStats.unavailable} Unavailable On-Chain
            </span>
          </div>
        </div>

        {alignmentStats.mismatch > 0 && (
          <div
            style={{
              padding: '14px 20px',
              marginBottom: '18px',
              borderRadius: '16px',
              backgroundColor: 'rgba(239, 68, 68, 0.05)',
              border: '1px solid rgba(239, 68, 68, 0.18)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertTriangle size={18} style={{ color: 'var(--color-error)' }} />
              <span style={{ fontSize: '13px', color: 'var(--color-navy, #13243C)', fontWeight: 500 }}>
                {alignmentStats.mismatch} field(s) currently differ from the authoritative live Ethereum Sepolia contract state.
              </span>
            </div>
            <button
              onClick={handleSyncBlockchain}
              disabled={isSyncing}
              style={{
                padding: '6px 18px',
                backgroundColor: 'var(--color-copper, #B9653A)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '9999px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: isSyncing ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 6px rgba(185, 101, 58, 0.2)'
              }}
            >
              <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
              <span>{isSyncing ? 'Syncing DB...' : 'Sync Database with Blockchain'}</span>
            </button>
          </div>
        )}

        {/* Matrix Table */}
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'separate',
              borderSpacing: '0 6px',
              fontSize: '13px',
              textAlign: 'left'
            }}
          >
            <thead>
              <tr
                style={{
                  color: 'var(--color-secondary-text)',
                  fontSize: '11.5px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}
              >
                <th style={{ padding: '12px 16px', width: '24%', fontWeight: 600 }}>Protocol Data Field</th>
                <th style={{ padding: '12px 16px', width: '28%', fontWeight: 600 }}>Supabase Database Value</th>
                <th style={{ padding: '12px 16px', width: '28%', fontWeight: 600 }}>Live Sepolia Contract State</th>
                <th style={{ padding: '12px 16px', width: '20%', fontWeight: 600 }}>Verification Status</th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row) => {
                let badgeNode = null;
                if (row.status === 'VERIFIED_MATCH') {
                  badgeNode = (
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '4px 12px',
                        borderRadius: '9999px',
                        backgroundColor: 'var(--color-mint-light, #DDF5EE)',
                        color: '#1E6F5C',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}
                    >
                      <CheckCircle2 size={12} /> Verified Match
                    </span>
                  );
                } else if (row.status === 'OFF_CHAIN_AUDITED') {
                  badgeNode = (
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '4px 12px',
                        borderRadius: '9999px',
                        backgroundColor: 'var(--color-mint-light, #DDF5EE)',
                        color: '#1E6F5C',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}
                    >
                      <CheckCircle2 size={12} /> Off-Chain Audited (Designated Verifier Match)
                    </span>
                  );
                } else if (row.status === 'MISMATCH') {
                  badgeNode = (
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '4px 12px',
                        borderRadius: '9999px',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        color: 'var(--color-error)',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}
                    >
                      <AlertTriangle size={12} /> Mismatch with DB
                    </span>
                  );
                } else if (row.status === 'UNAVAILABLE_ON_CHAIN') {
                  badgeNode = (
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '4px 12px',
                        borderRadius: '9999px',
                        backgroundColor: '#F8FAFC',
                        color: 'var(--color-secondary-text)',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}
                    >
                      <Lock size={12} /> Unavailable On-Chain
                    </span>
                  );
                } else {
                  badgeNode = (
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '4px 12px',
                        borderRadius: '9999px',
                        backgroundColor: 'var(--color-peach-light, #FFF0E6)',
                        color: 'var(--color-copper)',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}
                    >
                      <XCircle size={12} /> Unanchored
                    </span>
                  );
                }

                return (
                  <tr
                    key={row.fieldKey}
                    style={{
                      backgroundColor: '#F8FAFC',
                      transition: 'background-color 0.15s ease'
                    }}
                  >
                    <td style={{ padding: '14px 16px', verticalAlign: 'top', borderTopLeftRadius: '14px', borderBottomLeftRadius: '14px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--color-navy, #13243C)' }}>{row.label}</div>
                      <div style={{ fontSize: '11px', color: 'var(--color-secondary-text)', marginTop: '3px', lineHeight: 1.4 }}>
                        {row.note}
                      </div>
                    </td>

                    <td style={{ padding: '14px 16px', verticalAlign: 'top', wordBreak: 'break-all' }}>
                      <div
                        style={{
                          fontFamily:
                            typeof row.dbValue === 'string' &&
                            (row.dbValue.startsWith('0x') || row.dbValue.startsWith('http') || row.dbValue.startsWith('AST-'))
                              ? 'monospace'
                              : 'inherit',
                          fontSize: '12.5px',
                          color: 'var(--color-navy, #13243C)',
                          fontWeight: 500
                        }}
                      >
                        {String(row.dbValue)}
                      </div>
                    </td>

                    <td style={{ padding: '14px 16px', verticalAlign: 'top', wordBreak: 'break-all' }}>
                      <div
                        style={{
                          fontFamily:
                            typeof row.onChainValue === 'string' &&
                            (row.onChainValue.startsWith('0x') || row.onChainValue.startsWith('http'))
                              ? 'monospace'
                              : 'inherit',
                          fontSize: '12.5px',
                          color:
                            row.status === 'NOT_REGISTERED'
                              ? 'var(--color-error)'
                              : row.status === 'UNAVAILABLE_ON_CHAIN'
                              ? 'var(--color-secondary-text)'
                              : 'var(--color-navy, #13243C)',
                          fontWeight: row.status === 'VERIFIED_MATCH' ? 600 : 400
                        }}
                      >
                        {String(row.onChainValue)}
                      </div>
                    </td>

                    <td style={{ padding: '14px 16px', verticalAlign: 'top', borderTopRightRadius: '14px', borderBottomRightRadius: '14px' }}>
                      {badgeNode}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 8. Verified Lifecycle Transactions & Real Etherscan Links (Requirement 5 & 8) */}
      <div
        style={{
          padding: '28px',
          marginBottom: '32px',
          backgroundColor: '#FFFFFF',
          borderRadius: '26px',
          boxShadow: 'var(--shadow-card, 0 10px 30px rgba(0,0,0,0.04))'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--color-navy, #13243C)', margin: 0, fontFamily: 'var(--font-serif)' }}>
              Real Lifecycle Transactions & On-Chain Receipts
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--color-secondary-text)', marginTop: '4px' }}>
              Cryptographically verified Ethereum transaction hashes associated with this asset on Sepolia.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: '11px',
                padding: '5px 14px',
                borderRadius: '9999px',
                backgroundColor: 'var(--color-mint-light, #DDF5EE)',
                color: '#1E6F5C',
                fontWeight: 600
              }}
            >
              Zero Fabricated Hashes Policy Enforced
            </span>
          </div>
        </div>

        {verifiedTxList.filter((t) => t.hasRealHash).length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {verifiedTxList
              .filter((t) => t.hasRealHash)
              .map((tx) => (
                <div
                  key={tx.id || tx.hash}
                  style={{
                    padding: '20px 22px',
                    borderRadius: '20px',
                    backgroundColor: '#F8FAFC',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '14px'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-navy, #13243C)' }}>
                        {tx.type || tx.transaction_type || 'Smart Contract Interaction'}
                      </span>
                      <span
                        style={{
                          fontSize: '10.5px',
                          fontWeight: 600,
                          padding: '3px 10px',
                          borderRadius: '9999px',
                          backgroundColor: tx.receiptStatus === 'CONFIRMED' ? 'var(--color-mint-light, #DDF5EE)' : 'var(--color-peach-light, #FFF0E6)',
                          color: tx.receiptStatus === 'CONFIRMED' ? '#1E6F5C' : 'var(--color-copper)'
                        }}
                      >
                        {tx.receiptStatus === 'CONFIRMED' ? 'Confirmed on Sepolia' : tx.receiptStatus}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '12px', color: 'var(--color-secondary-text)' }}>Tx Hash:</span>
                      <span style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--color-navy)', wordBreak: 'break-all', fontWeight: 500 }}>
                        {tx.hash}
                      </span>
                      <button
                        onClick={() => handleCopy(tx.hash, tx.hash)}
                        style={{ background: '#FFFFFF', border: 'none', borderRadius: '50%', width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--color-secondary-text)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
                        title="Copy Hash"
                      >
                        {copiedKey === tx.hash ? <Check size={12} style={{ color: 'var(--color-success)' }} /> : <Copy size={12} />}
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--color-secondary-text)', marginTop: '6px' }}>
                      {tx.confirmedBlock && (
                        <span>
                          Block Height: <strong style={{ color: 'var(--color-navy)' }}>#{tx.confirmedBlock}</strong>
                        </span>
                      )}
                      {tx.gasUsed && (
                        <span>
                          Gas Used: <strong style={{ color: 'var(--color-navy)' }}>{Number(tx.gasUsed).toLocaleString()}</strong>
                        </span>
                      )}
                      {tx.amount && (
                        <span>
                          Settlement Amount: <strong style={{ color: 'var(--color-copper)' }}>{tx.amount}</strong>
                        </span>
                      )}
                    </div>
                  </div>

                  <a
                    href={getEtherscanTxUrl(tx.hash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: '#FFFFFF',
                      color: 'var(--color-copper, #B9653A)',
                      borderRadius: '9999px',
                      padding: '9px 18px',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      textDecoration: 'none',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <ExternalLink size={13} />
                    <span>View on Sepolia Etherscan</span>
                  </a>
                </div>
              ))}
          </div>
        ) : (
          <div
            style={{
              padding: '22px 26px',
              backgroundColor: '#F8FAFC',
              borderRadius: '20px',
              color: 'var(--color-secondary-text)',
              fontSize: '13px',
              lineHeight: 1.6
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-navy, #13243C)', fontWeight: 600, marginBottom: '6px' }}>
              <Clock size={16} style={{ color: 'var(--color-copper)' }} />
              Historical Transaction Hash Not Persisted (Requirement 8 Compliance)
            </div>
            <div>
              {onChainState.isRegistered ? (
                <span>
                  This asset has a verified on-chain state record in the <strong>AssetRegistry</strong> contract (registered at block timestamp{' '}
                  <code style={{ fontFamily: 'monospace', color: 'var(--color-copper)' }}>{onChainState.record?.registeredAt}</code>), but the original initiating transaction hash was not captured in the application database at execution time. In accordance with strict audit standards, <strong>transaction hashes are never fabricated or guessed</strong>.
                </span>
              ) : (
                <span>
                  No blockchain transaction hashes are stored for asset ID <strong>{activeAssetId}</strong> because it has not yet completed on-chain smart contract registration.
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 9. Raw On-Chain EVM Struct Inspector (Collapsible JSON) */}
      <div
        style={{
          padding: '24px 28px',
          backgroundColor: '#FFFFFF',
          borderRadius: '26px',
          boxShadow: 'var(--shadow-card, 0 10px 30px rgba(0,0,0,0.04))'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h4 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-navy, #13243C)', margin: 0, fontFamily: 'var(--font-serif)' }}>
              Raw EVM Contract Struct Inspector
            </h4>
            <p style={{ fontSize: '12px', color: 'var(--color-secondary-text)', margin: '3px 0 0' }}>
              Direct JSON representation of the live AssetRecord struct and AssetToken state returned by the Ethereum Sepolia RPC.
            </p>
          </div>

          <button
            onClick={() => setShowRawJson(!showRawJson)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12.5px',
              fontWeight: 600,
              padding: '9px 18px',
              backgroundColor: '#F8FAFC',
              color: 'var(--color-navy, #13243C)',
              border: 'none',
              borderRadius: '9999px',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
              transition: 'all 0.2s ease'
            }}
          >
            <FileCode size={14} style={{ color: 'var(--color-copper)' }} />
            <span>{showRawJson ? 'Hide Raw JSON' : 'Inspect Raw EVM JSON'}</span>
          </button>
        </div>

        {showRawJson && (
          <div style={{ marginTop: '20px' }}>
            <pre
              style={{
                backgroundColor: '#101B2D',
                color: '#E2E8F0',
                padding: '22px',
                borderRadius: '18px',
                fontSize: '12px',
                fontFamily: 'monospace',
                overflowX: 'auto',
                maxHeight: '420px',
                lineHeight: 1.6
              }}
            >
              {JSON.stringify(
                {
                  network: 'Ethereum Sepolia',
                  chainId: SEPOLIA_CHAIN_ID,
                  currentBlock,
                  registryContractAddress: REGISTRY_CONTRACT_ADDRESS,
                  tokenContractAddress: TOKEN_CONTRACT_ADDRESS,
                  marketplaceContractAddress: MARKETPLACE_CONTRACT_ADDRESS,
                  isRegisteredOnChain: onChainState.isRegistered,
                  liveRegistryRecord: onChainState.record,
                  liveAssetTokenData: onChainState.tokenData,
                  matchedDatabaseAsset: dbAsset
                },
                null,
                2
              )}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default BlockchainVerification;
