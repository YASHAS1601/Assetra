import React, { useState, useEffect, useCallback } from 'react';
import { useAssets } from '../context/AssetContext';
import { useWeb3 } from '../context/Web3Context';
import { useAuth } from '../context/AuthContext';
import { MetricCard } from '../components/common/MetricCard';
import { Badge } from '../components/common/Badge';
import { EmptyState } from '../components/common/EmptyState';
import { Modal } from '../components/common/Modal';
import { TokenizeModal } from '../components/blockchain/TokenizeModal';
import { ReceiptModal } from '../components/blockchain/ReceiptModal';
import { SellTokenModal } from '../components/blockchain/SellTokenModal';
import { TransferTokenModal } from '../components/blockchain/TransferTokenModal';
import { downloadReceiptPdf } from '../utils/receiptPdfGenerator';
import { formatCurrency } from '../constants/currencies';
import {
  Briefcase,
  ShieldCheck,
  Building2,
  Boxes,
  Send,
  PlusCircle,
  Copy,
  Check,
  Tag,
  ArrowUpRight,
  ExternalLink,
  Wallet,
  Globe,
  Zap,
  RefreshCw,
  FileText,
  Download
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { ethers } from 'ethers';
import {
  TOKEN_CONTRACT_ADDRESS,
  REGISTRY_CONTRACT_ADDRESS,
  MARKETPLACE_CONTRACT_ADDRESS,
  SEPOLIA_CHAIN_ID,
  isSepoliaOrLocalChainId,
  getMetaMaskProvider,
  getAssetMarketplaceContract,
  getAssetTokenContract,
  getPublicSepoliaProvider,
  getEtherscanTxUrl,
  getEtherscanAddressUrl
} from '../constants/contracts';

export const Portfolio = () => {
  const navigate = useNavigate();
  const { assets, listTokenForSale, delistToken, syncAssetFromChain, getUserReceipts, fetchAssets } = useAssets();
  const { user } = useAuth();
  const { account, isConnected, chainId, switchToSepolia } = useWeb3();

  const [selectedAssetForTransfer, setSelectedAssetForTransfer] = useState(null);
  const [selectedAssetForTokenize, setSelectedAssetForTokenize] = useState(null);
  const [recipientAddress, setRecipientAddress] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferError, setTransferError] = useState('');
  const [transferTxHash, setTransferTxHash] = useState('');
  const [transferSuccess, setTransferSuccess] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedContract, setCopiedContract] = useState({});

  // List Modal State
  const [selectedAssetForListing, setSelectedAssetForListing] = useState(null);
  const [listingPriceInput, setListingPriceInput] = useState('1.0');
  const [isListingLoading, setIsListingLoading] = useState(false);

  // On-Chain Verified Ownership Map: { [tokenId]: ownerAddress }
  const [onChainOwners, setOnChainOwners] = useState({});
  const [isVerifyingOnChain, setIsVerifyingOnChain] = useState(false);

  // Settlement Receipts State
  const [userReceipts, setUserReceipts] = useState([]);
  const [selectedReceiptForModal, setSelectedReceiptForModal] = useState(null);
  const [activePortfolioTab, setActivePortfolioTab] = useState('holdings'); // 'holdings' | 'receipts'

  // Load user's official purchase receipts from Supabase / Backend
  const loadReceipts = useCallback(async () => {
    if (getUserReceipts) {
      try {
        const rc = await getUserReceipts();
        setUserReceipts(rc || []);
      } catch (err) {
        console.warn('Failed to load user receipts:', err.message);
      }
    }
  }, [getUserReceipts]);

  useEffect(() => {
    loadReceipts();
  }, [loadReceipts]);

  // Query actual on-chain NFT ownership from Sepolia contract AssetToken.ownerOf(tokenId)
  const verifyOnChainHoldings = useCallback(async () => {
    if (!account) return;
    setIsVerifyingOnChain(true);

    try {
      const provider = getPublicSepoliaProvider();
      const tokenContract = new ethers.Contract(
        TOKEN_CONTRACT_ADDRESS,
        ['function ownerOf(uint256 tokenId) view returns (address)'],
        provider
      );

      const tokenizedAssets = assets.filter(
        a => a.tokenStatus === 'TOKENIZED' || a.status === 'TOKENIZED' || a.isTokenized || (a.tokenId && String(a.tokenId) !== '0')
      );

      const results = {};
      await Promise.all(
        tokenizedAssets.map(async (asset) => {
          const tId = asset.tokenId || '1';
          try {
            const actualOwner = await tokenContract.ownerOf(tId);
            results[tId] = actualOwner;
            // Also sync DB if there is a discrepancy with current account
            if (actualOwner.toLowerCase() === account.toLowerCase() && syncAssetFromChain) {
              syncAssetFromChain(asset.id).catch(() => {});
            }
          } catch {
            // Token might not be minted yet on this chain ID
          }
        })
      );

      setOnChainOwners(results);
    } catch (err) {
      console.warn('On-chain ownership check error:', err.message);
    } finally {
      setIsVerifyingOnChain(false);
    }
  }, [account, assets, syncAssetFromChain]);

  useEffect(() => {
    verifyOnChainHoldings();
  }, [verifyOnChainHoldings]);

  // User assets: Strictly scoped to verified owned holdings
  // Blockchain and database synchronized ownership:
  // 1. Direct on-chain NFT ownership verified on Sepolia (ownerOf)
  // 2. Matches connected wallet as current_owner_address
  // 3. Matches user's saved profile wallet
  // 4. Matches confirmed purchase history / user receipts
  // 5. Registered by user and not sold to another party
  const userAssets = assets.filter((a) => {
    if (!a) return false;
    const currentOwner = (a.currentOwnerAddress || a.owner || '').toLowerCase();
    const connectedWallet = (account || '').toLowerCase();
    const userWallet = (user?.walletAddress || '').toLowerCase();
    const tId = a.tokenId || '1';
    const onChainOwner = (onChainOwners[tId] || '').toLowerCase();

    // 1. ACTUAL ON-CHAIN NFT OWNERSHIP (Primary source of truth for tokenized assets)
    if (connectedWallet && onChainOwner && onChainOwner === connectedWallet) {
      return true;
    }

    // If on-chain owner is explicitly known and belongs to someone else, do not show in active holdings
    if (onChainOwner && connectedWallet && onChainOwner !== connectedWallet && onChainOwner !== '0x0000000000000000000000000000000000000000') {
      return false;
    }

    // 2. Direct match with connected wallet
    if (connectedWallet && currentOwner === connectedWallet) {
      return true;
    }

    // 3. Direct match with user's saved profile wallet
    if (userWallet && currentOwner === userWallet) {
      return true;
    }

    // 4. User holds a confirmed settlement receipt for this asset
    if (userReceipts.some(r => r.asset_id === a.id)) {
      return true;
    }

    // 5. Direct match with purchase history
    if (user && a.lastPurchasedBy === user.id) {
      return true;
    }

    // 6. Local submissions fallback (if not sold to someone else)
    let localSubmittedIds = [];
    try {
      const raw = localStorage.getItem('assetra_submitted_asset_ids');
      if (raw) localSubmittedIds = JSON.parse(raw);
    } catch {}
    const localIdSet = new Set(localSubmittedIds);
    if (a.id && localIdSet.has(a.id)) {
      if (currentOwner && connectedWallet && currentOwner !== connectedWallet) {
        return false;
      }
      return true;
    }

    // 6. Registered by user (untokenized or custody, not sold to someone else)
    if (user && a.userId === user.id) {
      if (a.lastPurchasedBy && a.lastPurchasedBy !== user.id) {
        return false;
      }
      return true;
    }

    return false;
  });

  const totalPortfolioValuation = userAssets.reduce((sum, a) => sum + (Number(a.valuation) || 0), 0);
  const tokenizedCount = userAssets.filter((a) => a.tokenStatus === 'TOKENIZED' || a.status === 'TOKENIZED' || a.isTokenized || (a.tokenId && String(a.tokenId) !== '0')).length;

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    if (key) {
      setCopiedContract({ ...copiedContract, [key]: true });
      setTimeout(() => setCopiedContract({ ...copiedContract, [key]: false }), 2000);
    } else {
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    }
  };

  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    if (!selectedAssetForTransfer) return;
    setTransferError('');
    setTransferSuccess(false);
    setTransferTxHash('');

    if (!ethers.isAddress(recipientAddress)) {
      setTransferError('Please enter a valid Ethereum checksum or lowercase hex address (0x...).');
      return;
    }

    if (!isConnected || !account) {
      setTransferError('Please connect your MetaMask wallet.');
      return;
    }

    setIsTransferring(true);
    try {
      const eth = getMetaMaskProvider();
      if (!eth) {
        throw new Error('MetaMask not detected.');
      }
      const provider = new ethers.BrowserProvider(eth);
      const signer = await provider.getSigner();

      const network = await provider.getNetwork();
      console.log('[Portfolio:Transfer] Detected network chainId:', network.chainId);
      if (!isSepoliaOrLocalChainId(network.chainId)) {
        throw new Error('Please switch MetaMask network to Ethereum Sepolia (Chain ID 11155111).');
      }

      const tokenContractAddress = selectedAssetForTransfer.contractAddress || TOKEN_CONTRACT_ADDRESS;
      const tokenId = selectedAssetForTransfer.tokenId || '1';

      const tokenContract = getAssetTokenContract(signer, tokenContractAddress);

      // Verify on-chain owner
      const currentTokenOwner = await tokenContract.ownerOf(tokenId);
      if (currentTokenOwner.toLowerCase() !== account.toLowerCase()) {
        throw new Error(`Your connected wallet does not own token #${tokenId} on-chain. Current on-chain owner is ${currentTokenOwner}`);
      }

      // Execute ERC-721 safeTransferFrom
      const tx = await tokenContract.safeTransferFrom(account, recipientAddress, tokenId);
      const receipt = await tx.wait(1);

      if (!receipt || receipt.status !== 1) {
        throw new Error('On-chain token transfer reverted.');
      }

      setTransferTxHash(receipt.hash);
      setTransferSuccess(true);

      // Sync updated ownership from blockchain
      if (syncAssetFromChain) {
        await syncAssetFromChain(selectedAssetForTransfer.id);
      }

      setTimeout(() => {
        setTransferSuccess(false);
        setSelectedAssetForTransfer(null);
        setRecipientAddress('');
        setTransferTxHash('');
      }, 4000);
    } catch (err) {
      console.error('Transfer error:', err);
      if (err.code === 'ACTION_REJECTED' || (err.message && err.message.toLowerCase().includes('user rejected'))) {
        setTransferError('Transaction signature was cancelled in your wallet.');
      } else {
        setTransferError(err.message || 'On-chain token transfer failed.');
      }
    } finally {
      setIsTransferring(false);
    }
  };

  const handleSaveListing = async (e) => {
    e.preventDefault();
    if (!selectedAssetForListing) return;
    const price = parseFloat(listingPriceInput);
    if (isNaN(price) || price <= 0) {
      alert('Please enter a valid listing price in ETH greater than zero.');
      return;
    }

    if (!isConnected || !account) {
      alert('Please connect your MetaMask wallet before listing.');
      return;
    }

    setIsListingLoading(true);
    try {
      const eth = getMetaMaskProvider();
      if (!eth) {
        throw new Error('MetaMask not detected.');
      }
      const provider = new ethers.BrowserProvider(eth);
      const signer = await provider.getSigner();

      const network = await provider.getNetwork();
      console.log('[Portfolio:Listing] Detected network chainId:', network.chainId);
      if (!isSepoliaOrLocalChainId(network.chainId)) {
        throw new Error('Please switch MetaMask network to Ethereum Sepolia (Chain ID 11155111).');
      }

      const marketplaceAddress = selectedAssetForListing.marketplaceContractAddress || MARKETPLACE_CONTRACT_ADDRESS;
      const tokenContractAddress = selectedAssetForListing.contractAddress || TOKEN_CONTRACT_ADDRESS;
      const tokenId = selectedAssetForListing.tokenId || '1';

      const tokenContract = getAssetTokenContract(signer, tokenContractAddress);

      // Verify on-chain owner
      const currentTokenOwner = await tokenContract.ownerOf(tokenId);
      if (currentTokenOwner.toLowerCase() !== account.toLowerCase()) {
        throw new Error(`Your wallet (${account.slice(0, 6)}...${account.slice(-4)}) does not own token #${tokenId} on-chain. Current on-chain owner is ${currentTokenOwner.slice(0, 6)}...${currentTokenOwner.slice(-4)}`);
      }

      // Check and grant ERC-721 approval for AssetMarketplace
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
      const listTx = await marketplaceContract.listItem(tokenContractAddress, tokenId, priceWei, selectedAssetForListing.id);
      const receipt = await listTx.wait(1);

      if (!receipt || receipt.status !== 1) {
        throw new Error('Listing transaction reverted on-chain.');
      }

      await listTokenForSale(selectedAssetForListing.id, price, marketplaceAddress);
      if (syncAssetFromChain) {
        await syncAssetFromChain(selectedAssetForListing.id);
      }
      setSelectedAssetForListing(null);
      alert(`Token #${tokenId} listed successfully on Sepolia for ${price} ETH!`);
    } catch (err) {
      console.error('Portfolio listing error:', err);
      if (err.code === 'ACTION_REJECTED' || (err.message && err.message.toLowerCase().includes('user rejected'))) {
        alert('Transaction signature was cancelled in your wallet.');
      } else {
        alert(`Listing failed: ${err.message}`);
      }
    } finally {
      setIsListingLoading(false);
    }
  };

  const handleDelist = async (asset) => {
    if (!asset) return;
    if (!window.confirm(`Are you sure you want to delist token #${asset.tokenId || '1'} from the marketplace smart contract?`)) {
      return;
    }
    try {
      const eth = getMetaMaskProvider();
      if (!eth) {
        throw new Error('MetaMask not detected.');
      }
      const provider = new ethers.BrowserProvider(eth);
      const signer = await provider.getSigner();

      const network = await provider.getNetwork();
      console.log('[Portfolio:Delist] Detected network chainId:', network.chainId);
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

      await delistToken(asset.id);
      if (syncAssetFromChain) {
        await syncAssetFromChain(asset.id);
      }
      alert('Asset token delisted successfully on Sepolia!');
    } catch (err) {
      console.error('Delist error:', err);
      if (err.code === 'ACTION_REJECTED' || (err.message && err.message.toLowerCase().includes('user rejected'))) {
        alert('Transaction was cancelled in your wallet.');
      } else {
        alert(`Delist failed: ${err.message}`);
      }
    }
  };

  return (
    <div>
      {/* Header */}
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
            Investor Portfolio Vault
          </h1>
          <p className="page-description" style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>
            Verified on-chain tokens, underlying asset appraisals, and cryptographic deed certificates.
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
          <span>Register New Asset</span>
        </button>
      </div>

      {/* Account Info Bar */}
      <div
        className="fintech-card"
        style={{
          padding: '22px 28px',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #101B2D 0%, #1A2E4C 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-copper-highlight)',
              boxShadow: '0 4px 12px rgba(16, 27, 45, 0.18)'
            }}
          >
            <Briefcase size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                {account ? `${account.slice(0, 10)}...${account.slice(-8)}` : (user?.walletAddress || user?.email || 'Vault Not Linked')}
              </span>
              {account && (
                <button
                  onClick={() => copyToClipboard(account)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                  title="Copy Wallet Address"
                >
                  {copiedAddress ? <Check size={14} style={{ color: 'var(--color-success)' }} /> : <Copy size={14} />}
                </button>
              )}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', gap: '12px', marginTop: '4px' }}>
              <span>{isConnected ? 'MetaMask Verified' : 'Supabase Identity'}</span>
              <span>•</span>
              <span>{userAssets.length} Holding Records</span>
              <span>•</span>
              <span>Network: {chainId ? `EVM Chain ${chainId}` : 'Ethereum Sepolia'}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Badge status={isConnected ? 'Verified' : 'Draft'}>
            <ShieldCheck size={12} />
            {isConnected ? 'On-Chain Connected' : 'Session Authenticated'}
          </Badge>
        </div>
      </div>

      {/* Portfolio Summary Metrics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '20px',
          marginBottom: '32px'
        }}
      >
        <MetricCard
          title="Vault Total Appraisal"
          value={formatCurrency(totalPortfolioValuation, 'INR')}
          subtext="Audited underlying valuation"
          icon={Building2}
          variant="navy"
        />

        <MetricCard
          title="Minted Token Certificates"
          value={`${tokenizedCount} / ${userAssets.length}`}
          indicator={tokenizedCount > 0 ? { text: 'ERC-721 Active', isPositive: true } : undefined}
          subtext="Cryptographically verified on-chain"
          icon={Boxes}
          variant="mint"
        />
      </div>

      {/* Portfolio Ledger Card with Tabbed Views */}
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
            padding: '20px 28px',
            borderBottom: '1px solid rgba(19, 36, 60, 0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '14px',
            backgroundColor: '#FFFFFF'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              type="button"
              onClick={() => setActivePortfolioTab('holdings')}
              className="btn btn-sm"
              style={{
                borderRadius: 'var(--radius-pill)',
                backgroundColor: activePortfolioTab === 'holdings' ? 'var(--color-midnight)' : '#F8FAFC',
                color: activePortfolioTab === 'holdings' ? '#FFFFFF' : 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: '13px',
                padding: '8px 18px',
                border: '1px solid ' + (activePortfolioTab === 'holdings' ? 'var(--color-midnight)' : 'rgba(19, 36, 60, 0.06)')
              }}
            >
              Vault Holdings Ledger ({userAssets.length})
            </button>
            <button
              type="button"
              onClick={() => setActivePortfolioTab('receipts')}
              className="btn btn-sm"
              style={{
                borderRadius: 'var(--radius-pill)',
                backgroundColor: activePortfolioTab === 'receipts' ? 'var(--color-midnight)' : '#F8FAFC',
                color: activePortfolioTab === 'receipts' ? '#FFFFFF' : 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: '13px',
                padding: '8px 18px',
                border: '1px solid ' + (activePortfolioTab === 'receipts' ? 'var(--color-midnight)' : 'rgba(19, 36, 60, 0.06)')
              }}
            >
              Acquisition Receipts ({userReceipts.length})
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={verifyOnChainHoldings}
              disabled={isVerifyingOnChain || !account}
              style={{
                fontSize: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title="Verify actual NFT ownership directly on Sepolia smart contract"
            >
              <RefreshCw className={isVerifyingOnChain ? 'spin' : ''} size={13} />
              <span>{isVerifyingOnChain ? 'Verifying Sepolia...' : 'Sync On-Chain Holdings'}</span>
            </button>
          </div>
        </div>

        {activePortfolioTab === 'receipts' ? (
          userReceipts.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <FileText size={36} style={{ color: 'var(--color-secondary-text, #77766F)', display: 'inline-block', marginBottom: '12px' }} />
              <h4 style={{ fontFamily: "var(--font-serif, 'Cormorant Garamond', Georgia, serif)", fontSize: '20px', fontWeight: 600, color: 'var(--color-charcoal, #20211F)', marginBottom: '4px' }}>
                No Settlement Receipts On File
              </h4>
              <p style={{ fontSize: '13px', color: 'var(--color-secondary-text, #77766F)', maxWidth: '440px', margin: '0 auto 16px' }}>
                When you purchase an approved asset on the Ethereum Sepolia marketplace, your official cryptographic deed and settlement receipt will appear here.
              </p>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => navigate('/explore')}
                style={{ backgroundColor: 'var(--color-copper, #B8734E)', borderColor: 'var(--color-copper, #B8734E)', color: '#FFFFFF' }}
              >
                Browse Marketplace Assets
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="fintech-table">
                <thead>
                  <tr>
                    <th>Receipt #</th>
                    <th>Asset & Token</th>
                    <th>Settlement Price</th>
                    <th>Transaction Hash</th>
                    <th>Network Consensus</th>
                    <th>Issued Date</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {userReceipts.map((rc) => (
                    <tr key={rc.id || rc.receipt_number}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <FileText size={16} style={{ color: 'var(--color-copper, #B8734E)' }} />
                          <div>
                            <strong style={{ fontFamily: 'monospace', fontSize: '12.5px', color: 'var(--color-charcoal, #20211F)' }}>
                              {rc.receipt_number}
                            </strong>
                            <div style={{ fontSize: '10.5px', color: 'var(--color-secondary-text, #77766F)' }}>
                              PDF-1.4 Standard
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--color-charcoal, #20211F)', fontSize: '13px' }}>
                          {rc.asset_name}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--color-copper, #B8734E)', fontWeight: 600 }}>
                          Token ID: #{rc.token_id || '1'} • {rc.asset_id}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-copper, #B8734E)' }}>
                          {rc.price_eth} {rc.currency || 'ETH'}
                        </span>
                      </td>
                      <td>
                        <a
                          href={getEtherscanTxUrl(rc.transaction_hash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontFamily: 'monospace', fontSize: '11.5px', color: 'var(--color-copper, #B8734E)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          <span>{rc.transaction_hash ? `${rc.transaction_hash.slice(0, 10)}...${rc.transaction_hash.slice(-8)}` : 'On-Chain'}</span>
                          <ExternalLink size={11} />
                        </a>
                      </td>
                      <td>
                        <span className="badge badge-green" style={{ fontSize: '10.5px' }}>
                          Sepolia Confirmed
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '12px', color: 'var(--color-charcoal, #20211F)' }}>
                          {rc.created_at ? new Date(rc.created_at).toLocaleDateString() : 'Confirmed'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setSelectedReceiptForModal(rc)}
                            style={{ backgroundColor: '#FFFFFF', borderColor: 'var(--color-subtle-border, #DDD6CB)', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <ExternalLink size={11} />
                            <span>Inspect</span>
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => downloadReceiptPdf(rc)}
                            style={{ backgroundColor: 'var(--color-copper, #B8734E)', borderColor: 'var(--color-copper, #B8734E)', color: '#FFFFFF', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Download size={11} />
                            <span>Download PDF</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : userAssets.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <Briefcase size={36} style={{ color: 'var(--color-secondary-text, #77766F)', display: 'inline-block', marginBottom: '12px' }} />
            <h4 style={{ fontFamily: "var(--font-serif, 'Cormorant Garamond', Georgia, serif)", fontSize: '20px', fontWeight: 600, color: 'var(--color-charcoal, #20211F)', marginBottom: '4px' }}>
              No Asset Tokens In Portfolio
            </h4>
            <p style={{ fontSize: '13px', color: 'var(--color-secondary-text, #77766F)', maxWidth: '440px', margin: '0 auto 16px' }}>
              You do not currently hold any tokenized real-world assets. Register a new physical asset for verification or discover approved assets in the marketplace.
            </p>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => navigate('/explore')}
              style={{ backgroundColor: 'var(--color-copper, #B8734E)', borderColor: 'var(--color-copper, #B8734E)', color: '#FFFFFF' }}
            >
              Explore Marketplace Offerings
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="fintech-table">
              <thead>
                <tr>
                  <th style={{ minWidth: '220px' }}>Asset & Deed</th>
                  <th style={{ minWidth: '140px', whiteSpace: 'nowrap' }}>Token Spec</th>
                  <th style={{ minWidth: '130px', whiteSpace: 'nowrap' }}>Underlying Valuation</th>
                  <th style={{ minWidth: '120px', whiteSpace: 'nowrap' }}>Token Terms</th>
                  <th style={{ minWidth: '140px', whiteSpace: 'nowrap' }}>Contract Reference</th>
                  <th style={{ minWidth: '110px', whiteSpace: 'nowrap' }}>Status</th>
                  <th style={{ textAlign: 'right', minWidth: '140px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {userAssets.map((asset) => {
                  const isTokenized = Boolean(
                    asset.isTokenized ||
                    asset.tokenStatus === 'TOKENIZED' ||
                    asset.status === 'TOKENIZED' ||
                    (asset.contractAddress && asset.tokenId) ||
                    (asset.tokenId && String(asset.tokenId) !== '0')
                  );
                  const isListed = asset.listingStatus === 'LISTED' && asset.listingPriceEth > 0;
                  const contractAddr = asset.contractAddress || TOKEN_CONTRACT_ADDRESS;
                  const isTokenOwner = Boolean(
                    account &&
                    (
                      (onChainOwners[asset.tokenId || '1'] && onChainOwners[asset.tokenId || '1'].toLowerCase() === account.toLowerCase()) ||
                      (asset.currentOwnerAddress && asset.currentOwnerAddress.toLowerCase() === account.toLowerCase()) ||
                      (asset.owner && asset.owner.toLowerCase() === account.toLowerCase()) ||
                      (asset.lastPurchasedBy && user && asset.lastPurchasedBy === user.id)
                    )
                  );

                  return (
                    <tr key={asset.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {asset.imageUrl ? (
                            <img
                              src={asset.imageUrl}
                              alt={asset.name}
                              style={{ width: '40px', height: '40px', borderRadius: '2px', objectFit: 'cover', border: '1px solid var(--color-subtle-border, #DDD6CB)' }}
                            />
                          ) : (
                            <div
                              style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '2px',
                                backgroundColor: 'var(--color-warm-white, #F2EEE7)',
                                border: '1px solid var(--color-subtle-border, #DDD6CB)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                color: 'var(--color-copper, #B8734E)',
                                fontSize: '14px'
                              }}
                            >
                              {asset.name.substring(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--color-charcoal, #20211F)', fontSize: '14px' }}>
                              {asset.name}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--color-secondary-text, #77766F)' }}>
                              {asset.id} • {asset.category} • {asset.location}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td style={{ minWidth: '140px', whiteSpace: 'nowrap' }}>
                        {isTokenized ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span
                              className="token-status-badge minted"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 'max-content',
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                                fontSize: '11px',
                                fontWeight: 600,
                                padding: '3px 10px',
                                borderRadius: '9999px',
                                backgroundColor: '#E8F1FC',
                                color: '#1E40AF',
                                border: '1px solid rgba(59, 130, 246, 0.25)',
                                lineHeight: 1.2
                              }}
                            >
                              {asset.tokenStandard || 'ERC-721'} #{asset.tokenId || '1'}
                            </span>
                            {Boolean(
                              (onChainOwners[asset.tokenId || '1']?.toLowerCase() === account?.toLowerCase()) ||
                              (asset.currentOwnerAddress && asset.currentOwnerAddress.toLowerCase() === account?.toLowerCase()) ||
                              (asset.owner && asset.owner.toLowerCase() === account?.toLowerCase())
                            ) && (
                              <span className="badge badge-green" style={{ fontSize: '10px', display: 'inline-flex', width: 'fit-content', whiteSpace: 'nowrap', padding: '2px 8px' }}>
                                Sepolia NFT Verified
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="badge badge-gray" style={{ fontSize: '11px', whiteSpace: 'nowrap', display: 'inline-flex' }}>
                            Off-Chain Deed
                          </span>
                        )}
                      </td>

                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--color-charcoal, #20211F)', fontSize: '13px' }}>
                          {formatCurrency(asset.valuation, asset.currency)}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--color-secondary-text, #77766F)' }}>
                          {Number(asset.totalSupply) > 1
                            ? `${formatCurrency(asset.fractionalPrice || (asset.valuation / asset.totalSupply), asset.currency)} / share (${Number(asset.totalSupply).toLocaleString()} shares)`
                            : 'Appraised Value (100% Deed)'}
                        </div>
                      </td>

                      <td>
                        {isListed ? (
                          <div>
                            <span className="badge badge-green" style={{ fontSize: '11px' }}>
                              Token Price: {asset.listingPriceEth} Sepolia ETH
                            </span>
                            <div style={{ fontSize: '11px', color: 'var(--color-secondary-text, #77766F)', marginTop: '2px' }}>
                              Open for Purchase
                            </div>
                          </div>
                        ) : isTokenized ? (
                          <div>
                            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-charcoal, #20211F)' }}>
                              Vault Custody
                            </span>
                            <div style={{ fontSize: '11px', color: 'var(--color-secondary-text, #77766F)' }}>
                              Unlisted
                            </div>
                          </div>
                        ) : (
                          <span style={{ fontSize: '12px', color: 'var(--color-secondary-text, #77766F)' }}>Awaiting Mint</span>
                        )}
                      </td>

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--color-graphite, #41413B)' }}>
                            {contractAddr.slice(0, 6)}...{contractAddr.slice(-4)}
                          </span>
                          <button
                            onClick={() => copyToClipboard(contractAddr, asset.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-secondary-text, #77766F)', padding: 0 }}
                            title="Copy Contract Address"
                          >
                            {copiedContract[asset.id] ? <Check size={12} style={{ color: 'var(--color-success, #35765A)' }} /> : <Copy size={12} />}
                          </button>
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--color-secondary-text, #77766F)' }}>
                          Sepolia Testnet
                        </div>
                      </td>

                      <td>
                        <Badge status={asset.verificationStatus || asset.status} size="small" />
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
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

                          {/* Purchase Receipt Action Button */}
                          {userReceipts.some(r => r.asset_id === asset.id) && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{
                                padding: '4px 8px',
                                fontSize: '11px',
                                backgroundColor: '#FFFFFF',
                                borderColor: 'var(--color-copper, #B8734E)',
                                color: 'var(--color-copper, #B8734E)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                              onClick={() => {
                                const rc = userReceipts.find(r => r.asset_id === asset.id);
                                setSelectedReceiptForModal(rc);
                              }}
                              title="Download Official Purchase Receipt (PDF)"
                            >
                              <FileText size={11} />
                              <span>Receipt (PDF)</span>
                            </button>
                          )}

                          {!isTokenized && (asset.verificationStatus === 'APPROVED' || asset.status === 'APPROVED') && (
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              style={{
                                padding: '4px 10px',
                                fontSize: '11px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                backgroundColor: 'var(--color-copper, #B8734E)',
                                borderColor: 'var(--color-copper, #B8734E)',
                                color: '#FFFFFF'
                              }}
                              onClick={() => setSelectedAssetForTokenize(asset)}
                            >
                              <Zap size={11} />
                              <span>Tokenize</span>
                            </button>
                          )}

                          {isTokenized && isTokenOwner && (
                            <>
                              {!isListed ? (
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  style={{
                                    padding: '4px 10px',
                                    fontSize: '11px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    backgroundColor: 'var(--color-copper, #B9653A)',
                                    borderColor: 'var(--color-copper, #B9653A)',
                                    color: '#FFFFFF'
                                  }}
                                  onClick={() => setSelectedAssetForListing(asset)}
                                >
                                  <Tag size={11} />
                                  <span>Sell</span>
                                </button>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    className="btn btn-primary btn-sm"
                                    style={{
                                      padding: '4px 8px',
                                      fontSize: '11px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      backgroundColor: 'var(--color-copper, #B9653A)',
                                      borderColor: 'var(--color-copper, #B9653A)',
                                      color: '#FFFFFF'
                                    }}
                                    onClick={() => setSelectedAssetForListing(asset)}
                                    title="Update Selling Price"
                                  >
                                    <Tag size={11} />
                                    <span>Set Price</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    style={{
                                      padding: '4px 8px',
                                      fontSize: '11px',
                                      color: 'var(--color-error, #DC2626)',
                                      borderColor: 'rgba(239, 68, 68, 0.3)'
                                    }}
                                    onClick={() => handleDelist(asset)}
                                    title="Delist from Marketplace"
                                  >
                                    Delist
                                  </button>
                                </>
                              )}

                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{
                                  padding: '4px 10px',
                                  fontSize: '11px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  backgroundColor: '#FFFFFF',
                                  borderColor: 'var(--color-subtle-border, #DDD6CB)',
                                  color: 'var(--color-charcoal, #20211F)'
                                }}
                                onClick={() => setSelectedAssetForTransfer(asset)}
                              >
                                <Send size={11} />
                                <span>Transfer</span>
                              </button>
                            </>
                          )}

                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Transfer Ownership Modal */}
      {selectedAssetForTransfer && (
        <TransferTokenModal
          isOpen={!!selectedAssetForTransfer}
          onClose={() => setSelectedAssetForTransfer(null)}
          asset={selectedAssetForTransfer}
          onTransferSuccess={() => {
            setSelectedAssetForTransfer(null);
            verifyOnChainHoldings();
            if (typeof fetchAssets === 'function') fetchAssets();
          }}
        />
      )}

      {/* Sell Token Modal */}
      {selectedAssetForListing && (
        <SellTokenModal
          isOpen={!!selectedAssetForListing}
          onClose={() => setSelectedAssetForListing(null)}
          asset={selectedAssetForListing}
          onListingSuccess={() => {
            setSelectedAssetForListing(null);
            verifyOnChainHoldings();
            if (typeof fetchAssets === 'function') fetchAssets();
          }}
        />
      )}

      {/* Tokenize Modal */}
      {selectedAssetForTokenize && (
        <TokenizeModal
          isOpen={!!selectedAssetForTokenize}
          onClose={() => setSelectedAssetForTokenize(null)}
          asset={selectedAssetForTokenize}
        />
      )}

      {/* Official Settlement Receipt Modal */}
      <ReceiptModal
        isOpen={!!selectedReceiptForModal}
        onClose={() => setSelectedReceiptForModal(null)}
        receipt={selectedReceiptForModal}
        asset={assets.find(a => a.id === selectedReceiptForModal?.asset_id)}
      />
    </div>
  );
};

export default Portfolio;
