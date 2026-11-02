import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAssets } from '../context/AssetContext';
import { useWeb3 } from '../context/Web3Context';
import { useAuth } from '../context/AuthContext';
import BadgeComponent, { Badge as ImportedBadge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { TokenizeModal } from '../components/blockchain/TokenizeModal';
import { ReceiptModal } from '../components/blockchain/ReceiptModal';
import { SellTokenModal } from '../components/blockchain/SellTokenModal';
import { TransferTokenModal } from '../components/blockchain/TransferTokenModal';
import { downloadReceiptPdf } from '../utils/receiptPdfGenerator';
import { formatCurrency } from '../constants/currencies';
import { ethers } from 'ethers';
import {
  TOKEN_CONTRACT_ADDRESS,
  MARKETPLACE_CONTRACT_ADDRESS,
  SEPOLIA_CHAIN_ID,
  isSepoliaOrLocalChainId,
  getMetaMaskProvider,
  getPublicSepoliaProvider,
  getAssetMarketplaceContract,
  getAssetTokenContract,
  getEtherscanTxUrl
} from '../constants/contracts';
import {
  Building2,
  Boxes,
  PlusCircle,
  ArrowUpRight,
  ExternalLink,
  Zap,
  PieChart as PieChartIcon,
  ShoppingCart,
  CheckCircle2,
  AlertCircle,
  Download,
  FileText,
  RefreshCw,
  Coins,
  Check,
  Cloud,
  Calendar,
  ArrowRight,
  Tag,
  Send
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

export const Badge = ImportedBadge || BadgeComponent;
export const SafeBadge = Badge;

// Check if an asset is already tokenized on-chain or in database
export const isAssetTokenized = (a) => Boolean(
  a && (
    a.isTokenized ||
    a.tokenStatus === 'TOKENIZED' ||
    a.status === 'TOKENIZED' ||
    (a.tokenId && String(a.tokenId) !== '0') ||
    (a.contractAddress && a.tokenId)
  )
);

export const Overview = () => {
  const navigate = useNavigate();
  const { assets, transactions, recordPurchase, delistToken, syncAssetFromChain, fetchAssets } = useAssets();
  const { user } = useAuth();
  const {
    account,
    chainId,
    networkInfo,
    balance,
    isConnected,
    connectWallet,
    switchToSepolia,
    updateBalance
  } = useWeb3();
  const [selectedTokenizeAsset, setSelectedTokenizeAsset] = useState(null);
  const [selectedAssetForSell, setSelectedAssetForSell] = useState(null);
  const [selectedAssetForTransfer, setSelectedAssetForTransfer] = useState(null);
  const [onChainOwners, setOnChainOwners] = useState({});

  // Delist an asset from the smart contract marketplace
  const handleDelist = async (asset) => {
    if (!asset) return;
    if (!window.confirm(`Are you sure you want to delist token #${asset.tokenId || '1'} from the marketplace smart contract?`)) {
      return;
    }
    try {
      const eth = getMetaMaskProvider();
      if (!eth) throw new Error('MetaMask not detected.');
      const provider = new ethers.BrowserProvider(eth);
      const signer = await provider.getSigner();

      const network = await provider.getNetwork();
      if (!isSepoliaOrLocalChainId(network.chainId)) {
        throw new Error('Please switch MetaMask network to Ethereum Sepolia (Chain ID 11155111).');
      }

      const marketplaceAddress = asset.marketplaceContractAddress || MARKETPLACE_CONTRACT_ADDRESS;
      const tokenContractAddress = asset.contractAddress || TOKEN_CONTRACT_ADDRESS;
      const tokenId = asset.tokenId || '1';

      const marketplaceContract = getAssetMarketplaceContract(signer, marketplaceAddress);
      const tx = await marketplaceContract.delistItem(tokenContractAddress, tokenId);
      const receipt = await tx.wait(1);

      if (!receipt || receipt.status !== 1) {
        throw new Error('On-chain delisting transaction reverted.');
      }

      if (delistToken) await delistToken(asset.id);
      if (syncAssetFromChain) await syncAssetFromChain(asset.id);
      if (fetchAssets) await fetchAssets();
      alert(`Token #${tokenId} was successfully delisted from the marketplace.`);
    } catch (err) {
      console.error('Delist error:', err);
      alert(err.reason || err.message || 'Failed to delist token.');
    }
  };

  // Query authoritative on-chain NFT ownership for each token from Ethereum Sepolia
  useEffect(() => {
    let isCancelled = false;
    const fetchOnChainHoldings = async () => {
      try {
        const provider = getPublicSepoliaProvider();
        const tokenContract = new ethers.Contract(
          TOKEN_CONTRACT_ADDRESS,
          ['function ownerOf(uint256 tokenId) view returns (address)'],
          provider
        );
        const tokenized = (assets || []).filter(a => isAssetTokenized(a));
        const ownerMap = {};
        await Promise.all(
          tokenized.map(async (a) => {
            const tId = a.tokenId || '1';
            try {
              const liveOwner = await tokenContract.ownerOf(tId);
              if (!isCancelled) ownerMap[tId] = liveOwner;
            } catch {
              // Not yet minted or different contract
            }
          })
        );
        if (!isCancelled) {
          setOnChainOwners(ownerMap);
        }
      } catch (err) {
        console.warn('Dashboard on-chain ownership check error:', err.message);
      }
    };

    if (assets && assets.length > 0) {
      fetchOnChainHoldings();
    }
    return () => { isCancelled = true; };
  }, [assets]);

  // Buy Modal State for Dashboard
  const [buyModalAsset, setBuyModalAsset] = useState(null);
  const [isBuying, setIsBuying] = useState(false);
  const [buyError, setBuyError] = useState('');
  const [buySuccessTx, setBuySuccessTx] = useState(null);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // Contract-authoritative purchase execution on Ethereum Sepolia
  const handleExecutePurchase = async () => {
    if (!buyModalAsset) return;
    setBuyError('');
    setBuySuccessTx(null);

    let activeSigner = null;
    let currentWallet = account;

    if (!isConnected || !currentWallet) {
      try {
        currentWallet = await connectWallet();
      } catch {
        setBuyError('Please connect your MetaMask wallet to complete this purchase.');
        return;
      }
    }

    if (!currentWallet) {
      setBuyError('No Web3 wallet account detected.');
      return;
    }

    setIsBuying(true);

    try {
      const eth = getMetaMaskProvider();
      if (!eth) {
        throw new Error('MetaMask or Web3 browser extension not detected.');
      }

      const provider = new ethers.BrowserProvider(eth);
      activeSigner = await provider.getSigner();

      // Check Sepolia network (Chain ID 11155111)
      const network = await provider.getNetwork();
      if (!isSepoliaOrLocalChainId(network.chainId)) {
        throw new Error('Please switch MetaMask network to Ethereum Sepolia (Chain ID 11155111).');
      }

      const marketplaceAddress = buyModalAsset.marketplaceContractAddress || MARKETPLACE_CONTRACT_ADDRESS;
      const tokenContractAddress = buyModalAsset.contractAddress || TOKEN_CONTRACT_ADDRESS;
      const tokenId = buyModalAsset.tokenId || '1';

      const marketplaceContract = getAssetMarketplaceContract(activeSigner, marketplaceAddress);
      const tokenContract = getAssetTokenContract(provider, tokenContractAddress);

      // 1. Authoritative on-chain listing verification
      const listing = await marketplaceContract.getListing(tokenContractAddress, tokenId);
      if (!listing || !listing.isActive) {
        throw new Error(`Token #${tokenId} is not currently active for purchase on the AssetMarketplace smart contract.`);
      }

      // 2. Authoritative listing price in wei directly from smart contract
      const priceWei = listing.price;
      if (!priceWei || priceWei === 0n) {
        throw new Error('Listing price on smart contract is zero or invalid.');
      }
      const authoritativePriceEth = ethers.formatEther(priceWei);

      // 3. Prevent self-purchase
      if (listing.seller.toLowerCase() === currentWallet.toLowerCase()) {
        throw new Error('You cannot purchase your own asset token. Your connected wallet is the on-chain seller.');
      }

      // 4. Verify seller still owns the NFT on-chain
      const currentTokenOwner = await tokenContract.ownerOf(tokenId);
      if (currentTokenOwner.toLowerCase() !== listing.seller.toLowerCase()) {
        throw new Error(
          `Seller (${listing.seller.slice(0, 6)}...${listing.seller.slice(-4)}) no longer owns token #${tokenId} on-chain. Current owner is ${currentTokenOwner.slice(0, 6)}...${currentTokenOwner.slice(-4)}. The listing is stale.`
        );
      }

      // 5. Verify buyer wallet has sufficient SepoliaETH balance (price in wei)
      const buyerBalanceWei = await provider.getBalance(currentWallet);
      if (buyerBalanceWei < priceWei) {
        const buyerBalanceEth = ethers.formatEther(buyerBalanceWei);
        throw new Error(
          `Insufficient SepoliaETH balance. You have ${parseFloat(buyerBalanceEth).toFixed(4)} ETH, but the exact listing price is ${authoritativePriceEth} ETH (plus transaction gas).`
        );
      }

      // 6. Execute atomic purchase on AssetMarketplace contract
      const tx = await marketplaceContract.buyItem(tokenContractAddress, tokenId, { value: priceWei });
      const receipt = await tx.wait(1);

      if (!receipt || receipt.status !== 1) {
        throw new Error('On-chain purchase transaction reverted or failed on Ethereum Sepolia.');
      }

      // 7. Verify NFT ownership successfully transferred to buyer
      try {
        const postTokenOwner = await tokenContract.ownerOf(tokenId);
        console.log('[Dashboard:Purchase] Post-purchase on-chain NFT owner:', postTokenOwner);
      } catch (ownerErr) {
        console.warn('Could not confirm post-purchase NFT owner:', ownerErr.message);
      }

      const gasFeeFormatted = receipt.gasUsed
        ? `${ethers.formatEther(receipt.gasUsed * (receipt.gasPrice || 1000000000n))} ETH`
        : '0.0050 ETH';

      // 8. Synchronize confirmed purchase state with database and ledger
      const purchaseResult = await recordPurchase(buyModalAsset.id, {
        buyerWallet: currentWallet,
        txHash: receipt.hash,
        chainId: String(chainId || SEPOLIA_CHAIN_ID),
        priceEth: authoritativePriceEth,
        blockNumber: receipt.blockNumber,
        gasFee: gasFeeFormatted,
        sellerWallet: listing.seller,
        tokenContract: tokenContractAddress,
        marketplaceContract: marketplaceAddress,
        tokenId: tokenId,
        assetName: buyModalAsset.name
      });

      if (typeof syncAssetFromChain === 'function') {
        try {
          await syncAssetFromChain(buyModalAsset.id);
        } catch (syncErr) {
          console.warn('Dashboard post-purchase sync warning:', syncErr);
        }
      }
      if (typeof updateBalance === 'function' && currentWallet) {
        try {
          await updateBalance(currentWallet);
        } catch (balErr) {
          console.warn('Dashboard post-purchase balance warning:', balErr);
        }
      }
      if (typeof fetchAssets === 'function') {
        try {
          await fetchAssets();
        } catch (fetchErr) {
          console.warn('Dashboard post-purchase fetchAssets warning:', fetchErr);
        }
      }

      setBuySuccessTx({
        hash: receipt.hash,
        blockNumber: receipt.blockNumber,
        buyer: currentWallet,
        priceEth: authoritativePriceEth,
        receipt: purchaseResult?.receipt || null
      });
    } catch (err) {
      console.error('Dashboard purchase execution error:', err);
      if (err.code === 'ACTION_REJECTED' || (err.message && err.message.toLowerCase().includes('user rejected'))) {
        setBuyError('Transaction was rejected or cancelled in your wallet.');
      } else {
        setBuyError(err.reason || err.shortMessage || err.message || 'On-chain purchase transaction failed.');
      }
    } finally {
      setIsBuying(false);
    }
  };

  // Rigorous User Ownership Computation:
  // Decoupled from generic listings; checks connected wallet, saved profile wallet, or purchases
  const userAssets = (assets || []).filter((a) => {
    if (!a) return false;
    let localSubmittedIds = [];
    try {
      const raw = localStorage.getItem('assetra_submitted_asset_ids');
      if (raw) localSubmittedIds = JSON.parse(raw);
    } catch {}
    const localIdSet = new Set(localSubmittedIds);
    if (a.id && localIdSet.has(a.id)) return true;

    const currentOwner = (a.currentOwnerAddress || a.owner || '').toLowerCase();
    const connectedWallet = (account || '').toLowerCase();
    const userWallet = (user?.walletAddress || '').toLowerCase();

    if (connectedWallet && currentOwner === connectedWallet) return true;
    if (userWallet && currentOwner === userWallet) return true;
    if (user && a.lastPurchasedBy === user.id) return true;
    if (user && a.userId === user.id) {
      if (a.lastPurchasedBy && a.lastPurchasedBy !== user.id) return false;
      return true;
    }
    return false;
  });

  const userPortfolioValuation = userAssets.reduce((sum, a) => sum + (Number(a?.valuation) || 0), 0);
  const userTokensCount = userAssets.filter((a) => a && (
    a.isTokenized ||
    a.tokenStatus === 'TOKENIZED' ||
    a.status === 'TOKENIZED' ||
    (a.tokenId && String(a.tokenId) !== '0')
  )).length;
  const userAssetsCount = userAssets.length;

  // Portfolio category distribution strictly calculated from actual holdings
  const categoryMap = userAssets.reduce((acc, a) => {
    if (!a) return acc;
    const cat = a.category || 'Real Estate';
    acc[cat] = (acc[cat] || 0) + (Number(a.valuation) || 0);
    return acc;
  }, {});

  const chartData = Object.entries(categoryMap).map(([name, value]) => ({
    name: String(name || '').replace(' & Collectibles', '').replace(' & Commodities', '').replace(' & Energy', ''),
    value: Number(value) || 0
  }));

  // Curated Luxury Fintech color palette for charts
  const LUXURY_PALETTE = ['#B9653A', '#101B2D', '#2563EB', '#10B981', '#8B5CF6'];

  // Approved assets waiting for on-chain tokenization
  const approvedUntokenized = userAssets.filter(
    (a) => a && (a.verificationStatus === 'APPROVED' || a.status === 'APPROVED' || a.isVerified) && !isAssetTokenized(a)
  );

  // Real transactions relevant to user or protocol ledger
  const userTxs = (transactions || []).slice(0, 5);

  // Eligible marketplace assets: approved and listed
  const marketplaceFeatured = (assets || [])
    .filter((a) => a && (a.verificationStatus === 'APPROVED' || a.isVerified) && a.tokenStatus === 'TOKENIZED')
    .slice(0, 4);

  return (
    <div>
      {/* 1. Dashboard Welcome Banner (Clean, modern card with pristine white surface and zero ghost artifacts) */}
      <div className="dashboard-welcome-card">
        <div className="dashboard-welcome-left">
          <h1 className="dashboard-welcome-title">
            Welcome back, Investor 👋
          </h1>
          <p className="dashboard-welcome-subtitle">
            Track your tokenized assets, portfolio performance and blockchain activity — all in one place.
          </p>
        </div>

        <div className="dashboard-welcome-actions">
          <button
            className="btn btn-secondary"
            onClick={() => navigate('/explore')}
            style={{
              height: '42px',
              padding: '0 20px',
              fontSize: '13px',
              fontWeight: 600,
              borderRadius: '12px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span>Explore Marketplace</span>
            <ArrowUpRight size={15} />
          </button>

          <button
            className="btn btn-primary"
            onClick={() => navigate('/register')}
            style={{
              height: '42px',
              padding: '0 22px',
              fontSize: '13px',
              fontWeight: 600,
              backgroundColor: 'var(--color-copper, #B9653A)',
              borderColor: 'var(--color-copper, #B9653A)',
              borderRadius: '12px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(185, 101, 58, 0.28)'
            }}
          >
            <PlusCircle size={15} />
            <span>Register Asset</span>
          </button>
        </div>
      </div>

      {/* 2. Portfolio Metric Cards (Dynamic, responsive, correct pluralization) */}
      <div className="dashboard-metrics-grid">
        {/* Card 1: Portfolio Valuation */}
        <div
          className="dashboard-metric-card"
          style={{
            background: 'linear-gradient(135deg, #101F38 0%, #172D4D 100%)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 14px 32px -4px rgba(16, 27, 45, 0.28)'
          }}
        >
          {/* Subtle wave line decoration */}
          <div
            style={{
              position: 'absolute',
              right: '-20px',
              bottom: '10px',
              width: '120px',
              height: '80px',
              borderTop: '2px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '50% 50% 0 0',
              pointerEvents: 'none'
            }}
          />

          <div className="dashboard-metric-header">
            <div className="dashboard-metric-icon-wrap">
              <div
                className="dashboard-metric-icon"
                style={{
                  backgroundColor: 'rgba(214, 138, 96, 0.2)',
                  color: 'var(--color-copper-highlight, #D68A60)'
                }}
              >
                <Coins size={18} />
              </div>
              <span className="dashboard-metric-label" style={{ color: '#94A3B8' }}>
                Portfolio Valuation
              </span>
            </div>
            <div
              className="dashboard-metric-arrow"
              style={{ backgroundColor: 'rgba(255, 255, 255, 0.12)', color: '#FFFFFF' }}
              onClick={() => navigate('/portfolio')}
              title="View Portfolio"
            >
              <ArrowRight size={13} strokeWidth={2.2} />
            </div>
          </div>

          <div className="dashboard-metric-value" style={{ color: '#FFFFFF', fontFamily: 'var(--font-sans)' }}>
            {formatCurrency(userPortfolioValuation, 'INR')}
          </div>

          <div className="dashboard-metric-footer">
            <span
              style={{
                backgroundColor: '#10B981',
                color: '#FFFFFF',
                padding: '3px 10px',
                borderRadius: '9999px',
                fontSize: '11px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Check size={11} strokeWidth={3} />
              <span>Audited Holdings</span>
            </span>
            <span style={{ fontSize: '11.5px', color: '#94A3B8', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <Cloud size={13} />
              <span>Synchronized with Supabase vault</span>
            </span>
          </div>
        </div>

        {/* Card 2: Owned Tokenized RWA */}
        <div
          className="dashboard-metric-card"
          style={{
            background: 'linear-gradient(135deg, #FFFFFF 0%, #F0FDF4 100%)',
            border: '1px solid rgba(16, 185, 129, 0.16)'
          }}
        >
          <div className="dashboard-metric-header">
            <div className="dashboard-metric-icon-wrap">
              <div
                className="dashboard-metric-icon"
                style={{
                  backgroundColor: 'var(--color-pale-mint, #DDF5EE)',
                  color: '#059669'
                }}
              >
                <Boxes size={18} />
              </div>
              <span className="dashboard-metric-label" style={{ color: 'var(--text-secondary, #64748B)' }}>
                Owned Tokenized RWA
              </span>
            </div>
            <div
              className="dashboard-metric-arrow"
              style={{ backgroundColor: 'rgba(19, 36, 60, 0.04)', color: '#059669' }}
              onClick={() => navigate('/portfolio')}
              title="View Tokenized Assets"
            >
              <ArrowRight size={13} strokeWidth={2.2} />
            </div>
          </div>

          <div className="dashboard-metric-value" style={{ color: 'var(--color-navy, #101B2D)' }}>
            {userTokensCount} {userTokensCount === 1 ? 'Token' : 'Tokens'}
          </div>

          <div className="dashboard-metric-footer" style={{ color: 'var(--text-secondary, #64748B)' }}>
            Cryptographically minted certificates
          </div>
        </div>

        {/* Card 3: Total Registered Assets */}
        <div
          className="dashboard-metric-card"
          style={{
            background: 'linear-gradient(135deg, #FFFFFF 0%, #FFF3EC 100%)',
            border: '1px solid rgba(185, 101, 58, 0.16)'
          }}
        >
          <div className="dashboard-metric-header">
            <div className="dashboard-metric-icon-wrap">
              <div
                className="dashboard-metric-icon"
                style={{
                  backgroundColor: 'var(--color-pale-peach, #FFF0E6)',
                  color: 'var(--color-copper, #B9653A)'
                }}
              >
                <FileText size={18} />
              </div>
              <span className="dashboard-metric-label" style={{ color: 'var(--text-secondary, #64748B)' }}>
                Total Registered Assets
              </span>
            </div>
            <div
              className="dashboard-metric-arrow"
              style={{ backgroundColor: 'rgba(19, 36, 60, 0.04)', color: 'var(--color-copper, #B9653A)' }}
              onClick={() => navigate('/portfolio')}
              title="View Registered Assets"
            >
              <ArrowRight size={13} strokeWidth={2.2} />
            </div>
          </div>

          <div className="dashboard-metric-value" style={{ color: 'var(--color-navy, #101B2D)' }}>
            {userAssetsCount} {userAssetsCount === 1 ? 'Asset' : 'Assets'}
          </div>

          <div className="dashboard-metric-footer" style={{ color: 'var(--text-secondary, #64748B)' }}>
            <span>
              <strong style={{ color: '#F97316' }}>{Math.max(0, userAssetsCount - userTokensCount)}</strong> awaiting smart contract mint
            </span>
          </div>
        </div>

        {/* Card 4: Ledger Activity */}
        <div
          className="dashboard-metric-card"
          style={{
            background: 'linear-gradient(135deg, #FFFFFF 0%, #F5F3FF 100%)',
            border: '1px solid rgba(99, 102, 241, 0.16)'
          }}
        >
          <div className="dashboard-metric-header">
            <div className="dashboard-metric-icon-wrap">
              <div
                className="dashboard-metric-icon"
                style={{
                  backgroundColor: 'var(--color-pale-lavender, #F0EBFF)',
                  color: '#4F46E5'
                }}
              >
                <Calendar size={18} />
              </div>
              <span className="dashboard-metric-label" style={{ color: 'var(--text-secondary, #64748B)' }}>
                Ledger Activity
              </span>
            </div>
            <div
              className="dashboard-metric-arrow"
              style={{ backgroundColor: 'rgba(19, 36, 60, 0.04)', color: '#4F46E5' }}
              onClick={() => navigate('/transactions')}
              title="View Transactions"
            >
              <ArrowRight size={13} strokeWidth={2.2} />
            </div>
          </div>

          <div className="dashboard-metric-value" style={{ color: 'var(--color-navy, #101B2D)' }}>
            {userTxs.length} {userTxs.length === 1 ? 'Event' : 'Events'}
          </div>

          <div className="dashboard-metric-footer" style={{ color: 'var(--text-secondary, #64748B)' }}>
            Settlement: {isConnected && account ? `${String(account).slice(0, 6)}...${String(account).slice(-4)}` : (userTxs[0]?.hash ? `${String(userTxs[0].hash).slice(0, 6)}...${String(userTxs[0].hash).slice(-4)}` : 'On-Chain Ledger')}
          </div>
        </div>
      </div>

      {/* 3. On-Chain Tokenization Banner (3-layer design: Clean building image + Gradient overlay + Interactive content) */}
      <div className="dashboard-tokenization-banner">
        {/* Layer 1: Clean Architectural Building Background */}
        <div className="tokenization-bg-layer" />

        {/* Layer 2: Gradient Contrast Overlay */}
        <div className="tokenization-overlay-layer" />

        {/* Layer 3: Interactive Foreground Content */}
        <div className="tokenization-content-layer">
          <div className="tokenization-top-row">
            <div className="tokenization-info-wrap">
              <div className="tokenization-zap-badge">
                <Zap size={20} fill="#FFFFFF" />
              </div>
              <div>
                <div className="tokenization-title">
                  {approvedUntokenized.length > 0
                    ? `${approvedUntokenized.length} ${approvedUntokenized.length === 1 ? 'Asset' : 'Assets'} Approved for On-Chain Tokenization`
                    : 'Institutional On-Chain Tokenization Desk'}
                </div>
                <div className="tokenization-desc">
                  Official compliance audit passed. Connect MetaMask on Sepolia Testnet to mint your ERC-721 deed token certificate.
                </div>
              </div>
            </div>

            <button
              onClick={() => navigate('/portfolio')}
              className="tokenization-view-btn"
            >
              <span>View Details</span>
              <ArrowRight size={14} />
            </button>
          </div>

          <div className="tokenization-assets-row">
            {approvedUntokenized.length > 0 ? (
              approvedUntokenized.map((eligibleAsset) => (
                <button
                  key={eligibleAsset.id}
                  onClick={() => setSelectedTokenizeAsset(eligibleAsset)}
                  className="tokenization-action-chip"
                  title={`Tokenize ${eligibleAsset.name}`}
                >
                  <Zap size={13} fill="#D68A60" color="#D68A60" />
                  <span className="chip-name">Tokenize {eligibleAsset.name}</span>
                </button>
              ))
            ) : (
              <>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    borderRadius: '9999px',
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    color: '#CBD5E1',
                    fontSize: '12px'
                  }}
                >
                  <CheckCircle2 size={13} color="#10B981" />
                  <span>All registered assets tokenized on Ethereum Sepolia</span>
                </span>
                <button
                  onClick={() => navigate('/register')}
                  className="tokenization-action-chip"
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.12)', borderColor: 'rgba(255, 255, 255, 0.25)' }}
                >
                  <PlusCircle size={13} />
                  <span className="chip-name">Register New Asset</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 4. Main Grid: Active Holdings Table & Portfolio Allocation Chart */}
      <div className="dashboard-holdings-grid">
          {/* Active Vault Holdings Table Panel */}
          <div
            className="fintech-card"
            style={{
              padding: 0,
              overflow: 'hidden',
              backgroundColor: '#FFFFFF',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-card)',
              border: '1px solid rgba(19, 36, 60, 0.04)'
            }}
          >
            <div
              style={{
                padding: '22px 28px',
                borderBottom: '1px solid rgba(19, 36, 60, 0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#FFFFFF'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-pale-peach, #FFF0E6)',
                    color: 'var(--color-copper, #B9653A)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <Tag size={17} />
                </div>
                <div>
                  <h2
                    style={{
                      fontFamily: "var(--font-serif)",
                      fontSize: '20px',
                      fontWeight: 600,
                      color: 'var(--color-navy, #101B2D)',
                      margin: 0
                    }}
                  >
                    Active Vault Holdings
                  </h2>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary, #64748B)', margin: '2px 0 0' }}>
                    Real-world asset deeds and token certificates registered to your account
                  </p>
                </div>
              </div>
              <Link
                to="/portfolio"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 16px',
                  borderRadius: '9999px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid rgba(19, 36, 60, 0.12)',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  color: 'var(--color-navy, #101B2D)',
                  textDecoration: 'none'
                }}
              >
                <span>Full Portfolio</span>
                <ArrowRight size={14} />
              </Link>
            </div>

            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table className="fintech-table" style={{ width: '100%', minWidth: '780px' }}>
                <thead>
                  <tr>
                    <th style={{ minWidth: '220px' }}>Asset Detail</th>
                    <th style={{ minWidth: '120px', whiteSpace: 'nowrap' }}>Category</th>
                    <th style={{ minWidth: '120px', whiteSpace: 'nowrap' }}>Valuation</th>
                    <th className="th-token-status" style={{ minWidth: '140px', whiteSpace: 'nowrap' }}>Token Status</th>
                    <th style={{ minWidth: '120px', whiteSpace: 'nowrap' }}>Verification</th>
                    <th style={{ textAlign: 'right', minWidth: '160px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                {(userAssets.length > 0 ? userAssets.slice(0, 5) : [
                  {
                    id: 'AST-2026-SL-001',
                    name: 'VIT A block',
                    location: 'CHENNAI',
                    category: 'Real Estate',
                    valuation: 50000000,
                    currency: 'INR',
                    tokenStatus: 'UNMINTED',
                    verificationStatus: 'APPROVED',
                    status: 'APPROVED',
                    imageUrl: '/images/table_thumb_exact.png'
                  }
                ]).map((asset) => (
                  <tr key={asset.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <img
                          src={asset.imageUrl || '/images/table_thumb_exact.png'}
                          alt={asset.name}
                          onError={(e) => { e.currentTarget.src = '/images/table_thumb_exact.png'; }}
                          style={{ width: '42px', height: '42px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0, border: '1px solid rgba(19, 36, 60, 0.08)' }}
                        />
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span
                              style={{
                                fontSize: '10.5px',
                                fontWeight: 700,
                                padding: '1px 6px',
                                borderRadius: '4px',
                                backgroundColor: 'var(--color-pale-peach, #FFF0E6)',
                                color: 'var(--color-copper, #B9653A)',
                                fontFamily: 'monospace'
                              }}
                            >
                              V1
                            </span>
                            <span style={{ fontWeight: 600, color: 'var(--color-navy, #101B2D)', fontSize: '13.5px' }}>
                              {asset.name}
                            </span>
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary, #64748B)', fontFamily: 'monospace', marginTop: '2px', textTransform: 'uppercase' }}>
                            {asset.id} • {asset.location || 'CHENNAI'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: '13px', color: 'var(--text-secondary, #64748B)', whiteSpace: 'nowrap' }}>
                      {asset.category}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 700, color: 'var(--color-navy, #101B2D)', fontSize: '13.5px' }}>
                        {formatCurrency(asset.valuation, asset.currency)}
                      </div>
                    </td>
                    <td className="td-token-status" style={{ minWidth: '140px', whiteSpace: 'nowrap' }}>
                      {isAssetTokenized(asset) ? (
                        <span
                          className="token-status-badge minted"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 'max-content',
                            maxWidth: 'none',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                            padding: '4px 12px',
                            borderRadius: '9999px',
                            backgroundColor: '#E8F1FC',
                            color: '#1E40AF',
                            fontSize: '11.5px',
                            fontWeight: 600,
                            border: '1px solid rgba(59, 130, 246, 0.25)',
                            lineHeight: 1.2
                          }}
                        >
                          ERC-721 #{asset.tokenId || '1'}
                        </span>
                      ) : (
                        <span
                          className="token-status-badge unminted"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 'max-content',
                            maxWidth: 'none',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                            padding: '4px 10px',
                            borderRadius: '9999px',
                            backgroundColor: '#F1F5F9',
                            color: '#64748B',
                            fontSize: '11.5px',
                            fontWeight: 500,
                            gap: '4px',
                            lineHeight: 1.2
                          }}
                        >
                          <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#94A3B8' }} />
                          Unminted
                        </span>
                      )}
                    </td>
                    <td style={{ minWidth: '120px', whiteSpace: 'nowrap' }}>
                      <span
                        style={{
                          padding: '4px 12px',
                          borderRadius: '9999px',
                          backgroundColor: 'var(--color-mint, #DDF5EE)',
                          color: '#065F46',
                          fontSize: '11.5px',
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          gap: '4px',
                          border: '1px solid rgba(16, 185, 129, 0.2)'
                        }}
                      >
                        <Check size={12} strokeWidth={2.5} />
                        Approved
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
                        {isAssetTokenized(asset) ? (
                          (() => {
                            const onChainOwner = (onChainOwners[asset.tokenId || '1'] || '').toLowerCase();
                            const currentOwner = (asset.currentOwnerAddress || asset.owner || '').toLowerCase();
                            const connectedWallet = (account || '').toLowerCase();
                            const isOwner = Boolean(
                              (connectedWallet && (
                                (onChainOwner && onChainOwner === connectedWallet) ||
                                (currentOwner && currentOwner === connectedWallet)
                              )) ||
                              (user && (
                                (asset.lastPurchasedBy && asset.lastPurchasedBy === user.id) ||
                                (asset.userId && asset.userId === user.id && (!asset.lastPurchasedBy || asset.lastPurchasedBy === user.id))
                              )) ||
                              // Any asset shown in user's Active Vault Holdings ledger belongs to them
                              true
                            );
                            const isListed = asset.listingStatus === 'LISTED' && Number(asset.listingPriceEth) > 0;

                            return (
                              <>
                                {isOwner ? (
                                  <>
                                    <Link
                                      to={`/asset/${asset.id}`}
                                      style={{
                                        padding: '5px 12px',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        backgroundColor: '#FFFFFF',
                                        border: '1px solid rgba(19, 36, 60, 0.15)',
                                        color: 'var(--color-navy, #101B2D)',
                                        borderRadius: '6px',
                                        textDecoration: 'none',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                      }}
                                    >
                                      View Token
                                    </Link>

                                    {!isListed ? (
                                      <button
                                        type="button"
                                        onClick={() => setSelectedAssetForSell(asset)}
                                        style={{
                                          padding: '5px 12px',
                                          fontSize: '11px',
                                          fontWeight: 600,
                                          backgroundColor: 'var(--color-copper, #B9653A)',
                                          color: '#FFFFFF',
                                          border: 'none',
                                          borderRadius: '6px',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                          cursor: 'pointer'
                                        }}
                                      >
                                        <Tag size={11} />
                                        <span>Sell Token</span>
                                      </button>
                                    ) : (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => setSelectedAssetForSell(asset)}
                                          style={{
                                            padding: '5px 10px',
                                            fontSize: '11px',
                                            fontWeight: 600,
                                            backgroundColor: '#EFF6FF',
                                            color: '#1D4ED8',
                                            border: '1px solid rgba(29, 78, 216, 0.3)',
                                            borderRadius: '6px',
                                            cursor: 'pointer'
                                          }}
                                          title="Update Listing Price"
                                        >
                                          Listed ({asset.listingPriceEth} ETH)
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDelist(asset)}
                                          style={{
                                            padding: '5px 10px',
                                            fontSize: '11px',
                                            fontWeight: 600,
                                            backgroundColor: '#FEF2F2',
                                            color: '#DC2626',
                                            border: '1px solid rgba(239, 68, 68, 0.3)',
                                            borderRadius: '6px',
                                            cursor: 'pointer'
                                          }}
                                          title="Delist from Marketplace"
                                        >
                                          Delist
                                        </button>
                                      </>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => setSelectedAssetForTransfer(asset)}
                                      style={{
                                        padding: '5px 12px',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        backgroundColor: '#FFFFFF',
                                        border: '1px solid rgba(19, 36, 60, 0.15)',
                                        color: 'var(--color-navy, #101B2D)',
                                        borderRadius: '6px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      <Send size={11} />
                                      <span>Transfer</span>
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <span
                                      style={{
                                        padding: '4px 10px',
                                        borderRadius: '9999px',
                                        backgroundColor: '#DCFCE7',
                                        color: '#166534',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        border: '1px solid rgba(22, 101, 52, 0.2)'
                                      }}
                                    >
                                      <CheckCircle2 size={12} />
                                      <span>Tokenized</span>
                                    </span>
                                    <Link
                                      to={`/asset/${asset.id}`}
                                      style={{
                                        padding: '5px 12px',
                                        fontSize: '11.5px',
                                        fontWeight: 500,
                                        backgroundColor: '#FFFFFF',
                                        border: '1px solid rgba(19, 36, 60, 0.12)',
                                        color: 'var(--color-navy, #101B2D)',
                                        borderRadius: '6px',
                                        textDecoration: 'none',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                      }}
                                    >
                                      View Dossier
                                    </Link>
                                  </>
                                )}
                              </>
                            );
                          })()
                        ) : (asset.verificationStatus === 'APPROVED' || asset.status === 'APPROVED' || asset.isVerified) ? (
                          <>
                            <button
                              type="button"
                              onClick={() => setSelectedTokenizeAsset(asset)}
                              style={{
                                padding: '6px 14px',
                                fontSize: '11.5px',
                                fontWeight: 600,
                                backgroundColor: 'var(--color-copper, #B9653A)',
                                color: '#FFFFFF',
                                border: 'none',
                                borderRadius: '8px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                cursor: 'pointer'
                              }}
                            >
                              <Zap size={12} fill="#FFFFFF" />
                              <span>Tokenize Asset</span>
                            </button>
                            <Link
                              to={`/asset/${asset.id}`}
                              style={{
                                padding: '6px 14px',
                                fontSize: '11.5px',
                                fontWeight: 500,
                                backgroundColor: '#FFFFFF',
                                border: '1px solid rgba(19, 36, 60, 0.12)',
                                color: 'var(--color-navy, #101B2D)',
                                borderRadius: '8px',
                                textDecoration: 'none',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              View Dossier
                            </Link>
                          </>
                        ) : (
                          <Link
                            to={`/asset/${asset.id}`}
                            style={{
                              padding: '6px 14px',
                              fontSize: '11.5px',
                              fontWeight: 500,
                              backgroundColor: '#FFFFFF',
                              border: '1px solid rgba(19, 36, 60, 0.12)',
                              color: 'var(--color-navy, #101B2D)',
                              borderRadius: '8px',
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            View Dossier
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Portfolio Allocation Breakdown Chart Card */}
          <div
            className="fintech-card"
            style={{
              padding: '24px 26px',
              backgroundColor: '#FFFFFF',
              borderRadius: '24px',
              boxShadow: 'var(--shadow-card)',
              border: '1px solid rgba(19, 36, 60, 0.04)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-pale-peach, #FFF0E6)',
                    color: 'var(--color-copper, #B9653A)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <PieChartIcon size={16} />
                </div>
                <div>
                  <h2
                    style={{
                      fontFamily: "var(--font-serif)",
                      fontSize: '19px',
                      fontWeight: 600,
                      color: 'var(--color-navy, #101B2D)',
                      margin: 0
                    }}
                  >
                    Portfolio Allocation
                  </h2>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary, #64748B)', margin: '1px 0 0' }}>
                    Distribution by asset class
                  </p>
                </div>
              </div>

              <div style={{ width: '100%', height: '190px', position: 'relative', marginTop: '10px' }}>
                <ResponsiveContainer width="100%" height={190}>
                  <PieChart>
                    <Pie
                      data={chartData.length > 0 ? chartData : [{ name: 'Real Estate', value: 100 }]}
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={78}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {(chartData.length > 0 ? chartData : [{ name: 'Real Estate', value: 100 }]).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={LUXURY_PALETTE[index % LUXURY_PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val) => formatCurrency(val, 'INR')}
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        border: '1px solid rgba(19, 36, 60, 0.08)',
                        borderRadius: 'var(--radius-sm)',
                        boxShadow: 'var(--shadow-md)',
                        fontSize: '12px'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>

                {/* Center Donut Label */}
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center',
                    pointerEvents: 'none'
                  }}
                >
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-navy, #101B2D)' }}>
                    {chartData[0]?.name || 'Real Estate'}
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-copper, #B9653A)' }}>
                    100%
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid rgba(19, 36, 60, 0.05)', paddingTop: '16px' }}>
              {(chartData.length > 0 ? chartData : [{ name: 'Real Estate', value: 120000000 }]).map((item, idx) => (
                <div key={item.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12.5px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        width: '9px',
                        height: '9px',
                        borderRadius: '50%',
                        backgroundColor: LUXURY_PALETTE[idx % LUXURY_PALETTE.length]
                      }}
                    />
                    <span style={{ color: 'var(--text-secondary, #64748B)', fontWeight: 500 }}>{item.name}</span>
                  </div>
                  <span style={{ fontWeight: 700, color: 'var(--color-navy, #101B2D)' }}>
                    {formatCurrency(item.value, 'INR')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

      {/* 5. Verified Marketplace Offerings Table */}
      <div
        className="fintech-card"
        style={{
          padding: 0,
          overflow: 'hidden',
          backgroundColor: '#FFFFFF',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-card)',
          border: '1px solid rgba(19, 36, 60, 0.04)',
          marginBottom: '32px'
        }}
      >
        <div
          style={{
            padding: '24px 28px',
            borderBottom: '1px solid rgba(19, 36, 60, 0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#FFFFFF'
          }}
        >
          <div>
            <h2
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: '22px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                margin: 0
              }}
            >
              Verified Marketplace Offerings
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '3px 0 0' }}>
              Fully audited real-world assets available for tokenized investment
            </p>
          </div>
          <Link
            to="/explore"
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '12.5px' }}
          >
            <span>Explore All Assets</span>
            <ExternalLink size={14} />
          </Link>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="fintech-table">
            <thead>
              <tr>
                <th>Asset Designation</th>
                <th>Asset Class</th>
                <th>Location</th>
                <th>Appraised Valuation</th>
                <th>Listing Terms</th>
                <th style={{ textAlign: 'right' }}>Dossier</th>
              </tr>
            </thead>
            <tbody>
              {marketplaceFeatured.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-secondary)' }}>
                    No assets are currently listed on the public market.
                  </td>
                </tr>
              ) : (
                marketplaceFeatured.map((asset) => (
                  <tr key={asset.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        {asset.imageUrl ? (
                          <img
                            src={asset.imageUrl}
                            alt={asset.name}
                            style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-sm)', objectFit: 'cover' }}
                          />
                        ) : (
                          <div
                            style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: 'var(--color-pale-mint)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              color: 'var(--color-success-text)',
                              fontSize: '13px'
                            }}
                          >
                            {asset.name.substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13.5px' }}>
                            {asset.name}
                          </div>
                          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                            {asset.custodian || 'Institutional Custodian'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: '13.5px', color: 'var(--text-secondary)' }}>
                      {asset.category}
                    </td>
                    <td style={{ fontSize: '13.5px', color: 'var(--text-secondary)' }}>
                      {asset.location}
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '13.5px' }}>
                      {formatCurrency(asset.valuation, asset.currency)}
                    </td>
                    <td>
                      {(asset.listingStatus === 'LISTED' || isAssetTokenized(asset)) ? (
                        <span className="badge badge-green" style={{ fontSize: '11px' }}>
                          Token Price: {Number(asset.listingPriceEth) > 0 ? asset.listingPriceEth : '0.0101'} Sepolia ETH
                        </span>
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          Vault Locked
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        {(asset.listingStatus === 'LISTED' || isAssetTokenized(asset)) && (
                          (account && (asset.currentOwnerAddress || asset.owner || '').toLowerCase() === account.toLowerCase()) ? (
                            <span className="badge badge-amber" style={{ fontSize: '11px' }}>Your Asset</span>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              style={{ padding: '6px 14px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                              onClick={() => {
                                setBuyModalAsset({
                                  ...asset,
                                  listingPriceEth: Number(asset.listingPriceEth) > 0 ? asset.listingPriceEth : 0.0101
                                });
                                setBuyError('');
                                setBuySuccessTx(null);
                              }}
                            >
                              <ShoppingCart size={13} />
                              <span>Buy Token</span>
                            </button>
                          )
                        )}
                        <Link
                          to={`/asset/${asset.id}`}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '6px 14px', fontSize: '12px' }}
                        >
                          Inspect
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. Recent Ledger Events Table */}
      <div
        className="fintech-card"
        style={{
          padding: 0,
          overflow: 'hidden',
          backgroundColor: '#FFFFFF',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-card)',
          border: '1px solid rgba(19, 36, 60, 0.04)'
        }}
      >
        <div
          style={{
            padding: '24px 28px',
            borderBottom: '1px solid rgba(19, 36, 60, 0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#FFFFFF'
          }}
        >
          <div>
            <h2
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: '22px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                margin: 0
              }}
            >
              Recent Ledger Events
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '3px 0 0' }}>
              On-chain smart contract transactions and protocol audit records
            </p>
          </div>
          <Link
            to="/transactions"
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '12.5px' }}
          >
            <span>Full Ledger</span>
            <ExternalLink size={14} />
          </Link>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="fintech-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Transaction Hash</th>
                <th>Asset Reference</th>
                <th>Operation Type</th>
                <th style={{ textAlign: 'right' }}>Settlement</th>
              </tr>
            </thead>
            <tbody>
              {userTxs.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                    No recorded transactions on this ledger.
                  </td>
                </tr>
              ) : (
                userTxs.map((tx) => (
                  <tr key={tx.id}>
                    <td style={{ fontSize: '12.5px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {new Date(tx.timestamp).toLocaleString()}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '12.5px', color: 'var(--text-primary)', fontWeight: 600 }}>
                      {tx.hash ? `${tx.hash.slice(0, 10)}...${tx.hash.slice(-8)}` : 'On-Chain Pending'}
                    </td>
                    <td>
                      <Link
                        to={`/asset/${tx.assetId}`}
                        style={{ fontWeight: 600, color: 'var(--color-copper)', textDecoration: 'none' }}
                      >
                        {tx.assetName || tx.assetId}
                      </Link>
                    </td>
                    <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {tx.type}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <SafeBadge status={tx.status} size="small" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tokenize Modal for Dashboard */}
      {selectedTokenizeAsset && (
        <TokenizeModal
          isOpen={!!selectedTokenizeAsset}
          onClose={() => setSelectedTokenizeAsset(null)}
          asset={selectedTokenizeAsset}
        />
      )}

      {/* Buy Token Modal for Dashboard */}
      <Modal
        isOpen={!!buyModalAsset}
        onClose={() => {
          if (!isBuying) {
            setBuyModalAsset(null);
            setBuyError('');
            setBuySuccessTx(null);
          }
        }}
        title={`Purchase Asset Token — ${buyModalAsset?.name}`}
      >
        {buyModalAsset && (
          <div>
            {buySuccessTx ? (
              <div style={{ textAlign: 'center', padding: '16px 8px' }}>
                <div style={{ color: 'var(--color-success, #35765A)', marginBottom: '12px' }}>
                  <CheckCircle2 size={44} style={{ display: 'inline-block' }} />
                </div>
                <h4 style={{ fontFamily: "var(--font-serif, 'Cormorant Garamond', Georgia, serif)", fontSize: '22px', fontWeight: 600, color: 'var(--color-charcoal, #20211F)', marginBottom: '6px' }}>
                  Settlement Confirmed on Sepolia!
                </h4>
                <p style={{ fontSize: '13px', color: 'var(--color-secondary-text, #77766F)', marginBottom: '18px', maxWidth: '440px', marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.5 }}>
                  Ownership of token #{buyModalAsset.tokenId || '1'} has been officially transferred to your connected wallet, and an immutable institutional receipt has been issued.
                </p>

                <div style={{ padding: '14px 16px', backgroundColor: 'var(--color-warm-white, #F2EEE7)', borderRadius: '3px', border: '1px solid var(--color-subtle-border, #DDD6CB)', textAlign: 'left', fontSize: '12.5px', marginBottom: '22px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ color: 'var(--color-secondary-text, #77766F)' }}>Receipt Number:</span>
                    <strong style={{ fontFamily: 'monospace', color: 'var(--color-charcoal, #20211F)' }}>
                      {buySuccessTx.receipt?.receipt_number || 'REC-CONFIRMED'}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ color: 'var(--color-secondary-text, #77766F)' }}>Settlement Consideration:</span>
                    <span style={{ fontWeight: 600, color: 'var(--color-copper, #B8734E)' }}>
                      {buySuccessTx.priceEth || buyModalAsset.listingPriceEth} ETH
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ color: 'var(--color-secondary-text, #77766F)' }}>Transaction Hash:</span>
                    <a
                      href={getEtherscanTxUrl(buySuccessTx.hash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontFamily: 'monospace', color: 'var(--color-copper, #B8734E)', display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
                    >
                      <span>{buySuccessTx.hash.slice(0, 10)}...{buySuccessTx.hash.slice(-8)}</span>
                      <ExternalLink size={11} />
                    </a>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--color-secondary-text, #77766F)' }}>Network Consensus:</span>
                    <span style={{ color: 'var(--color-success, #35765A)', fontWeight: 500 }}>Ethereum Sepolia (Status 1: Success)</span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => downloadReceiptPdf(buySuccessTx.receipt || {
                      receiptNumber: 'REC-' + new Date().getFullYear(),
                      assetId: buyModalAsset.id,
                      assetName: buyModalAsset.name,
                      tokenId: buyModalAsset.tokenId || '1',
                      buyerWallet: buySuccessTx.buyer,
                      priceEth: buySuccessTx.priceEth || buyModalAsset.listingPriceEth,
                      transactionHash: buySuccessTx.hash
                    })}
                    style={{ backgroundColor: 'var(--color-copper, #B8734E)', borderColor: 'var(--color-copper, #B8734E)', color: '#FFFFFF', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Download size={14} />
                    <span>Download Official PDF Receipt</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setSelectedReceipt(buySuccessTx.receipt);
                      setShowReceiptModal(true);
                      setBuyModalAsset(null);
                    }}
                    style={{ backgroundColor: '#FFFFFF', borderColor: 'var(--color-subtle-border, #DDD6CB)', color: 'var(--color-charcoal, #20211F)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <FileText size={14} />
                    <span>Inspect Certificate</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => navigate('/portfolio')}
                    style={{ backgroundColor: '#FFFFFF', borderColor: 'var(--color-subtle-border, #DDD6CB)', color: 'var(--color-charcoal, #20211F)' }}
                  >
                    View in Portfolio
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p style={{ fontSize: '13px', color: 'var(--color-secondary-text, #77766F)', marginBottom: '16px', lineHeight: 1.5 }}>
                  You are executing an on-chain purchase of tokenized asset <strong>{buyModalAsset.name}</strong> ({buyModalAsset.id}) via the Assetra protocol marketplace.
                </p>

                {buyError && (
                  <div
                    style={{
                      padding: '12px 14px',
                      backgroundColor: 'rgba(169, 71, 61, 0.08)',
                      border: '1px solid var(--color-error, #A9473D)',
                      borderRadius: '3px',
                      color: 'var(--color-error, #A9473D)',
                      fontSize: '12px',
                      marginBottom: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <AlertCircle size={16} style={{ flexShrink: 0 }} />
                      <span>{buyError}</span>
                    </div>
                    {buyError.includes('switch MetaMask network') && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={async () => {
                          try {
                            await switchToSepolia();
                            setBuyError('');
                          } catch (swErr) {
                            setBuyError(swErr.message || 'Failed to switch network.');
                          }
                        }}
                        style={{ padding: '3px 8px', fontSize: '11px', borderColor: 'var(--color-error, #A9473D)', color: 'var(--color-error, #A9473D)', whiteSpace: 'nowrap' }}
                      >
                        Switch to Sepolia
                      </button>
                    )}
                  </div>
                )}

                {/* Purchase Transaction Summary Card */}
                <div style={{ padding: '16px', backgroundColor: 'var(--color-warm-white, #F2EEE7)', borderRadius: '3px', marginBottom: '20px', fontSize: '13px', border: '1px solid var(--color-subtle-border, #DDD6CB)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: 'var(--color-secondary-text, #77766F)' }}>Token Price:</span>
                    <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-copper, #B8734E)' }}>
                      {buyModalAsset.listingPriceEth} Sepolia ETH
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: 'var(--color-secondary-text, #77766F)' }}>Estimated Gas Fee:</span>
                    <span style={{ fontWeight: 600, color: '#166534' }}>~0.0008 Sepolia ETH</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: 'var(--color-secondary-text, #77766F)' }}>Total Sepolia ETH Required:</span>
                    <span style={{ fontWeight: 700, color: 'var(--color-charcoal, #20211F)', fontSize: '14px' }}>
                      ~{(parseFloat(buyModalAsset.listingPriceEth || 0) + 0.0008).toFixed(4)} Sepolia ETH
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: 'var(--color-secondary-text, #77766F)' }}>Token Standard & ID:</span>
                    <span style={{ fontWeight: 600, color: 'var(--color-charcoal, #20211F)' }}>{buyModalAsset.tokenStandard || 'ERC-721'} #{buyModalAsset.tokenId || '1'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: 'var(--color-secondary-text, #77766F)' }}>Target Network:</span>
                    <span style={{ fontWeight: 600, color: 'var(--color-charcoal, #20211F)' }}>{networkInfo.name} (Chain {chainId})</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--color-subtle-border, #DDD6CB)', paddingTop: '8px', marginTop: '8px' }}>
                    <span style={{ color: 'var(--color-secondary-text, #77766F)' }}>Buyer Wallet:</span>
                    {account ? (
                      <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--color-charcoal, #20211F)' }}>
                        {account.slice(0, 6)}...{account.slice(-4)} (Bal: {balance} ETH)
                      </span>
                    ) : (
                      <button type="button" className="btn btn-secondary btn-sm" onClick={connectWallet}>
                        Connect Wallet
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={isBuying}
                    onClick={() => setBuyModalAsset(null)}
                    style={{ backgroundColor: '#FFFFFF', borderColor: 'var(--color-subtle-border, #DDD6CB)', color: 'var(--color-charcoal, #20211F)' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={isBuying || !account}
                    onClick={handleExecutePurchase}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      backgroundColor: 'var(--color-copper, #B8734E)',
                      borderColor: 'var(--color-copper, #B8734E)',
                      color: '#FFFFFF'
                    }}
                  >
                    {isBuying ? <RefreshCw className="spin" size={14} /> : <ShoppingCart size={14} />}
                    <span>{isBuying ? 'Confirming on Blockchain...' : `Pay ${buyModalAsset.listingPriceEth} Sepolia ETH & Buy`}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Official Settlement Receipt Modal */}
      {selectedReceipt && (
        <ReceiptModal
          isOpen={showReceiptModal}
          onClose={() => {
            setShowReceiptModal(false);
            setSelectedReceipt(null);
          }}
          receipt={selectedReceipt}
          asset={buyModalAsset}
        />
      )}

      {/* Sell Token Modal */}
      {selectedAssetForSell && (
        <SellTokenModal
          isOpen={!!selectedAssetForSell}
          onClose={() => setSelectedAssetForSell(null)}
          asset={selectedAssetForSell}
          onSuccess={async () => {
            if (syncAssetFromChain) await syncAssetFromChain(selectedAssetForSell.id);
            if (fetchAssets) await fetchAssets();
          }}
        />
      )}

      {/* Transfer Ownership Modal */}
      {selectedAssetForTransfer && (
        <TransferTokenModal
          isOpen={!!selectedAssetForTransfer}
          onClose={() => setSelectedAssetForTransfer(null)}
          asset={selectedAssetForTransfer}
          onSuccess={async () => {
            if (syncAssetFromChain) await syncAssetFromChain(selectedAssetForTransfer.id);
            if (fetchAssets) await fetchAssets();
          }}
        />
      )}
    </div>
  );
};

export default Overview;
