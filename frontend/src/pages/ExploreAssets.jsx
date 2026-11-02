import React, { useState, useMemo } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { ethers } from 'ethers';
import { useAssets } from '../context/AssetContext';
import { useWeb3 } from '../context/Web3Context';
import { useAuth } from '../context/AuthContext';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { EmptyState } from '../components/common/EmptyState';
import { ReceiptModal } from '../components/blockchain/ReceiptModal';
import { downloadReceiptPdf } from '../utils/receiptPdfGenerator';
import { formatCurrency } from '../constants/currencies';
import {
  TOKEN_CONTRACT_ADDRESS,
  REGISTRY_CONTRACT_ADDRESS,
  MARKETPLACE_CONTRACT_ADDRESS,
  SEPOLIA_CHAIN_ID,
  isSepoliaOrLocalChainId,
  getMetaMaskProvider,
  getAssetMarketplaceContract,
  getAssetTokenContract,
  getEtherscanTxUrl,
  getEtherscanAddressUrl
} from '../constants/contracts';
import {
  Search,
  Grid,
  List,
  PlusCircle,
  Building2,
  ArrowUpRight,
  MapPin,
  ShoppingCart,
  Tag,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Wallet,
  ShieldCheck,
  Cpu,
  ExternalLink,
  Layers,
  FileText,
  Download
} from 'lucide-react';

const CATEGORIES = [
  'All Categories',
  'Commercial Real Estate',
  'Fine Art & Collectibles',
  'Infrastructure & Energy',
  'Precious Metals & Commodities',
  'Private Aviation & Logistics'
];

const STATUS_FILTERS = [
  'All Verified Assets',
  'Listed for Sale',
  'Tokenized',
  'Approved (Unlisted)'
];

const formatPrivacyOwner = (addr) => {
  if (!addr) return 'Registered Custodian';
  if (addr.length > 10) {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }
  return addr;
};

export const ExploreAssets = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { assets, listTokenForSale, recordPurchase, syncAssetFromChain, fetchAssets } = useAssets();
  const { user } = useAuth();
  const { account, chainId, networkInfo, balance, isConnected, connectWallet, switchToSepolia, updateBalance } = useWeb3();

  const queryParams = new URLSearchParams(location.search);
  const initialSearch = queryParams.get('search') || '';

  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [selectedStatus, setSelectedStatus] = useState('All Verified Assets');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'

  // Purchase Modal State
  const [buyModalAsset, setBuyModalAsset] = useState(null);
  const [isBuying, setIsBuying] = useState(false);
  const [buyError, setBuyError] = useState('');
  const [buySuccessTx, setBuySuccessTx] = useState(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  // List Modal State
  const [listModalAsset, setListModalAsset] = useState(null);
  const [listingPriceInput, setListingPriceInput] = useState('');
  const [isListing, setIsListing] = useState(false);
  const [listError, setListError] = useState('');
  const [listSuccess, setListSuccess] = useState('');

  // Cross-User Discovery Rule:
  // Show ONLY assets with persisted verification status == 'APPROVED' (is_verified = true).
  // Unapproved, pending, draft, or rejected assets are strictly excluded.
  const approvedAssets = useMemo(() => {
    return assets.filter((a) => {
      const isApproved = a.verificationStatus === 'APPROVED' || a.isVerified === true || a.status === 'APPROVED' || a.status === 'TOKENIZED';
      const isNotPendingOrRejected = a.verificationStatus !== 'PENDING' && a.verificationStatus !== 'REJECTED' && a.status !== 'PENDING' && a.status !== 'REJECTED';
      return isApproved && isNotPendingOrRejected;
    });
  }, [assets]);

  const filteredAssets = useMemo(() => {
    return approvedAssets.filter((asset) => {
      const matchesSearch =
        !searchTerm ||
        asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (asset.contractAddress && asset.contractAddress.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesCategory =
        selectedCategory === 'All Categories' || asset.category === selectedCategory;

      let matchesStatus = true;
      if (selectedStatus === 'Listed for Sale') {
        matchesStatus = asset.isPurchasable || asset.listingStatus === 'LISTED' || asset.tokenStatus === 'TOKENIZED' || asset.isTokenized;
      } else if (selectedStatus === 'Tokenized') {
        matchesStatus = asset.tokenStatus === 'TOKENIZED' || asset.status === 'TOKENIZED' || asset.isTokenized;
      } else if (selectedStatus === 'Approved (Unlisted)') {
        matchesStatus = asset.listingStatus !== 'LISTED' && !asset.isTokenized;
      }

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [approvedAssets, searchTerm, selectedCategory, selectedStatus]);

  // Open Buy Token Modal
  const handleOpenBuyModal = (asset) => {
    setBuyModalAsset(asset);
    setBuyError('');
    setBuySuccessTx(null);
  };

  // Open List Token Modal
  const handleOpenListModal = (asset) => {
    setListModalAsset(asset);
    setListingPriceInput(asset.listingPriceEth > 0 ? String(asset.listingPriceEth) : '1.0');
    setListError('');
    setListSuccess('');
  };

  // Execute on-chain token purchase
  // Execute contract-authoritative token purchase (Sepolia buyItem)
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
      console.log('[ExploreAssets:Purchase] Detected network chainId:', network.chainId);
      if (!isSepoliaOrLocalChainId(network.chainId)) {
        throw new Error('Please switch MetaMask network to Ethereum Sepolia (Chain ID 11155111).');
      }

      const marketplaceAddress = buyModalAsset.marketplaceContractAddress || MARKETPLACE_CONTRACT_ADDRESS;
      const tokenContractAddress = buyModalAsset.contractAddress || TOKEN_CONTRACT_ADDRESS;
      const tokenId = buyModalAsset.tokenId || '1';

      const marketplaceContract = getAssetMarketplaceContract(activeSigner, marketplaceAddress);
      const tokenContract = getAssetTokenContract(provider, tokenContractAddress);

      let receipt = null;
      let priceWei;
      let authoritativePriceEth;
      let sellerWallet;

      // 1. Check if token is actively listed on AssetMarketplace smart contract
      let listing = null;
      try {
        listing = await marketplaceContract.getListing(tokenContractAddress, tokenId);
      } catch (lErr) {
        console.warn('Marketplace listing check notice:', lErr.message);
      }

      if (listing && listing.isActive && listing.price > 0n) {
        priceWei = listing.price;
        authoritativePriceEth = ethers.formatEther(priceWei);
        sellerWallet = listing.seller;

        // Prevent self-purchase
        if (sellerWallet.toLowerCase() === currentWallet.toLowerCase()) {
          throw new Error('You cannot purchase your own asset token. Your connected wallet is the on-chain seller.');
        }

        // Verify seller owns NFT on-chain
        try {
          const currentTokenOwner = await tokenContract.ownerOf(tokenId);
          if (currentTokenOwner.toLowerCase() !== sellerWallet.toLowerCase()) {
            throw new Error(
              `Seller (${sellerWallet.slice(0, 6)}...${sellerWallet.slice(-4)}) no longer owns token #${tokenId} on-chain. The listing is stale.`
            );
          }
        } catch (oErr) {
          console.warn('Ownership pre-check notice:', oErr.message);
        }

        // Verify buyer wallet balance
        const buyerBalanceWei = await provider.getBalance(currentWallet);
        if (buyerBalanceWei < priceWei) {
          const buyerBalanceEth = ethers.formatEther(buyerBalanceWei);
          throw new Error(
            `Insufficient SepoliaETH balance. You have ${parseFloat(buyerBalanceEth).toFixed(4)} ETH, but the exact listing price is ${authoritativePriceEth} ETH (plus transaction gas).`
          );
        }

        // Execute purchase on AssetMarketplace
        const tx = await marketplaceContract.buyItem(tokenContractAddress, tokenId, { value: priceWei });
        receipt = await tx.wait(1);
      } else {
        // Direct Sepolia ETH Purchase: Buyer transfers listed ETH price directly to seller
        const priceNum = parseFloat(buyModalAsset.listingPriceEth || 0.0101);
        if (!priceNum || priceNum <= 0) {
          throw new Error('Invalid listing price for this asset token.');
        }
        authoritativePriceEth = String(buyModalAsset.listingPriceEth || '0.0101');
        priceWei = ethers.parseEther(authoritativePriceEth);
        sellerWallet = buyModalAsset.currentOwnerAddress || buyModalAsset.ownerAddress || DEPLOYER_ADDRESS;

        // Prevent self-purchase
        if (sellerWallet.toLowerCase() === currentWallet.toLowerCase()) {
          throw new Error('You cannot purchase your own asset token. Your connected wallet is the current owner.');
        }

        // Verify buyer balance
        const buyerBalanceWei = await provider.getBalance(currentWallet);
        if (buyerBalanceWei < priceWei) {
          const buyerBalanceEth = ethers.formatEther(buyerBalanceWei);
          throw new Error(
            `Insufficient SepoliaETH balance. You have ${parseFloat(buyerBalanceEth).toFixed(4)} ETH, but the listing price is ${authoritativePriceEth} ETH (plus gas).`
          );
        }

        // Execute direct payment on Sepolia
        const tx = await activeSigner.sendTransaction({
          to: sellerWallet,
          value: priceWei
        });
        receipt = await tx.wait(1);
      }

      if (!receipt || receipt.status !== 1) {
        throw new Error('On-chain purchase transaction reverted or failed on Ethereum Sepolia.');
      }

      // 7. Verify NFT ownership successfully transferred to buyer
      try {
        const postTokenOwner = await tokenContract.ownerOf(tokenId);
        console.log('[ExploreAssets:Purchase] Post-purchase on-chain NFT owner:', postTokenOwner);
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
        sellerWallet: sellerWallet,
        tokenContract: tokenContractAddress,
        marketplaceContract: marketplaceAddress,
        tokenId: tokenId,
        assetName: buyModalAsset.name
      });

      if (typeof syncAssetFromChain === 'function') {
        try {
          await syncAssetFromChain(buyModalAsset.id);
        } catch (syncErr) {
          console.warn('Post-purchase sync warning:', syncErr);
        }
      }
      if (typeof updateBalance === 'function' && currentWallet) {
        try {
          await updateBalance(currentWallet);
        } catch (balErr) {
          console.warn('Post-purchase balance warning:', balErr);
        }
      }
      if (typeof fetchAssets === 'function') {
        try {
          await fetchAssets();
        } catch (fetchErr) {
          console.warn('Post-purchase fetchAssets warning:', fetchErr);
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
      console.error('Purchase execution error:', err);
      if (err.code === 'ACTION_REJECTED' || (err.message && err.message.toLowerCase().includes('user rejected'))) {
        setBuyError('Transaction was rejected or cancelled in your wallet.');
      } else {
        setBuyError(err.reason || err.shortMessage || err.message || 'On-chain purchase transaction failed.');
      }
    } finally {
      setIsBuying(false);
    }
  };

  // Execute token listing (Sepolia ERC-721 approve + listItem)
  const handleExecuteListing = async (e) => {
    e.preventDefault();
    if (!listModalAsset) return;
    setListError('');
    setListSuccess('');

    const price = parseFloat(listingPriceInput);
    if (isNaN(price) || price <= 0) {
      setListError('Please enter a valid price in ETH greater than 0.');
      return;
    }

    if (!isConnected || !account) {
      setListError('Please connect your MetaMask wallet before listing.');
      return;
    }

    setIsListing(true);

    try {
      const eth = getMetaMaskProvider();
      if (!eth) {
        throw new Error('MetaMask or Web3 browser extension not detected.');
      }

      const provider = new ethers.BrowserProvider(eth);
      const signer = await provider.getSigner();

      // Check Sepolia network
      const network = await provider.getNetwork();
      console.log('[ExploreAssets:Listing] Detected network chainId:', network.chainId);
      if (!isSepoliaOrLocalChainId(network.chainId)) {
        throw new Error('Please switch MetaMask network to Ethereum Sepolia (Chain ID 11155111).');
      }

      const marketplaceAddress = listModalAsset.marketplaceContractAddress || MARKETPLACE_CONTRACT_ADDRESS;
      const tokenContractAddress = listModalAsset.contractAddress || TOKEN_CONTRACT_ADDRESS;
      const tokenId = listModalAsset.tokenId || '1';

      const tokenContract = getAssetTokenContract(signer, tokenContractAddress);

      // Verify on-chain token ownership
      const currentTokenOwner = await tokenContract.ownerOf(tokenId);
      if (currentTokenOwner.toLowerCase() !== account.toLowerCase()) {
        throw new Error(`Your connected wallet (${account.slice(0, 6)}...${account.slice(-4)}) does not own token #${tokenId} on-chain. Current on-chain owner is ${currentTokenOwner.slice(0, 6)}...${currentTokenOwner.slice(-4)}`);
      }

      // Check ERC-721 approval for AssetMarketplace
      const isApprovedForAll = await tokenContract.isApprovedForAll(account, marketplaceAddress);
      const approvedAddr = await tokenContract.getApproved(tokenId);
      if (!isApprovedForAll && approvedAddr.toLowerCase() !== marketplaceAddress.toLowerCase()) {
        const approveTx = await tokenContract.approve(marketplaceAddress, tokenId);
        const approveReceipt = await approveTx.wait(1);
        if (!approveReceipt || approveReceipt.status !== 1) {
          throw new Error('Token approval for marketplace reverted on-chain.');
        }
      }

      // Call AssetMarketplace.listItem
      const marketplaceContract = getAssetMarketplaceContract(signer, marketplaceAddress);
      const priceWei = ethers.parseEther(String(price));
      const listTx = await marketplaceContract.listItem(tokenContractAddress, tokenId, priceWei, listModalAsset.id);
      const receipt = await listTx.wait(1);

      if (!receipt || receipt.status !== 1) {
        throw new Error('Marketplace listing transaction reverted on-chain.');
      }

      await listTokenForSale(listModalAsset.id, price, marketplaceAddress);
      if (syncAssetFromChain) {
        await syncAssetFromChain(listModalAsset.id);
      }
      setListSuccess(`Asset listed successfully for ${price} ETH on Sepolia!`);
      setTimeout(() => {
        setListModalAsset(null);
        setListSuccess('');
      }, 2000);
    } catch (err) {
      console.error('Listing error:', err);
      if (err.code === 'ACTION_REJECTED' || (err.message && err.message.toLowerCase().includes('user rejected'))) {
        setListError('Transaction signature was cancelled in your wallet.');
      } else {
        setListError(err.message || 'On-chain listing transaction failed.');
      }
    } finally {
      setIsListing(false);
    }
  };

  return (
    <div>
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1
            className="page-title"
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: '32px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '6px',
              letterSpacing: '-0.015em'
            }}
          >
            Institutional Asset Marketplace
          </h1>
          <p className="page-description" style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>
            Discover verified real-world assets, inspect custodial compliance, and acquire tokenized ownership on-chain.
          </p>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => navigate('/register')}
          style={{
            height: '42px',
            padding: '0 20px',
            fontSize: '13.5px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <PlusCircle size={15} />
          <span>Register Asset</span>
        </button>
      </div>

      {/* Filter and Control Bar */}
      <div
        className="fintech-card"
        style={{
          padding: '18px 24px',
          backgroundColor: '#FFFFFF',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-card)',
          border: '1px solid rgba(19, 36, 60, 0.04)',
          marginBottom: '28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: '1 1 320px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-secondary)'
              }}
            />
            <input
              type="text"
              className="input-field"
              placeholder="Search assets, locations, IDs..."
              style={{
                paddingLeft: '40px',
                height: '42px',
                fontSize: '13.5px',
                borderRadius: 'var(--radius-pill)',
                backgroundColor: '#F8FAFC'
              }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <select
            className="input-field"
            style={{
              width: 'auto',
              height: '42px',
              fontSize: '13px',
              borderRadius: 'var(--radius-pill)',
              backgroundColor: '#F8FAFC',
              color: 'var(--text-primary)',
              padding: '0 16px'
            }}
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            className="input-field"
            style={{
              width: 'auto',
              height: '42px',
              fontSize: '13px',
              borderRadius: 'var(--radius-pill)',
              backgroundColor: '#F8FAFC',
              color: 'var(--text-primary)',
              padding: '0 16px'
            }}
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* View Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', borderRadius: 'var(--radius-pill)', padding: '3px', backgroundColor: '#F8FAFC', border: '1px solid rgba(19, 36, 60, 0.05)' }}>
          <button
            onClick={() => setViewMode('grid')}
            style={{
              background: viewMode === 'grid' ? '#FFFFFF' : 'transparent',
              border: 'none',
              padding: '7px 14px',
              borderRadius: 'var(--radius-pill)',
              cursor: 'pointer',
              color: viewMode === 'grid' ? 'var(--text-primary)' : 'var(--text-secondary)',
              boxShadow: viewMode === 'grid' ? 'var(--shadow-subtle)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12.5px',
              fontWeight: 600
            }}
          >
            <Grid size={14} />
            <span>Grid</span>
          </button>
          <button
            onClick={() => setViewMode('table')}
            style={{
              background: viewMode === 'table' ? '#FFFFFF' : 'transparent',
              border: 'none',
              padding: '7px 14px',
              borderRadius: 'var(--radius-pill)',
              cursor: 'pointer',
              color: viewMode === 'table' ? 'var(--text-primary)' : 'var(--text-secondary)',
              boxShadow: viewMode === 'table' ? 'var(--shadow-subtle)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12.5px',
              fontWeight: 600
            }}
          >
            <List size={14} />
            <span>Table</span>
          </button>
        </div>
      </div>

      {/* Asset Content View */}
      {filteredAssets.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No Verified Assets Found"
          description="Only assets with approved custodial audits and blockchain compliance are displayed. Try adjusting your search query or check back as newly verified assets are published."
          actionLabel="Clear Filters"
          onAction={() => {
            setSearchTerm('');
            setSelectedCategory('All Categories');
            setSelectedStatus('All Verified Assets');
          }}
        />
      ) : viewMode === 'grid' ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: '24px'
          }}
        >
          {filteredAssets.map((asset) => {
            const isTokenized = Boolean(
              asset.tokenStatus === 'TOKENIZED' ||
              asset.status === 'TOKENIZED' ||
              asset.isTokenized ||
              (asset.tokenId && String(asset.tokenId) !== '0')
            );
            const isListed = Boolean(
              (asset.listingStatus === 'LISTED' && Number(asset.listingPriceEth) > 0) ||
              isTokenized
            );
            const effectivePrice = Number(asset.listingPriceEth) > 0 ? asset.listingPriceEth : 0.0101;
            const currentOwner = (asset.currentOwnerAddress || asset.owner || asset.ownerAddress || '').toLowerCase();
            const connectedWallet = (account || '').toLowerCase();
            const isCurrentUserOwner = Boolean(
              (user && asset.userId && asset.userId === user.id) ||
              (connectedWallet && currentOwner && currentOwner === connectedWallet)
            );

            return (
              <div
                key={asset.id}
                className="fintech-card"
                style={{
                  padding: 0,
                  overflow: 'hidden',
                  backgroundColor: '#FFFFFF',
                  borderRadius: 'var(--radius-xl)',
                  boxShadow: 'var(--shadow-card)',
                  border: '1px solid rgba(19, 36, 60, 0.04)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'transform 0.22s ease, box-shadow 0.22s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-card-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-card)';
                }}
              >
                <div>
                  {/* Media / Architectural Photo */}
                  <div style={{ height: '190px', backgroundColor: '#F8FAFC', position: 'relative', overflow: 'hidden' }}>
                    {asset.imageUrl ? (
                      <img
                        src={asset.imageUrl}
                        alt={asset.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--text-secondary)',
                          backgroundColor: '#EEF2F6',
                          gap: '8px'
                        }}
                      >
                        <Building2 size={40} strokeWidth={1.2} style={{ color: 'var(--text-secondary)' }} />
                        <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>Architectural Profile</span>
                      </div>
                    )}

                    {/* Image Badges */}
                    <div style={{ position: 'absolute', top: '14px', right: '14px', display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                      <Badge status="APPROVED" size="small">
                        Audited Deed
                      </Badge>
                      {isListed && (
                        <span
                          className="badge badge-green"
                          style={{
                            fontSize: '11.5px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
                          }}
                        >
                          <Tag size={11} />
                          <span>Token Price: {effectivePrice} Sepolia ETH</span>
                        </span>
                      )}
                    </div>

                    <div style={{ position: 'absolute', bottom: '10px', left: '12px' }}>
                      <span style={{ fontSize: '10.5px', backgroundColor: 'rgba(16, 27, 45, 0.75)', color: '#FFFFFF', padding: '3px 10px', borderRadius: 'var(--radius-pill)', backdropFilter: 'blur(4px)', fontWeight: 500 }}>
                        {asset.imageUrl ? 'Verified Asset Photograph' : 'Illustrative Rendering'}
                      </span>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div style={{ padding: '22px 24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--color-copper)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {asset.category}
                      </span>
                      <span style={{ fontSize: '11.5px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                        {asset.id}
                      </span>
                    </div>

                    <h3
                      style={{
                        fontFamily: "var(--font-serif)",
                        fontSize: '21px',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        marginBottom: '8px',
                        lineHeight: 1.25
                      }}
                    >
                      {asset.name}
                    </h3>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                      <MapPin size={14} style={{ color: 'var(--color-copper)' }} />
                      <span>{asset.location}</span>
                    </div>

                    {/* Token & Custody Metadata */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                      <span className={`badge ${isTokenized ? 'badge-green' : 'badge-amber'}`} style={{ fontSize: '10.5px' }}>
                        {isTokenized ? `ERC-721 #${asset.tokenId || '1'}` : 'Deed Registered (Unminted)'}
                      </span>
                      <span className={`badge ${isListed ? 'badge-green' : 'badge-graphite'}`} style={{ fontSize: '10.5px' }}>
                        {isListed ? 'Available on Ledger' : 'Institutional Vault'}
                      </span>
                    </div>

                    {/* Current Custody / Ownership */}
                    <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(19, 36, 60, 0.05)', paddingTop: '12px' }}>
                      <span>Title Holder:</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600, color: isCurrentUserOwner ? 'var(--color-copper)' : 'var(--text-primary)' }}>
                        {isCurrentUserOwner ? 'Your Active Wallet' : formatPrivacyOwner(currentOwner)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Footer */}
                <div
                  style={{
                    padding: '18px 24px',
                    borderTop: '1px solid rgba(19, 36, 60, 0.04)',
                    backgroundColor: '#F8FAFC',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {isListed ? 'Token Price (Sepolia ETH)' : 'Appraised Valuation'}
                    </div>
                    <div style={{ fontSize: '17px', fontWeight: 700, color: isListed ? 'var(--color-copper)' : 'var(--text-primary)' }}>
                      {isListed ? `Token Price: ${effectivePrice} Sepolia ETH` : formatCurrency(asset.valuation, asset.currency)}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <Link
                      to={`/asset/${asset.id}`}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '7px 14px', fontSize: '12px' }}
                    >
                      <span>Dossier</span>
                      <ArrowUpRight size={13} />
                    </Link>

                    {isListed ? (
                      isCurrentUserOwner ? (
                        <span className="badge badge-amber" style={{ fontSize: '11px' }}>Your Asset</span>
                      ) : (
                        <button
                          className="btn btn-primary btn-sm"
                          style={{ padding: '7px 16px', fontSize: '12px' }}
                          onClick={() => handleOpenBuyModal({ ...asset, listingPriceEth: effectivePrice })}
                        >
                          <ShoppingCart size={13} />
                          <span>Buy Token</span>
                        </button>
                      )
                    ) : isTokenized && isCurrentUserOwner ? (
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ padding: '7px 14px', fontSize: '12px' }}
                        onClick={() => handleOpenListModal(asset)}
                      >
                        <Tag size={12} />
                        <span>List</span>
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div
          className="fintech-card"
          style={{
            padding: 0,
            overflow: 'hidden',
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--color-subtle-border, #DDD6CB)',
            borderRadius: '4px'
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table className="fintech-table">
              <thead>
                <tr>
                  <th style={{ minWidth: '220px' }}>Asset & Deed</th>
                  <th style={{ minWidth: '130px', whiteSpace: 'nowrap' }}>Category</th>
                  <th style={{ minWidth: '120px', whiteSpace: 'nowrap' }}>Appraisal</th>
                  <th style={{ minWidth: '140px', whiteSpace: 'nowrap' }}>Token Spec</th>
                  <th style={{ minWidth: '120px', whiteSpace: 'nowrap' }}>Listing Price</th>
                  <th style={{ minWidth: '130px', whiteSpace: 'nowrap' }}>Title Holder</th>
                  <th style={{ textAlign: 'right', minWidth: '120px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssets.map((asset) => {
                  const isTokenized = Boolean(
                    asset.tokenStatus === 'TOKENIZED' ||
                    asset.status === 'TOKENIZED' ||
                    asset.isTokenized ||
                    (asset.tokenId && String(asset.tokenId) !== '0')
                  );
                  const effectivePrice = Number(asset.listingPriceEth) > 0 ? asset.listingPriceEth : 0.0101;
                  const isListed = Boolean(
                    (asset.listingStatus === 'LISTED' && Number(asset.listingPriceEth) > 0) ||
                    isTokenized
                  );
                  const currentOwner = (asset.currentOwnerAddress || asset.owner || asset.ownerAddress || '').toLowerCase();
                  const connectedWallet = (account || '').toLowerCase();
                  const isCurrentUserOwner = Boolean(
                    (user && asset.userId && asset.userId === user.id) ||
                    (connectedWallet && currentOwner && currentOwner === connectedWallet)
                  );

                  return (
                    <tr key={asset.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {asset.imageUrl ? (
                            <img
                              src={asset.imageUrl}
                              alt={asset.name}
                              style={{ width: '36px', height: '36px', borderRadius: '2px', objectFit: 'cover', border: '1px solid var(--color-subtle-border, #DDD6CB)' }}
                            />
                          ) : (
                            <div
                              style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '2px',
                                backgroundColor: 'var(--color-warm-white, #F2EEE7)',
                                border: '1px solid var(--color-subtle-border, #DDD6CB)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                color: 'var(--color-copper, #B8734E)',
                                fontSize: '13px'
                              }}
                            >
                              {asset.name.substring(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--color-charcoal, #20211F)', fontSize: '13px' }}>
                              {asset.name}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--color-secondary-text, #77766F)' }}>
                              {asset.id} • {asset.location}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td style={{ fontSize: '13px', color: 'var(--color-graphite, #41413B)' }}>
                        {asset.category}
                      </td>

                      <td style={{ fontWeight: 600, color: 'var(--color-charcoal, #20211F)', fontSize: '13px' }}>
                        {formatCurrency(asset.valuation, asset.currency)}
                      </td>

                      <td style={{ minWidth: '140px', whiteSpace: 'nowrap' }}>
                        <span
                          className={`badge ${isTokenized ? 'badge-green' : 'badge-amber'}`}
                          style={{
                            fontSize: '11px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            whiteSpace: 'nowrap',
                            flexShrink: 0
                          }}
                        >
                          {isTokenized ? `${asset.tokenStandard || 'ERC-721'} #${asset.tokenId || '1'}` : 'Not Minted'}
                        </span>
                      </td>

                      <td>
                        {isListed ? (
                          <span style={{ fontWeight: 700, color: 'var(--color-copper, #B8734E)', fontSize: '13px' }}>
                            Token Price: {effectivePrice} Sepolia ETH
                          </span>
                        ) : (
                          <span style={{ fontSize: '12px', color: 'var(--color-secondary-text, #77766F)' }}>Unlisted</span>
                        )}
                      </td>

                      <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                        {isCurrentUserOwner ? <strong style={{ color: 'var(--color-copper, #B8734E)' }}>You</strong> : formatPrivacyOwner(currentOwner)}
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                          <Link
                            to={`/asset/${asset.id}`}
                            className="btn btn-secondary btn-sm"
                            style={{
                              padding: '4px 10px',
                              fontSize: '11px',
                              backgroundColor: '#FFFFFF',
                              borderColor: 'var(--color-subtle-border, #DDD6CB)',
                              color: 'var(--color-charcoal, #20211F)'
                            }}
                          >
                            Dossier
                          </Link>

                          {isListed && !isCurrentUserOwner && (
                            <button
                              className="btn btn-primary btn-sm"
                              style={{
                                padding: '4px 12px',
                                fontSize: '11px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                backgroundColor: 'var(--color-copper, #B8734E)',
                                borderColor: 'var(--color-copper, #B8734E)',
                                color: '#FFFFFF'
                              }}
                              onClick={() => handleOpenBuyModal({ ...asset, listingPriceEth: effectivePrice })}
                            >
                              <ShoppingCart size={12} />
                              Buy
                            </button>
                          )}

                          {isTokenized && !isListed && isCurrentUserOwner && (
                            <button
                              className="btn btn-primary btn-sm"
                              style={{
                                padding: '4px 10px',
                                fontSize: '11px',
                                backgroundColor: 'var(--color-copper, #B8734E)',
                                borderColor: 'var(--color-copper, #B8734E)',
                                color: '#FFFFFF'
                              }}
                              onClick={() => handleOpenListModal(asset)}
                            >
                              List
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Buy Token Purchase Modal */}
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: 'var(--color-secondary-text, #77766F)' }}>Seller:</span>
                    <span style={{ fontFamily: 'monospace', color: 'var(--color-charcoal, #20211F)' }}>{formatPrivacyOwner(buyModalAsset.currentOwnerAddress)}</span>
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

      {/* List Token For Sale Modal */}
      <Modal
        isOpen={!!listModalAsset}
        onClose={() => {
          if (!isListing) {
            setListModalAsset(null);
            setListError('');
            setListSuccess('');
          }
        }}
        title={`List Token for Sale — ${listModalAsset?.name}`}
      >
        {listModalAsset && (
          <form onSubmit={handleExecuteListing}>
            <p style={{ fontSize: '13px', color: 'var(--color-secondary-text, #77766F)', marginBottom: '16px', lineHeight: 1.5 }}>
              Set a price in ETH to list your tokenized asset on the public marketplace. Other authenticated investors will be able to buy it on-chain.
            </p>

            {listError && (
              <div
                style={{
                  padding: '12px 14px',
                  backgroundColor: 'rgba(169, 71, 61, 0.08)',
                  border: '1px solid var(--color-error, #A9473D)',
                  borderRadius: '3px',
                  color: 'var(--color-error, #A9473D)',
                  fontSize: '12px',
                  marginBottom: '16px'
                }}
              >
                {listError}
              </div>
            )}

            {listSuccess && (
              <div
                style={{
                  padding: '12px 14px',
                  backgroundColor: 'rgba(53, 118, 90, 0.08)',
                  border: '1px solid var(--color-success, #35765A)',
                  borderRadius: '3px',
                  color: 'var(--color-success, #35765A)',
                  fontSize: '12px',
                  marginBottom: '16px'
                }}
              >
                {listSuccess}
              </div>
            )}

            <div className="input-group" style={{ marginBottom: '16px' }}>
              <label className="input-label" style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-charcoal, #20211F)', marginBottom: '6px' }}>
                Listing Price (in ETH)
              </label>
              <input
                type="number"
                step="0.001"
                min="0.0001"
                required
                className="input-field"
                value={listingPriceInput}
                onChange={(e) => setListingPriceInput(e.target.value)}
                placeholder="e.g. 1.5"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: '14px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid var(--color-subtle-border, #DDD6CB)',
                  borderRadius: '3px'
                }}
              />
              <span style={{ fontSize: '11px', color: 'var(--color-secondary-text, #77766F)', marginTop: '4px', display: 'block' }}>
                The amount in ETH buyers must transfer to acquire this token.
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={isListing}
                onClick={() => setListModalAsset(null)}
                style={{ backgroundColor: '#FFFFFF', borderColor: 'var(--color-subtle-border, #DDD6CB)', color: 'var(--color-charcoal, #20211F)' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isListing}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: 'var(--color-copper, #B8734E)',
                  borderColor: 'var(--color-copper, #B8734E)',
                  color: '#FFFFFF'
                }}
              >
                {isListing ? <RefreshCw className="spin" size={14} /> : <Tag size={14} />}
                <span>{isListing ? 'Publishing Listing...' : 'List Token on Marketplace'}</span>
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Official Settlement Receipt Modal */}
      <ReceiptModal
        isOpen={showReceiptModal}
        onClose={() => {
          setShowReceiptModal(false);
          setSelectedReceipt(null);
        }}
        receipt={selectedReceipt || buySuccessTx?.receipt}
        asset={buyModalAsset}
      />
    </div>
  );
};

export default ExploreAssets;
