import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ethers } from 'ethers';
import { useAssets } from '../context/AssetContext';
import { useWeb3 } from '../context/Web3Context';
import { useAuth } from '../context/AuthContext';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { TokenizeModal } from '../components/blockchain/TokenizeModal';
import { ReceiptModal } from '../components/blockchain/ReceiptModal';
import { TransferTokenModal } from '../components/blockchain/TransferTokenModal';
import { SellTokenModal } from '../components/blockchain/SellTokenModal';
import { downloadReceiptPdf } from '../utils/receiptPdfGenerator';
import { downloadCertificatePdf } from '../utils/certificatePdfGenerator';
import { formatCurrency } from '../constants/currencies';
import {
  TOKEN_CONTRACT_ADDRESS,
  REGISTRY_CONTRACT_ADDRESS,
  MARKETPLACE_CONTRACT_ADDRESS,
  SEPOLIA_CHAIN_ID,
  DEPLOYER_ADDRESS,
  isSepoliaOrLocalChainId,
  getMetaMaskProvider,
  getPublicSepoliaProvider,
  getAssetMarketplaceContract,
  getAssetTokenContract,
  getEtherscanTxUrl,
  getEtherscanAddressUrl
} from '../constants/contracts';
import {
  Building2,
  MapPin,
  FileText,
  Copy,
  Check,
  ArrowLeft,
  Zap,
  Download,
  AlertCircle,
  ShieldCheck,
  ExternalLink,
  ShoppingCart,
  CheckCircle2,
  Camera,
  Trash2,
  UploadCloud,
  Tag,
  RefreshCw,
  Send
} from 'lucide-react';

export const AssetDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    getAssetById,
    tokenizeAsset,
    listTokenForSale,
    updateListingPrice,
    delistToken,
    recordPurchase,
    updateAssetImage,
    syncAssetFromChain,
    transactions,
    getAssetDocuments,
    getDocumentDownloadUrl,
    getReceiptForAsset,
    fetchAssets,
    isLoading: assetsLoading
  } = useAssets();
  const { user } = useAuth();
  const { account, chainId, networkInfo, balance, isConnected, connectWallet, switchToSepolia, updateBalance } = useWeb3();

  const asset = getAssetById(id);
  const [activeTab, setActiveTab] = useState('overview');
  const [copiedText, setCopiedText] = useState(false);

  // Live Asset Documents State
  const [assetDocs, setAssetDocs] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [docError, setDocError] = useState('');

  // Blockchain Sync State
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');

  // Fetch real documents from Supabase on tab change or mount
  useEffect(() => {
    if (asset?.id && activeTab === 'documents') {
      setLoadingDocs(true);
      setDocError('');
      getAssetDocuments(asset.id)
        .then((docs) => setAssetDocs(docs))
        .catch((err) => {
          console.warn('Failed to load asset documents:', err.message);
          setDocError(err.message);
        })
        .finally(() => setLoadingDocs(false));
    }
  }, [asset?.id, activeTab, getAssetDocuments]);

  // Synchronize on-chain data on load
  useEffect(() => {
    if (asset?.id && syncAssetFromChain) {
      syncAssetFromChain(asset.id).catch(() => {});
    }
  }, [asset?.id, syncAssetFromChain]);

  // Settlement Receipt State
  const [assetReceipt, setAssetReceipt] = useState(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // Load existing receipt for this asset
  useEffect(() => {
    if (asset?.id && getReceiptForAsset) {
      getReceiptForAsset(asset.id)
        .then((rc) => {
          if (rc) setAssetReceipt(rc);
        })
        .catch(() => {});
    }
  }, [asset?.id, getReceiptForAsset]);

  // Mint / Tokenize Modal State
  const [showTokenizeModal, setShowTokenizeModal] = useState(false);

  // Buy Modal State
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [isBuying, setIsBuying] = useState(false);
  const [buyError, setBuyError] = useState('');
  const [buySuccessTx, setBuySuccessTx] = useState(null);

  // List Modal State
  const [showListModal, setShowListModal] = useState(false);
  const [listingPriceInput, setListingPriceInput] = useState('');
  const [isListing, setIsListing] = useState(false);
  const [listError, setListError] = useState('');

  // Transfer Ownership Modal State
  const [showTransferModal, setShowTransferModal] = useState(false);

  // Delist State
  const [isDelisting, setIsDelisting] = useState(false);

  // Price Update Modal State
  const [showPriceUpdateModal, setShowPriceUpdateModal] = useState(false);
  const [newPriceInput, setNewPriceInput] = useState('');
  const [isUpdatingPrice, setIsUpdatingPrice] = useState(false);
  const [updatePriceError, setUpdatePriceError] = useState('');
  const [updatePriceSuccess, setUpdatePriceSuccess] = useState('');

  // Image Upload Modal State
  const [showImageUploadModal, setShowImageUploadModal] = useState(false);
  const [uploadedImagePreview, setUploadedImagePreview] = useState('');
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [imageUploadLoading, setImageUploadLoading] = useState(false);
  const [imageUploadError, setImageUploadError] = useState('');

  // Live On-Chain Marketplace & Ownership State (Must run unconditionally before early return)
  const [onChainListing, setOnChainListing] = useState(null);
  const [liveNftOwner, setLiveNftOwner] = useState(null);
  const [marketplaceOwner, setMarketplaceOwner] = useState(null);
  const [isGeneratingCert, setIsGeneratingCert] = useState(false);

  // Synchronize live on-chain state directly from deployed Sepolia contracts (Unconditional hook)
  useEffect(() => {
    let isCancelled = false;
    const fetchLiveState = async () => {
      try {
        const provider = getPublicSepoliaProvider();
        const tokenAddress = asset?.contractAddress || TOKEN_CONTRACT_ADDRESS;
        const marketplaceAddress = asset?.marketplaceContractAddress || MARKETPLACE_CONTRACT_ADDRESS;
        const tokenId = asset?.tokenId;

        if (tokenId && String(tokenId) !== '0') {
          // 1. Live ERC-721 ownerOf query
          try {
            const tokenContract = getAssetTokenContract(provider, tokenAddress);
            const owner = await tokenContract.ownerOf(tokenId);
            if (!isCancelled && owner) {
              setLiveNftOwner(owner);
            }
          } catch {
            // Token not yet minted or query error
          }

          // 2. Live AssetMarketplace getListing query
          try {
            const marketplaceContract = getAssetMarketplaceContract(provider, marketplaceAddress);
            const listing = await marketplaceContract.getListing(tokenAddress, tokenId);
            if (!isCancelled && listing) {
              setOnChainListing({
                seller: listing.seller,
                priceWei: listing.price,
                priceEth: ethers.formatEther(listing.price),
                isActive: Boolean(listing.isActive),
                assetId: listing.assetId
              });
            }
          } catch {
            // Not listed
          }
        }

        // 3. Live Marketplace contract owner
        try {
          const marketplaceContract = getAssetMarketplaceContract(provider, marketplaceAddress);
          const mOwner = await marketplaceContract.owner();
          if (!isCancelled && mOwner) {
            setMarketplaceOwner(mOwner);
          }
        } catch {
          // Fallback
        }
      } catch (err) {
        console.warn('Live chain status check notice:', err.message);
      }
    };

    if (asset?.id) {
      fetchLiveState();
    }

    return () => {
      isCancelled = true;
    };
  }, [asset?.id, asset?.tokenId, asset?.contractAddress, asset?.marketplaceContractAddress]);

  if (!asset) {
    if (assetsLoading) {
      return (
        <div style={{ textAlign: 'center', padding: '100px 20px', color: 'var(--color-secondary-text)' }}>
          <div className="spinner" style={{ margin: '0 auto 16px', width: '36px', height: '36px', border: '3px solid rgba(184, 115, 78, 0.2)', borderTopColor: 'var(--color-copper)', borderRadius: '50%' }} />
          <p style={{ fontSize: '14px', fontWeight: 500 }}>Loading Asset Dossier...</p>
        </div>
      );
    }
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', backgroundColor: '#FFFFFF', border: '1px solid var(--color-subtle-border, #DDD6CB)', borderRadius: '4px' }}>
        <h3 style={{ fontFamily: "var(--font-serif, 'Cormorant Garamond', Georgia, serif)", fontSize: '24px', fontWeight: 600, color: 'var(--color-charcoal, #20211F)', marginBottom: '8px' }}>
          Asset Dossier Not Located
        </h3>
        <p style={{ fontSize: '14px', color: 'var(--color-secondary-text, #77766F)', marginBottom: '20px' }}>
          No institutional record matches registry identifier <code>{id}</code>.
        </p>
        <button
          className="btn btn-primary"
          onClick={() => navigate('/explore')}
          style={{ backgroundColor: 'var(--color-copper, #B8734E)', borderColor: 'var(--color-copper, #B8734E)', color: '#FFFFFF' }}
        >
          Return to Marketplace
        </button>
      </div>
    );
  }

  const assetTransactions = transactions.filter((t) => t.assetId === asset.id);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  // Derived Token & Listing States
  const isTokenized = Boolean(
    asset.isTokenized ||
    asset.tokenStatus === 'TOKENIZED' ||
    asset.status === 'TOKENIZED' ||
    (asset.contractAddress && asset.tokenId) ||
    (asset.tokenId && String(asset.tokenId) !== '0')
  );

  // Active listing check (on-chain listing is authoritative, fallback to database)
  const isListingActive = Boolean(
    onChainListing
      ? onChainListing.isActive
      : ((asset.listingStatus === 'LISTED' && Number(asset.listingPriceEth) > 0) || isTokenized)
  );
  const isListed = isListingActive;

  const effectiveListingPriceEth = onChainListing && onChainListing.isActive && Number(onChainListing.priceEth) > 0
    ? onChainListing.priceEth
    : (Number(asset.listingPriceEth) > 0 ? String(asset.listingPriceEth) : '0.0101');

  const effectiveListingSeller = (onChainListing && onChainListing.isActive && onChainListing.seller && onChainListing.seller !== ethers.ZeroAddress)
    ? onChainListing.seller
    : (asset.listingSeller || (asset.listingStatus === 'LISTED' ? (asset.ownerAddress || asset.owner) : (asset.currentOwnerAddress || asset.ownerAddress || asset.owner || '')));

  const effectiveNftOwner = liveNftOwner || asset.currentOwnerAddress || asset.ownerAddress || asset.owner || '';
  const currentOwner = effectiveNftOwner;
  const originalRegistrant = asset.originalOwnerAddress || asset.ownerAddress || asset.owner || '';

  // Connected wallet role authorizations
  const isListingSeller = Boolean(
    account &&
    effectiveListingSeller &&
    account.toLowerCase() === effectiveListingSeller.toLowerCase()
  );

  const isMarketplaceOperator = Boolean(
    account && (
      (marketplaceOwner && account.toLowerCase() === marketplaceOwner.toLowerCase()) ||
      (DEPLOYER_ADDRESS && account.toLowerCase() === DEPLOYER_ADDRESS.toLowerCase())
    )
  );

  // Authorized to update price: ONLY listing.seller
  const isAuthorizedPriceUpdater = isListingActive && isListingSeller;

  // Authorized to delist: listing.seller OR marketplace contract owner
  const isAuthorizedDelister = isListingActive && (isListingSeller || isMarketplaceOperator);

  // Listing manager (delist or price update)
  const isAuthorizedListingManager = isListingActive && (isListingSeller || isMarketplaceOperator);

  // Live NFT owner check
  const isCurrentUserNftOwner = Boolean(
    account &&
    effectiveNftOwner &&
    account.toLowerCase() === effectiveNftOwner.toLowerCase()
  );

  // Buyer: active listing and connected wallet is NOT the seller and NOT current owner
  const isEligibleBuyer = isListingActive && (!account || (!isListingSeller && !isCurrentUserNftOwner));

  // Original registrant check
  const isOriginalRegistrant = Boolean(
    account &&
    originalRegistrant &&
    account.toLowerCase() === originalRegistrant.toLowerCase()
  );

  // Authorized to generate/download Deed Certificate:
  // Current NFT holder, original registrant, listing seller, or an account with a verified purchase receipt
  const isAuthorizedForCertificate = isTokenized && (
    isCurrentUserNftOwner ||
    isOriginalRegistrant ||
    isListingSeller ||
    Boolean(assetReceipt) ||
    (user && (user.role === 'admin' || user.role === 'auditor'))
  );

  // Handle Official Deed Certificate PDF Download
  const handleDownloadCertificate = () => {
    setIsGeneratingCert(true);
    try {
      const certData = {
        assetId: asset.id,
        assetName: asset.name,
        category: asset.category,
        location: asset.location,
        valuation: formatCurrency(asset.valuation, asset.currency),
        currency: asset.currency,
        custodian: asset.custodian || 'Assetra Institutional Vault Trust',
        appraisalDate: asset.createdAt ? new Date(asset.createdAt).toLocaleDateString() : 'Audited',
        description: asset.description,
        tokenId: String(asset.tokenId || '1'),
        tokenStandard: 'ERC-721',
        tokenContract: asset.contractAddress || TOKEN_CONTRACT_ADDRESS,
        registryContract: REGISTRY_CONTRACT_ADDRESS,
        marketplaceContract: asset.marketplaceContractAddress || MARKETPLACE_CONTRACT_ADDRESS,
        originalOwner: originalRegistrant,
        currentNftOwner: effectiveNftOwner,
        certificateHolder: account || effectiveNftOwner,
        listingStatus: isListingActive ? 'LISTED' : 'UNLISTED',
        listingPriceEth: isListingActive ? Number(effectiveListingPriceEth) : 0,
        listingSeller: effectiveListingSeller,
        transactionHash: asset.txHash || asset.transactionHash || (assetReceipt && assetReceipt.transactionHash) || '',
        ipfsHash: asset.ipfsHash || '',
        networkName: 'Ethereum Sepolia Testnet',
        chainId: String(chainId || SEPOLIA_CHAIN_ID),
        timestamp: new Date().toISOString()
      };
      downloadCertificatePdf(certData);
    } catch (err) {
      console.error('Certificate generation error:', err);
      alert('Failed to generate deed certificate: ' + err.message);
    } finally {
      setIsGeneratingCert(false);
    }
  };

  // Handle Chain State Refresh
  const handleSyncChain = async () => {
    if (!asset?.id || !syncAssetFromChain) return;
    setIsSyncing(true);
    setSyncStatus('');
    try {
      const res = await syncAssetFromChain(asset.id);
      if (res?.onChain) {
        setSyncStatus(`Refreshed from Sepolia: Status=${res.onChain.status}, Token #${res.onChain.tokenId}`);
      } else {
        setSyncStatus('Refreshed from Sepolia.');
      }
      setTimeout(() => setSyncStatus(''), 4000);
    } catch (err) {
      console.warn('Sync notice:', err.message);
      setSyncStatus(`Notice: ${err.message}`);
      setTimeout(() => setSyncStatus(''), 4000);
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle Buy Token Action (Contract-authoritative Sepolia execution)
  const handleExecutePurchase = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setBuyError('');
    setBuySuccessTx(null);

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
      setBuyError('No connected wallet detected.');
      return;
    }

    setIsBuying(true);

    try {
      const eth = getMetaMaskProvider();
      if (!eth) {
        throw new Error('MetaMask or Web3 wallet extension is required to sign the purchase transaction on Sepolia.');
      }

      const provider = new ethers.BrowserProvider(eth);
      const activeSigner = await provider.getSigner();

      // Check network
      const network = await provider.getNetwork();
      if (!isSepoliaOrLocalChainId(network.chainId)) {
        throw new Error('Please switch MetaMask network to Ethereum Sepolia (Chain ID 11155111).');
      }

      const marketplaceAddress = asset.marketplaceContractAddress || MARKETPLACE_CONTRACT_ADDRESS;
      const tokenContractAddress = asset.contractAddress || TOKEN_CONTRACT_ADDRESS;
      const tokenId = asset.tokenId || '1';

      const marketplaceContract = getAssetMarketplaceContract(activeSigner, marketplaceAddress);
      const tokenContract = getAssetTokenContract(provider, tokenContractAddress);

      // Verify listing on smart contract
      const listing = await marketplaceContract.getListing(tokenContractAddress, tokenId);
      if (!listing || !listing.isActive) {
        throw new Error(`Token #${tokenId} is not currently active for purchase on the AssetMarketplace contract.`);
      }

      const priceWei = listing.price;
      const authoritativePriceEth = ethers.formatEther(priceWei);

      // Prevent self-purchase if seller and buyer wallets are identical
      if (listing.seller.toLowerCase() === currentWallet.toLowerCase() || isListingSeller) {
        throw new Error('Your connected wallet is the seller of this token. A seller cannot purchase their own listing.');
      }

      // Verify seller still owns the NFT on-chain
      const currentTokenOwner = await tokenContract.ownerOf(tokenId);
      if (currentTokenOwner.toLowerCase() !== listing.seller.toLowerCase()) {
        throw new Error(`Seller no longer owns token #${tokenId} on-chain. The listing is stale.`);
      }

      // Check balance
      const buyerBalanceWei = await provider.getBalance(currentWallet);
      if (buyerBalanceWei < priceWei) {
        const buyerBalanceEth = ethers.formatEther(buyerBalanceWei);
        throw new Error(
          `Insufficient SepoliaETH balance. You have ${parseFloat(buyerBalanceEth).toFixed(4)} ETH, but the listing price is ${authoritativePriceEth} ETH (plus network gas).`
        );
      }

      // Execute atomic purchase on AssetMarketplace contract
      const tx = await marketplaceContract.buyItem(tokenContractAddress, tokenId, { value: priceWei });
      const receipt = await tx.wait(1);

      if (!receipt || receipt.status !== 1) {
        throw new Error('On-chain purchase transaction reverted or failed on Ethereum Sepolia.');
      }

      const gasFeeFormatted = receipt.gasUsed
        ? `${ethers.formatEther(receipt.gasUsed * (receipt.gasPrice || 1000000000n))} ETH`
        : '0.0050 ETH';

      const purchaseResult = await recordPurchase(asset.id, {
        buyerWallet: currentWallet,
        txHash: receipt.hash,
        chainId: String(chainId || SEPOLIA_CHAIN_ID),
        priceEth: authoritativePriceEth,
        blockNumber: receipt.blockNumber,
        gasFee: gasFeeFormatted,
        sellerWallet: listing.seller || effectiveListingSeller || currentOwner,
        tokenContract: tokenContractAddress,
        marketplaceContract: marketplaceAddress,
        tokenId: tokenId,
        assetName: asset.name
      });

      if (purchaseResult?.receipt) {
        setAssetReceipt(purchaseResult.receipt);
      }
      setOnChainListing({ isActive: false, seller: '' });
      setLiveNftOwner(currentWallet);

      if (typeof syncAssetFromChain === 'function') {
        try {
          await syncAssetFromChain(asset.id);
        } catch (syncErr) {
          console.warn('Post-purchase sync warning:', syncErr);
        }
      }
      if (typeof updateBalance === 'function' && currentWallet) {
        try {
          await updateBalance(currentWallet);
        } catch (balErr) {
          console.warn('Balance refresh notice:', balErr.message);
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
      console.error('Purchase error:', err);
      if (err.code === 'ACTION_REJECTED' || (err.message && err.message.toLowerCase().includes('user rejected'))) {
        setBuyError('Transaction was rejected in your wallet. You can click "Complete Purchase (Zero Gas Fees)" to settle instantly without signing gas fees.');
      } else {
        setBuyError(err.reason || err.shortMessage || err.message || 'Purchase transaction encountered an issue.');
      }
    } finally {
      setIsBuying(false);
    }
  };

  // Handle Listing Action (Sepolia ERC-721 approve + listItem)
  const handleExecuteListing = async (e) => {
    e.preventDefault();
    setListError('');
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
        throw new Error('MetaMask or Web3 extension not detected.');
      }

      const provider = new ethers.BrowserProvider(eth);
      const signer = await provider.getSigner();

      const network = await provider.getNetwork();
      console.log('[AssetDetails:Listing] Detected network chainId:', network.chainId);
      if (!isSepoliaOrLocalChainId(network.chainId)) {
        throw new Error('Please switch MetaMask network to Ethereum Sepolia (Chain ID 11155111).');
      }

      const marketplaceAddress = asset.marketplaceContractAddress || MARKETPLACE_CONTRACT_ADDRESS;
      const tokenContractAddress = asset.contractAddress || TOKEN_CONTRACT_ADDRESS;
      const tokenId = asset.tokenId || '1';

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

      // Execute listItem on AssetMarketplace
      const marketplaceContract = getAssetMarketplaceContract(signer, marketplaceAddress);
      const priceWei = ethers.parseEther(String(price));
      const listTx = await marketplaceContract.listItem(tokenContractAddress, tokenId, priceWei, asset.id);
      const receipt = await listTx.wait(1);

      if (!receipt || receipt.status !== 1) {
        throw new Error('Marketplace listing transaction reverted on-chain.');
      }

      await listTokenForSale(asset.id, price, marketplaceAddress);
      if (syncAssetFromChain) {
        await syncAssetFromChain(asset.id);
      }
      setShowListModal(false);
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

  // Handle Delisting Action (Sepolia on-chain delistItem)
  const handleExecuteDelist = async () => {
    if (!isAuthorizedDelister) {
      alert('Access Denied: Only the verified listing seller or protocol contract operator is authorized to delist this asset.');
      return;
    }
    if (!window.confirm(`Are you sure you want to delist token #${asset.tokenId || '1'} from the marketplace smart contract?`)) {
      return;
    }
    setIsDelisting(true);
    try {
      const eth = getMetaMaskProvider();
      if (!eth) {
        throw new Error('MetaMask not detected.');
      }
      const provider = new ethers.BrowserProvider(eth);
      const signer = await provider.getSigner();

      const network = await provider.getNetwork();
      console.log('[AssetDetails:Delist] Detected network chainId:', network.chainId);
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
        throw new Error('On-chain delisting transaction failed or reverted.');
      }

      await delistToken(asset.id);
      setOnChainListing({ isActive: false, seller: '' });
      if (syncAssetFromChain) {
        await syncAssetFromChain(asset.id);
      }
      alert('Asset token delisted successfully on Sepolia!');
    } catch (err) {
      console.error('Delist error:', err);
      if (err.code === 'ACTION_REJECTED' || (err.message && err.message.toLowerCase().includes('user rejected'))) {
        alert('Transaction was cancelled in your wallet.');
      } else {
        alert(`On-chain delisting failed: ${err.message}`);
      }
    } finally {
      setIsDelisting(false);
    }
  };

  // Handle Price Update Action (Sepolia on-chain updatePrice)
  const handleExecutePriceUpdate = async (e) => {
    e.preventDefault();
    setUpdatePriceError('');
    setUpdatePriceSuccess('');

    if (!isAuthorizedPriceUpdater) {
      setUpdatePriceError('Access Denied: Only the active listing seller is authorized to update the listing price.');
      return;
    }

    const newPrice = parseFloat(newPriceInput);
    if (isNaN(newPrice) || newPrice <= 0) {
      setUpdatePriceError('Please enter a valid price in ETH greater than 0.');
      return;
    }

    setIsUpdatingPrice(true);
    try {
      const eth = getMetaMaskProvider();
      if (!eth) {
        throw new Error('MetaMask not detected.');
      }
      const provider = new ethers.BrowserProvider(eth);
      const signer = await provider.getSigner();

      const network = await provider.getNetwork();
      console.log('[AssetDetails:UpdatePrice] Detected network chainId:', network.chainId);
      if (!isSepoliaOrLocalChainId(network.chainId)) {
        throw new Error('Please switch MetaMask network to Ethereum Sepolia (Chain ID 11155111).');
      }

      const marketplaceAddress = asset.marketplaceContractAddress || MARKETPLACE_CONTRACT_ADDRESS;
      const tokenContractAddress = asset.contractAddress || TOKEN_CONTRACT_ADDRESS;
      const tokenId = asset.tokenId || '1';

      const marketplaceContract = getAssetMarketplaceContract(signer, marketplaceAddress);
      const newPriceWei = ethers.parseEther(String(newPrice));
      const tx = await marketplaceContract.updatePrice(tokenContractAddress, tokenId, newPriceWei);
      const receipt = await tx.wait(1);

      if (!receipt || receipt.status !== 1) {
        throw new Error('On-chain price update failed or reverted.');
      }

      await updateListingPrice(asset.id, newPrice);
      setOnChainListing((prev) => (prev ? { ...prev, priceEth: String(newPrice), priceWei: newPriceWei } : null));
      if (syncAssetFromChain) {
        await syncAssetFromChain(asset.id);
      }

      setUpdatePriceSuccess(`Price updated to ${newPrice} ETH on Sepolia!`);
      setTimeout(() => {
        setShowPriceUpdateModal(false);
        setUpdatePriceSuccess('');
      }, 2000);
    } catch (err) {
      console.error('Price update error:', err);
      if (err.code === 'ACTION_REJECTED' || (err.message && err.message.toLowerCase().includes('user rejected'))) {
        setUpdatePriceError('Transaction was cancelled in your wallet.');
      } else {
        setUpdatePriceError(err.message || 'On-chain price update failed.');
      }
    } finally {
      setIsUpdatingPrice(false);
    }
  };

  return (
    <div>
      {/* Back Link */}
      <div style={{ marginBottom: '22px' }}>
        <button
          className="btn btn-secondary btn-sm"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#FFFFFF',
            borderRadius: '9999px',
            boxShadow: 'var(--shadow-card)',
            color: 'var(--color-midnight-navy)',
            padding: '8px 18px',
            fontSize: '13px',
            fontWeight: 600
          }}
          onClick={() => navigate('/explore')}
        >
          <ArrowLeft size={14} />
          <span>Return to Marketplace Directory</span>
        </button>
      </div>

      {/* Main Asset Header Banner */}
      <div
        style={{
          padding: '32px',
          marginBottom: '28px',
          backgroundColor: '#FFFFFF',
          borderRadius: '26px',
          boxShadow: 'var(--shadow-card)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '28px'
        }}
      >
        <div style={{ display: 'flex', gap: '24px', flex: '1 1 500px' }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            {asset.imageUrl ? (
              <img
                src={asset.imageUrl}
                alt={asset.name}
                style={{
                  width: '140px',
                  height: '140px',
                  borderRadius: '20px',
                  objectFit: 'cover'
                }}
              />
            ) : (
              <div
                style={{
                  width: '140px',
                  height: '140px',
                  borderRadius: '20px',
                  backgroundColor: 'var(--color-peach)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-copper)'
                }}
              >
                <Building2 size={52} strokeWidth={1.3} />
              </div>
            )}
            {/* Upload or Change Image button */}
            <button
              type="button"
              onClick={() => {
                setImageUploadError('');
                setUploadedImagePreview(asset.imageUrl || '');
                setImageUrlInput(asset.imageUrl || '');
                setShowImageUploadModal(true);
              }}
              style={{
                position: 'absolute',
                bottom: '8px',
                right: '8px',
                padding: '4px 10px',
                borderRadius: '9999px',
                backgroundColor: 'rgba(16, 27, 45, 0.88)',
                color: '#FFFFFF',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                backdropFilter: 'blur(4px)'
              }}
              title="Upload or update asset showcase photograph"
            >
              <Camera size={12} />
              <span>{asset.imageUrl ? 'Change' : 'Upload Image'}</span>
            </button>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
              <Badge status={asset.verificationStatus || asset.status} />
              <span
                className="token-status-badge"
                style={{
                  padding: '4px 12px',
                  borderRadius: '9999px',
                  backgroundColor: isTokenized ? 'var(--color-mint)' : 'var(--color-peach)',
                  color: isTokenized ? '#166534' : 'var(--color-copper)',
                  fontSize: '11px',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}
              >
                {isTokenized ? `ERC-721 #${asset.tokenId || '1'}` : 'Unminted Deed'}
              </span>
              {isListed && (
                <span
                  style={{
                    padding: '4px 12px',
                    borderRadius: '9999px',
                    backgroundColor: 'var(--color-mint)',
                    color: '#166534',
                    fontSize: '11px',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}
                >
                  Token Price: {effectiveListingPriceEth} Sepolia ETH
                </span>
              )}
              <span style={{ fontSize: '12px', color: 'var(--color-secondary-text)', fontWeight: 500, fontFamily: 'monospace' }}>
                ID: {asset.id}
              </span>
            </div>

            <h1
              className="font-serif"
              style={{
                fontSize: '32px',
                fontWeight: 600,
                color: 'var(--color-midnight-navy)',
                marginBottom: '8px',
                letterSpacing: '-0.02em',
                lineHeight: 1.2
              }}
            >
              {asset.name}
            </h1>

            <div style={{ display: 'flex', gap: '16px', fontSize: '13.5px', color: 'var(--color-secondary-text)', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Building2 size={15} style={{ color: 'var(--color-copper)' }} /> {asset.category}
              </span>
              <span>•</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MapPin size={15} style={{ color: 'var(--color-copper)' }} /> {asset.location}
              </span>
            </div>
          </div>
        </div>

        {/* Action Column */}
        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--color-secondary-text)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
              {isListingActive ? 'Token Price (Sepolia ETH)' : 'Appraised Asset Valuation'}
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: isListingActive ? 'var(--color-copper)' : 'var(--color-midnight-navy)', letterSpacing: '-0.02em', marginTop: '2px' }}>
              {isListingActive ? `${effectiveListingPriceEth} Sepolia ETH` : formatCurrency(asset.valuation, asset.currency)}
            </div>
            {Number(asset.totalSupply) > 1 && (
              <div style={{ fontSize: '12px', color: 'var(--color-secondary-text)', marginTop: '4px' }}>
                Unit Price: {formatCurrency(asset.fractionalPrice || (asset.valuation / asset.totalSupply), asset.currency)} / share ({Number(asset.totalSupply).toLocaleString()} shares)
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {/* If listed and eligible buyer: BUY TOKEN */}
            {isEligibleBuyer && (
              <button
                className="btn btn-primary"
                onClick={() => setShowBuyModal(true)}
                style={{ borderRadius: '9999px', padding: '10px 22px' }}
              >
                <ShoppingCart size={15} />
                <span>Buy Token ({effectiveListingPriceEth} Sepolia ETH)</span>
              </button>
            )}

            {/* If listed and authorized seller/manager: DELIST or UPDATE PRICE */}
            {isAuthorizedListingManager && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-secondary"
                  disabled={isDelisting}
                  onClick={handleExecuteDelist}
                  style={{ borderRadius: '9999px', padding: '10px 18px', color: 'var(--color-error)' }}
                >
                  <Tag size={15} />
                  <span>{isDelisting ? 'Delisting...' : 'Delist from Marketplace'}</span>
                </button>
                {isAuthorizedPriceUpdater && (
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      setNewPriceInput(String(effectiveListingPriceEth || '1.0'));
                      setShowPriceUpdateModal(true);
                    }}
                    style={{ borderRadius: '9999px', padding: '10px 18px' }}
                  >
                    <Tag size={15} />
                    <span>Update Price</span>
                  </button>
                )}
              </div>
            )}

            {/* If tokenized and unlisted and owner: SELL TOKEN */}
            {isTokenized && !isListingActive && isCurrentUserNftOwner && (
              <button
                className="btn btn-primary"
                onClick={() => {
                  setListingPriceInput(asset.listingPriceEth > 0 ? String(asset.listingPriceEth) : '0.05');
                  setShowListModal(true);
                }}
                style={{ borderRadius: '9999px', padding: '10px 22px' }}
              >
                <Tag size={15} />
                <span>Sell Token</span>
              </button>
            )}

            {/* If tokenized and verified owner: TRANSFER OWNERSHIP */}
            {isTokenized && isCurrentUserNftOwner && (
              <button
                className="btn btn-secondary"
                onClick={() => setShowTransferModal(true)}
                style={{
                  borderRadius: '9999px',
                  padding: '10px 18px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Send size={15} />
                <span>Transfer Ownership</span>
              </button>
            )}

            {/* If approved and not tokenized and original registrant: TOKENIZE */}
            {!isTokenized && (asset.verificationStatus === 'APPROVED' || (asset.status === 'APPROVED' && asset.verificationStatus !== 'PENDING')) && (isOriginalRegistrant || (user && asset.userId === user.id)) && (
              <button
                className="btn btn-primary"
                onClick={() => setShowTokenizeModal(true)}
                style={{ borderRadius: '9999px', padding: '10px 22px' }}
              >
                <Zap size={15} />
                <span>Tokenize Asset</span>
              </button>
            )}

            {/* Official Digital Deed Certificate */}
            {isTokenized && (
              <button
                className="btn btn-secondary"
                disabled={isGeneratingCert || !isAuthorizedForCertificate}
                onClick={handleDownloadCertificate}
                title={isAuthorizedForCertificate ? 'Download Official Digital Deed Certificate (PDF)' : 'Restricted to Asset Owner, Registrant, or Verified Buyer'}
                style={{
                  borderRadius: '9999px',
                  padding: '10px 18px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  opacity: isAuthorizedForCertificate ? 1 : 0.6,
                  cursor: isAuthorizedForCertificate ? 'pointer' : 'not-allowed'
                }}
              >
                <Download size={15} />
                <span>{isGeneratingCert ? 'Generating Certificate...' : 'Deed Certificate'}</span>
              </button>
            )}

            {assetReceipt && (
              <button
                className="btn btn-secondary"
                onClick={() => setShowReceiptModal(true)}
                style={{
                  borderRadius: '9999px',
                  padding: '10px 18px',
                  color: 'var(--color-copper)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <FileText size={15} />
                <span>Settlement Receipt (PDF)</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Acquisition Settlement Banner (visible to authorized buyer/owner when receipt exists) */}
      {assetReceipt && (
        <div
          style={{
            padding: '20px 28px',
            marginBottom: '26px',
            backgroundColor: 'var(--color-mint)',
            borderRadius: '22px',
            boxShadow: 'var(--shadow-card)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-copper)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                boxShadow: '0 4px 12px rgba(185, 101, 58, 0.25)'
              }}
            >
              <FileText size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--color-midnight-navy)' }}>
                  Official Settlement Receipt: {assetReceipt.receipt_number || assetReceipt.receiptNumber}
                </span>
                <span style={{ padding: '3px 10px', borderRadius: '9999px', backgroundColor: '#FFFFFF', color: '#166534', fontSize: '11px', fontWeight: 700 }}>
                  Confirmed Purchase
                </span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-secondary-text)', marginTop: '3px' }}>
                Acquired on Sepolia for {assetReceipt.price_eth || assetReceipt.priceEth} ETH • Tx: {assetReceipt.transaction_hash ? `${assetReceipt.transaction_hash.slice(0, 10)}...${assetReceipt.transaction_hash.slice(-8)}` : 'On-Chain'} • Chain ID 11155111
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowReceiptModal(true)}
              style={{ borderRadius: '9999px', padding: '8px 16px', fontSize: '12.5px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <ExternalLink size={13} />
              <span>Inspect Certificate</span>
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => downloadReceiptPdf(assetReceipt)}
              style={{ borderRadius: '9999px', padding: '8px 18px', fontSize: '12.5px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Download size={13} />
              <span>Download PDF</span>
            </button>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div
        style={{
          display: 'inline-flex',
          gap: '6px',
          padding: '6px',
          backgroundColor: '#F1F5F9',
          borderRadius: '9999px',
          marginBottom: '26px'
        }}
      >
        {[
          { id: 'overview', label: 'Asset Overview' },
          { id: 'blockchain', label: 'Blockchain & Smart Contract' },
          { id: 'transactions', label: 'Ledger Audit History' },
          { id: 'documents', label: 'Legal & Custody Documents' }
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: '8px 20px',
              fontSize: '13px',
              fontWeight: activeTab === t.id ? 600 : 500,
              color: activeTab === t.id ? 'var(--color-copper)' : 'var(--color-secondary-text)',
              backgroundColor: activeTab === t.id ? '#FFFFFF' : 'transparent',
              borderRadius: '9999px',
              border: 'none',
              boxShadow: activeTab === t.id ? '0 2px 6px rgba(0, 0, 0, 0.05)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
          <div
            style={{
              padding: '32px',
              backgroundColor: '#FFFFFF',
              borderRadius: '24px',
              boxShadow: 'var(--shadow-card)'
            }}
          >
            <h2
              className="font-serif"
              style={{
                fontSize: '22px',
                fontWeight: 600,
                color: 'var(--color-midnight-navy)',
                marginBottom: '14px'
              }}
            >
              Description & Physical Specifications
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--color-secondary-text)', lineHeight: 1.7, marginBottom: '28px' }}>
              {asset.description || 'No detailed specifications supplied for this asset.'}
            </p>

            <h2
              className="font-serif"
              style={{
                fontSize: '22px',
                fontWeight: 600,
                color: 'var(--color-midnight-navy)',
                marginBottom: '16px'
              }}
            >
              Appraisal & Custody Verification
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '13px' }}>
              <div style={{ padding: '18px 20px', backgroundColor: '#F8FAFC', borderRadius: '18px' }}>
                <span style={{ color: 'var(--color-secondary-text)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Custodial Entity</span>
                <div style={{ fontWeight: 600, color: 'var(--color-midnight-navy)', marginTop: '4px', fontSize: '14.5px' }}>{asset.custodian || 'Independent Institutional Custodian'}</div>
              </div>
              <div style={{ padding: '18px 20px', backgroundColor: '#F8FAFC', borderRadius: '18px' }}>
                <span style={{ color: 'var(--color-secondary-text)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Official Appraisal Date</span>
                <div style={{ fontWeight: 600, color: 'var(--color-midnight-navy)', marginTop: '4px', fontSize: '14.5px' }}>{asset.appraisalDate || 'Verified upon Registration'}</div>
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '32px',
              backgroundColor: '#FFFFFF',
              borderRadius: '24px',
              boxShadow: 'var(--shadow-card)'
            }}
          >
            <h2
              className="font-serif"
              style={{
                fontSize: '22px',
                fontWeight: 600,
                color: 'var(--color-midnight-navy)',
                marginBottom: '20px'
              }}
            >
              Asset Dossier Summary
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(0, 0, 0, 0.05)', paddingBottom: '12px' }}>
                <span style={{ color: 'var(--color-secondary-text)' }}>Asset Identifier</span>
                <span style={{ fontWeight: 600, fontFamily: 'monospace', color: 'var(--color-midnight-navy)' }}>{asset.id}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(0, 0, 0, 0.05)', paddingBottom: '12px' }}>
                <span style={{ color: 'var(--color-secondary-text)' }}>Underlying Valuation</span>
                <span style={{ fontWeight: 600, color: 'var(--color-midnight-navy)' }}>{formatCurrency(asset.valuation, asset.currency)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(0, 0, 0, 0.05)', paddingBottom: '12px' }}>
                <span style={{ color: 'var(--color-secondary-text)' }}>Token Supply & Unit Price</span>
                <span style={{ fontWeight: 600, color: 'var(--color-midnight-navy)' }}>
                  {Number(asset.totalSupply) > 1
                    ? `${Number(asset.totalSupply).toLocaleString()} shares @ ${formatCurrency(asset.fractionalPrice || (asset.valuation / asset.totalSupply), asset.currency)}`
                    : `1 Unit (Full Deed)`}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(0, 0, 0, 0.05)', paddingBottom: '12px' }}>
                <span style={{ color: 'var(--color-secondary-text)' }}>Compliance Audit</span>
                <Badge status={asset.verificationStatus || asset.status} size="small" />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(0, 0, 0, 0.05)', paddingBottom: '12px' }}>
                <span style={{ color: 'var(--color-secondary-text)' }}>Tokenization Status</span>
                <span style={{ fontWeight: 600, color: 'var(--color-midnight-navy)' }}>{isTokenized ? 'Tokenized (ERC-721)' : 'Not Tokenized'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(0, 0, 0, 0.05)', paddingBottom: '12px' }}>
                <span style={{ color: 'var(--color-secondary-text)' }}>Marketplace Status</span>
                <span style={{ fontWeight: 600, color: isListingActive ? 'var(--color-copper)' : 'var(--color-midnight-navy)' }}>
                  {isListingActive ? `Token Price: ${effectiveListingPriceEth} Sepolia ETH` : 'Unlisted'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(0, 0, 0, 0.05)', paddingBottom: '12px' }}>
                <span style={{ color: 'var(--color-secondary-text)' }}>Live NFT Holder</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 600, color: isCurrentUserNftOwner ? 'var(--color-copper)' : 'var(--color-midnight-navy)' }}>
                  {isCurrentUserNftOwner ? 'Your Active Wallet' : (effectiveNftOwner ? `${effectiveNftOwner.slice(0, 6)}...${effectiveNftOwner.slice(-4)}` : 'Not Minted')}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-secondary-text)' }}>Original Registrant</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 600, color: isOriginalRegistrant ? 'var(--color-copper)' : 'var(--color-midnight-navy)' }}>
                  {isOriginalRegistrant ? 'Your Active Wallet' : (originalRegistrant ? `${originalRegistrant.slice(0, 6)}...${originalRegistrant.slice(-4)}` : 'Institutional Registrant')}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Blockchain & Smart Contract */}
      {activeTab === 'blockchain' && (
        <div
          style={{
            padding: '32px',
            backgroundColor: '#FFFFFF',
            borderRadius: '24px',
            boxShadow: 'var(--shadow-card)'
          }}
        >
          <h2
            className="font-serif"
            style={{
              fontSize: '22px',
              fontWeight: 600,
              color: 'var(--color-midnight-navy)',
              marginBottom: '20px'
            }}
          >
            On-Chain Smart Contract & Marketplace Parameters
          </h2>

          {isTokenized ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Deployed Sepolia Contracts */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                <div style={{ padding: '18px 20px', backgroundColor: '#F8FAFC', borderRadius: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-secondary-text)', fontWeight: 600 }}>AssetRegistry Contract</span>
                    <a href={getEtherscanAddressUrl(REGISTRY_CONTRACT_ADDRESS)} target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: 'var(--color-copper)', display: 'inline-flex', alignItems: 'center', gap: '3px', textDecoration: 'none' }}>
                      <span>Etherscan</span><ExternalLink size={10} />
                    </a>
                  </div>
                  <code style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-midnight-navy)', wordBreak: 'break-all' }}>{REGISTRY_CONTRACT_ADDRESS}</code>
                </div>

                <div style={{ padding: '18px 20px', backgroundColor: '#F8FAFC', borderRadius: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-secondary-text)', fontWeight: 600 }}>AssetToken (ERC-721)</span>
                    <a href={getEtherscanAddressUrl(asset.contractAddress || TOKEN_CONTRACT_ADDRESS)} target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: 'var(--color-copper)', display: 'inline-flex', alignItems: 'center', gap: '3px', textDecoration: 'none' }}>
                      <span>Etherscan</span><ExternalLink size={10} />
                    </a>
                  </div>
                  <code style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-midnight-navy)', wordBreak: 'break-all' }}>{asset.contractAddress || TOKEN_CONTRACT_ADDRESS}</code>
                </div>

                <div style={{ padding: '18px 20px', backgroundColor: '#F8FAFC', borderRadius: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-secondary-text)', fontWeight: 600 }}>AssetMarketplace</span>
                    <a href={getEtherscanAddressUrl(asset.marketplaceContractAddress || MARKETPLACE_CONTRACT_ADDRESS)} target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: 'var(--color-copper)', display: 'inline-flex', alignItems: 'center', gap: '3px', textDecoration: 'none' }}>
                      <span>Etherscan</span><ExternalLink size={10} />
                    </a>
                  </div>
                  <code style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-midnight-navy)', wordBreak: 'break-all' }}>{asset.marketplaceContractAddress || MARKETPLACE_CONTRACT_ADDRESS}</code>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div style={{ padding: '18px 20px', backgroundColor: '#F8FAFC', borderRadius: '18px' }}>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-secondary-text)', fontWeight: 600 }}>Token Standard & ID</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-copper)', marginTop: '4px', whiteSpace: 'nowrap' }}>
                    {asset.tokenStandard || 'ERC-721'} #{asset.tokenId || '1'}
                  </div>
                </div>

                <div style={{ padding: '18px 20px', backgroundColor: '#F8FAFC', borderRadius: '18px' }}>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-secondary-text)', fontWeight: 600 }}>Blockchain Network</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-midnight-navy)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#166534' }} />
                    <span>Sepolia Testnet (11155111)</span>
                  </div>
                </div>

                <div style={{ padding: '18px 20px', backgroundColor: '#F8FAFC', borderRadius: '18px' }}>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-secondary-text)', fontWeight: 600 }}>Marketplace State</div>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: isListed ? 'var(--color-copper)' : 'var(--color-midnight-navy)', marginTop: '4px' }}>
                    {isListed ? `Token Price: ${effectiveListingPriceEth} Sepolia ETH` : 'Unlisted'}
                  </div>
                </div>
              </div>

              {(asset.txHash || (assetTransactions[0] && assetTransactions[0].hash)) && (
                <div style={{ padding: '18px 20px', backgroundColor: '#F8FAFC', borderRadius: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-secondary-text)', fontWeight: 600 }}>
                      Minting Transaction Hash
                    </span>
                    <a
                      href={getEtherscanTxUrl(asset.txHash || (assetTransactions[0] && assetTransactions[0].hash))}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: '12px', color: 'var(--color-copper)', display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
                    >
                      <span>View on Sepolia Etherscan</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <code style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-midnight-navy)', wordBreak: 'break-all' }}>
                      {asset.txHash || (assetTransactions[0] && assetTransactions[0].hash)}
                    </code>
                    <button
                      onClick={() => copyToClipboard(asset.txHash || (assetTransactions[0] && assetTransactions[0].hash))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-secondary-text)', padding: 0 }}
                      title="Copy Transaction Hash"
                    >
                      {copiedText ? <Check size={14} style={{ color: '#166534' }} /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
              )}

              <div style={{ padding: '18px 20px', backgroundColor: '#F8FAFC', borderRadius: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
                <div>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-secondary-text)', fontWeight: 600, marginBottom: '4px' }}>Authoritative Blockchain NFT Owner</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '13.5px', fontWeight: 600, color: 'var(--color-midnight-navy)' }}>
                    {effectiveNftOwner || '0x...'}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {syncStatus && (
                    <span style={{ fontSize: '12px', color: 'var(--color-copper)', fontWeight: 500 }}>
                      {syncStatus}
                    </span>
                  )}
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={isSyncing}
                    onClick={handleSyncChain}
                    style={{ borderRadius: '9999px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 14px' }}
                  >
                    <RefreshCw size={13} className={isSyncing ? 'spin' : ''} />
                    <span>{isSyncing ? 'Querying Sepolia...' : 'Sync from Sepolia'}</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (asset.verificationStatus === 'APPROVED' || (asset.status === 'APPROVED' && asset.verificationStatus !== 'PENDING')) ? (
            <div style={{ textAlign: 'center', padding: '48px 24px', backgroundColor: 'var(--color-mint)', borderRadius: '22px' }}>
              <div style={{ color: 'var(--color-copper)', marginBottom: '14px' }}>
                <ShieldCheck size={44} style={{ display: 'inline-block' }} />
              </div>
              <h4 className="font-serif" style={{ fontSize: '24px', fontWeight: 600, color: 'var(--color-midnight-navy)', marginBottom: '8px' }}>
                Compliance Audit Approved
              </h4>
              <p style={{ fontSize: '13.5px', color: 'var(--color-secondary-text)', maxWidth: '480px', margin: '0 auto 24px', lineHeight: 1.6 }}>
                This asset was officially audited and approved by compliance administrators. The token is ready to be deployed on-chain.
              </p>
              {(isOriginalRegistrant || (user && asset.userId === user.id)) && (
                <button
                  className="btn btn-primary"
                  onClick={() => setShowTokenizeModal(true)}
                  style={{ borderRadius: '9999px', padding: '10px 24px' }}
                >
                  <Zap size={15} />
                  <span>Execute On-Chain Token Minting</span>
                </button>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '48px 24px', backgroundColor: 'var(--color-peach)', borderRadius: '22px' }}>
              <div style={{ color: 'var(--color-copper)', marginBottom: '14px' }}>
                <Building2 size={44} style={{ display: 'inline-block' }} />
              </div>
              <h4 className="font-serif" style={{ fontSize: '24px', fontWeight: 600, color: 'var(--color-midnight-navy)', marginBottom: '8px' }}>
                Pending Compliance Audit
              </h4>
              <p style={{ fontSize: '13.5px', color: 'var(--color-secondary-text)', maxWidth: '480px', margin: '0 auto 20px', lineHeight: 1.6 }}>
                Smart contract tokenization is unlocked once an administrator registers and approves the asset on-chain.
              </p>
              {(isOriginalRegistrant || (user && asset.userId === user.id)) && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowTokenizeModal(true)}
                  style={{
                    borderRadius: '9999px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12.5px',
                    padding: '8px 18px'
                  }}
                >
                  <ShieldCheck size={14} style={{ color: 'var(--color-copper)' }} />
                  <span>Inspect On-Chain Registry Status</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Transactions */}
      {activeTab === 'transactions' && (
        <div
          style={{
            padding: 0,
            overflow: 'hidden',
            backgroundColor: '#FFFFFF',
            borderRadius: '24px',
            boxShadow: 'var(--shadow-card)'
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table className="fintech-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Transaction Hash</th>
                  <th>Event Type</th>
                  <th style={{ textAlign: 'right' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {assetTransactions.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '36px', color: 'var(--color-secondary-text)' }}>
                      No ledger operations recorded for this asset yet.
                    </td>
                  </tr>
                ) : (
                  assetTransactions.map((tx) => (
                    <tr key={tx.id}>
                      <td style={{ fontSize: '12.5px', color: 'var(--color-secondary-text)' }}>
                        {new Date(tx.timestamp).toLocaleString()}
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '12.5px', color: 'var(--color-midnight-navy)' }}>
                        {tx.hash || 'Off-Chain Ledger Record'}
                      </td>
                      <td style={{ fontSize: '13.5px', color: 'var(--color-midnight-navy)', fontWeight: 500 }}>{tx.type}</td>
                      <td style={{ textAlign: 'right' }}><Badge status={tx.status} size="small" /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Documents */}
      {activeTab === 'documents' && (
        <div
          style={{
            padding: '32px',
            backgroundColor: '#FFFFFF',
            borderRadius: '24px',
            boxShadow: 'var(--shadow-card)'
          }}
        >
          <h2
            className="font-serif"
            style={{
              fontSize: '22px',
              fontWeight: 600,
              color: 'var(--color-midnight-navy)',
              marginBottom: '20px'
            }}
          >
            Custody & Deed Documentation
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {loadingDocs && (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-secondary-text)', fontSize: '13.5px' }}>
                Fetching verified custodial documents from private storage vault...
              </div>
            )}

            {docError && (
              <div style={{ padding: '14px 18px', backgroundColor: 'var(--color-error-bg)', border: '1px solid var(--color-error-border)', borderRadius: '16px', color: 'var(--color-error)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AlertCircle size={16} />
                <span>{docError}</span>
              </div>
            )}

            {!loadingDocs && assetDocs.length === 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderRadius: '18px', backgroundColor: '#F8FAFC' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '50%', backgroundColor: 'var(--color-peach)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FileText size={20} style={{ color: 'var(--color-copper)' }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14.5px', color: 'var(--color-midnight-navy)' }}>
                      No Official Title Deed Uploaded
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--color-secondary-text)', marginTop: '2px' }}>
                      Upload custody agreements or title deeds to private Supabase Storage to initiate compliance audit.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!loadingDocs && assetDocs.length > 0 && assetDocs.map((doc) => (
              <div
                key={doc.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '20px 24px',
                  borderRadius: '18px',
                  backgroundColor: '#F8FAFC'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '50%', backgroundColor: 'var(--color-peach)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FileText size={20} style={{ color: 'var(--color-copper)' }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14.5px', color: 'var(--color-midnight-navy)' }}>
                      {doc.original_name || doc.filename}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--color-secondary-text)', marginTop: '2px' }}>
                      {(doc.size_bytes / 1024 / 1024).toFixed(2)} MB • {doc.mime_type} • Encrypted in private asset-documents bucket
                    </div>
                  </div>
                </div>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={async () => {
                    try {
                      const url = await getDocumentDownloadUrl(doc.storage_path);
                      if (url) window.open(url, '_blank', 'noopener,noreferrer');
                    } catch (err) {
                      alert(`Error generating signed download URL: ${err.message}`);
                    }
                  }}
                  style={{
                    borderRadius: '9999px',
                    padding: '8px 18px',
                    fontSize: '12.5px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Download size={13} />
                  <span>Download Secure Document</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tokenize Modal */}
      <TokenizeModal
        isOpen={showTokenizeModal}
        onClose={() => setShowTokenizeModal(false)}
        asset={asset}
      />

      {/* Buy Modal */}
      <Modal
        isOpen={showBuyModal}
        onClose={() => {
          if (!isBuying) {
            setShowBuyModal(false);
            setBuyError('');
            setBuySuccessTx(null);
          }
        }}
        title={`Purchase Token — ${asset.name}`}
      >
        {buySuccessTx ? (
          <div style={{ textAlign: 'center', padding: '16px 8px' }}>
            <div style={{ color: 'var(--color-copper)', marginBottom: '14px' }}>
              <CheckCircle2 size={48} style={{ display: 'inline-block' }} />
            </div>
            <h4 className="font-serif" style={{ fontSize: '24px', fontWeight: 600, color: 'var(--color-midnight-navy)', marginBottom: '8px' }}>
              Settlement Confirmed on Sepolia!
            </h4>
            <p style={{ fontSize: '13.5px', color: 'var(--color-secondary-text)', marginBottom: '22px', maxWidth: '440px', marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 }}>
              Smart contract ownership of token #{asset.tokenId || '1'} has been officially transferred to your wallet, and an immutable institutional receipt has been generated.
            </p>

            <div style={{ padding: '18px 20px', backgroundColor: '#F8FAFC', borderRadius: '18px', marginBottom: '24px', textAlign: 'left', fontSize: '12.5px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--color-secondary-text)' }}>Receipt Number:</span>
                <strong style={{ fontFamily: 'monospace', color: 'var(--color-midnight-navy)' }}>
                  {buySuccessTx.receipt?.receipt_number || assetReceipt?.receipt_number || 'REC-CONFIRMED'}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--color-secondary-text)' }}>Settlement Consideration:</span>
                <span style={{ fontWeight: 600, color: 'var(--color-copper)' }}>
                  {buySuccessTx.priceEth || asset.listingPriceEth} ETH
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--color-secondary-text)' }}>Transaction Hash:</span>
                <a
                  href={getEtherscanTxUrl(buySuccessTx.hash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontFamily: 'monospace', color: 'var(--color-copper)', display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
                >
                  <span>{buySuccessTx.hash.slice(0, 10)}...{buySuccessTx.hash.slice(-8)}</span>
                  <ExternalLink size={11} />
                </a>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-secondary-text)' }}>Network Consensus:</span>
                <span style={{ color: '#166534', fontWeight: 600 }}>Ethereum Sepolia (Status 1: Success)</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => downloadReceiptPdf(buySuccessTx.receipt || assetReceipt || {
                  receiptNumber: 'REC-' + new Date().getFullYear(),
                  assetId: asset.id,
                  assetName: asset.name,
                  tokenId: asset.tokenId || '1',
                  buyerWallet: buySuccessTx.buyer,
                  priceEth: buySuccessTx.priceEth || asset.listingPriceEth,
                  transactionHash: buySuccessTx.hash
                })}
                style={{ borderRadius: '9999px', padding: '10px 22px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Download size={14} />
                <span>Download Official PDF Receipt</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  handleDownloadCertificate();
                }}
                style={{ borderRadius: '9999px', padding: '10px 20px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Download size={14} />
                <span>Deed Certificate (PDF)</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setShowReceiptModal(true);
                  setShowBuyModal(false);
                }}
                style={{ borderRadius: '9999px', padding: '10px 20px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <FileText size={14} />
                <span>Settlement Receipt</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate('/portfolio')}
                style={{ borderRadius: '9999px', padding: '10px 20px' }}
              >
                View in Portfolio
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: '13.5px', color: 'var(--color-secondary-text)', marginBottom: '18px' }}>
              Confirm your on-chain purchase of tokenized asset <strong>{asset.name}</strong>.
            </p>

            {buyError && (
              <div style={{ padding: '14px 18px', backgroundColor: 'var(--color-error-bg)', border: '1px solid var(--color-error-border)', borderRadius: '16px', color: 'var(--color-error)', fontSize: '12.5px', marginBottom: '18px' }}>
                <div style={{ marginBottom: '8px' }}>{buyError}</div>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => handleExecutePurchase(null, true)}
                  style={{ borderRadius: '9999px', padding: '5px 14px', fontSize: '11.5px', backgroundColor: 'var(--color-copper)' }}
                >
                  Complete Purchase (Zero Gas Fees)
                </button>
              </div>
            )}

            {isListingSeller && (
              <div style={{ padding: '12px 16px', backgroundColor: '#FFF7ED', border: '1px solid #FFEDD5', borderRadius: '14px', color: '#C2410C', fontSize: '12px', marginBottom: '16px' }}>
                <strong>Notice:</strong> Your connected wallet is the on-chain seller of this token. Sellers cannot buy their own listings. Switch accounts in MetaMask or use another wallet to test acquiring.
              </div>
            )}

            <div style={{ padding: '20px', backgroundColor: '#F8FAFC', borderRadius: '20px', marginBottom: '22px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ color: 'var(--color-secondary-text)' }}>Token Price:</span>
                <strong style={{ fontSize: '17px', color: 'var(--color-copper)' }}>{effectiveListingPriceEth} Sepolia ETH</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ color: 'var(--color-secondary-text)' }}>Estimated Gas Fee:</span>
                <span style={{ color: '#166534', fontWeight: 600 }}>~0.0008 Sepolia ETH</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ color: 'var(--color-secondary-text)' }}>Total Sepolia ETH Required:</span>
                <strong style={{ color: 'var(--color-midnight-navy)', fontSize: '14px' }}>
                  ~{(parseFloat(effectiveListingPriceEth || 0) + 0.0008).toFixed(4)} Sepolia ETH
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ color: 'var(--color-secondary-text)' }}>Token Standard & ID:</span>
                <span style={{ fontWeight: 600, color: 'var(--color-midnight-navy)' }}>{asset.tokenStandard || 'ERC-721'} #{asset.tokenId || '1'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ color: 'var(--color-secondary-text)' }}>Seller:</span>
                <span style={{ fontFamily: 'monospace', color: 'var(--color-midnight-navy)' }}>{effectiveListingSeller ? `${effectiveListingSeller.slice(0, 6)}...${effectiveListingSeller.slice(-4)}` : (currentOwner ? `${currentOwner.slice(0, 6)}...${currentOwner.slice(-4)}` : 'Custodian')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #E2E8F0', paddingTop: '10px' }}>
                <span style={{ color: 'var(--color-secondary-text)' }}>Your Wallet:</span>
                <span style={{ fontFamily: 'monospace', color: 'var(--color-midnight-navy)', fontWeight: 600 }}>{account ? `${account.slice(0, 6)}...${account.slice(-4)}` : 'Not Connected'}</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={isBuying}
                onClick={() => setShowBuyModal(false)}
                style={{ borderRadius: '9999px', padding: '10px 22px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={isBuying}
                onClick={() => handleExecutePurchase(null, true)}
                style={{
                  borderRadius: '9999px',
                  padding: '10px 24px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: 'var(--color-copper)'
                }}
              >
                {isBuying ? <RefreshCw className="spin" size={14} /> : <ShoppingCart size={14} />}
                <span>{isBuying ? 'Confirming Purchase...' : `Pay ${effectiveListingPriceEth} Sepolia ETH & Buy`}</span>
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Sell Token Modal */}
      {showListModal && (
        <SellTokenModal
          isOpen={showListModal}
          onClose={() => setShowListModal(false)}
          asset={asset}
          onListingSuccess={() => {
            setShowListModal(false);
            if (syncAssetFromChain) syncAssetFromChain(asset.id);
          }}
        />
      )}

      {/* Transfer Token Modal */}
      {showTransferModal && (
        <TransferTokenModal
          isOpen={showTransferModal}
          onClose={() => setShowTransferModal(false)}
          asset={asset}
          onTransferSuccess={() => {
            setShowTransferModal(false);
            if (syncAssetFromChain) syncAssetFromChain(asset.id);
          }}
        />
      )}

      {/* Price Update Modal */}
      <Modal
        isOpen={showPriceUpdateModal}
        onClose={() => {
          if (!isUpdatingPrice) {
            setShowPriceUpdateModal(false);
            setUpdatePriceError('');
            setUpdatePriceSuccess('');
          }
        }}
        title={`Update Listing Price — ${asset.name}`}
      >
        <form onSubmit={handleExecutePriceUpdate}>
          <p style={{ fontSize: '13.5px', color: 'var(--color-secondary-text)', marginBottom: '18px', lineHeight: 1.6 }}>
            Update the on-chain asking price for token #{asset.tokenId || '1'} on the AssetMarketplace smart contract on Sepolia.
          </p>

          {updatePriceError && (
            <div style={{ padding: '14px 18px', backgroundColor: 'var(--color-error-bg)', border: '1px solid var(--color-error-border)', borderRadius: '16px', color: 'var(--color-error)', fontSize: '12.5px', marginBottom: '18px' }}>
              {updatePriceError}
            </div>
          )}

          {updatePriceSuccess && (
            <div style={{ padding: '14px 18px', backgroundColor: 'var(--color-mint)', borderRadius: '16px', color: '#166534', fontSize: '12.5px', marginBottom: '18px', fontWeight: 500 }}>
              {updatePriceSuccess}
            </div>
          )}

          <div className="input-group" style={{ marginBottom: '20px' }}>
            <label className="input-label" style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--color-midnight-navy)', marginBottom: '8px' }}>
              New Price (in ETH)
            </label>
            <input
              type="number"
              step="0.001"
              min="0.0001"
              required
              className="input-field"
              value={newPriceInput}
              onChange={(e) => setNewPriceInput(e.target.value)}
              placeholder="e.g. 1.25"
              style={{
                width: '100%',
                padding: '12px 16px',
                fontSize: '14px',
                backgroundColor: '#F8FAFC',
                borderRadius: '14px'
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowPriceUpdateModal(false)}
              style={{ borderRadius: '9999px', padding: '10px 22px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isUpdatingPrice}
              style={{ borderRadius: '9999px', padding: '10px 24px' }}
            >
              {isUpdatingPrice ? 'Updating On-Chain...' : 'Confirm New Price'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Official Settlement Receipt Modal */}
      <ReceiptModal
        isOpen={showReceiptModal}
        onClose={() => setShowReceiptModal(false)}
        receipt={assetReceipt || buySuccessTx?.receipt}
        asset={asset}
      />

      {/* Asset Showcase Photograph Upload Modal */}
      <Modal
        isOpen={showImageUploadModal}
        onClose={() => {
          if (!imageUploadLoading) {
            setShowImageUploadModal(false);
            setImageUploadError('');
          }
        }}
        title={`Asset Photograph — ${asset.name}`}
      >
        <div>
          <p style={{ fontSize: '13.5px', color: 'var(--color-secondary-text)', marginBottom: '18px', lineHeight: 1.6 }}>
            Upload or provide a showcase photograph for <strong>{asset.name}</strong>. This image will appear across the marketplace, investor dossier, and vault holdings ledger.
          </p>

          {imageUploadError && (
            <div style={{ padding: '12px 16px', backgroundColor: 'var(--color-error-bg)', border: '1px solid var(--color-error-border)', borderRadius: '14px', color: 'var(--color-error)', fontSize: '12.5px', marginBottom: '16px' }}>
              {imageUploadError}
            </div>
          )}

          {/* Drag & Drop File Picker */}
          <div
            style={{
              border: uploadedImagePreview ? '1px solid var(--color-subtle-border)' : '2px dashed #E2E8F0',
              backgroundColor: '#F8FAFC',
              borderRadius: '16px',
              padding: '24px 20px',
              textAlign: 'center',
              position: 'relative',
              marginBottom: '18px'
            }}
          >
            {uploadedImagePreview ? (
              <div>
                <img
                  src={uploadedImagePreview}
                  alt="Asset Preview"
                  style={{ width: '120px', height: '120px', objectFit: 'cover', borderRadius: '14px', margin: '0 auto 12px', display: 'block', border: '1px solid #E2E8F0' }}
                />
                <button
                  type="button"
                  onClick={() => {
                    setUploadedImagePreview('');
                    setImageUrlInput('');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-error)',
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Trash2 size={13} />
                  <span>Choose different photograph</span>
                </button>
              </div>
            ) : (
              <>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      const file = e.target.files[0];
                      if (file.size > 8 * 1024 * 1024) {
                        setImageUploadError('Photograph exceeds maximum size of 8MB.');
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = () => {
                        setUploadedImagePreview(reader.result);
                        setImageUrlInput(reader.result);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    opacity: 0,
                    cursor: 'pointer',
                    width: '100%',
                    height: '100%'
                  }}
                />
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-peach)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 10px'
                  }}
                >
                  <UploadCloud size={22} style={{ color: 'var(--color-copper)' }} />
                </div>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--color-midnight-navy)' }}>
                  Click to select or drop an asset photograph
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--color-secondary-text)', marginTop: '4px' }}>
                  PNG, JPG, JPEG, or WebP up to 8MB
                </div>
              </>
            )}
          </div>

          <div className="input-group" style={{ marginBottom: '22px' }}>
            <label className="input-label" style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--color-midnight-navy)', marginBottom: '6px' }}>
              Or enter hosted photograph URL:
            </label>
            <input
              type="url"
              className="input-field"
              placeholder="https://images.unsplash.com/photo-..."
              value={imageUrlInput.startsWith('data:') ? '' : imageUrlInput}
              onChange={(e) => {
                setImageUrlInput(e.target.value);
                setUploadedImagePreview(e.target.value);
              }}
              style={{ width: '100%', padding: '10px 14px', fontSize: '13px', backgroundColor: '#F8FAFC', borderRadius: '12px' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={imageUploadLoading}
              onClick={() => setShowImageUploadModal(false)}
              style={{ borderRadius: '9999px', padding: '10px 22px' }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={imageUploadLoading || (!uploadedImagePreview && !imageUrlInput)}
              onClick={async () => {
                const finalImg = uploadedImagePreview || imageUrlInput;
                if (!finalImg) return;
                setImageUploadLoading(true);
                setImageUploadError('');
                try {
                  await updateAssetImage(asset.id, finalImg);
                  setShowImageUploadModal(false);
                } catch (err) {
                  setImageUploadError(err.message || 'Failed to update asset image.');
                } finally {
                  setImageUploadLoading(false);
                }
              }}
              style={{ borderRadius: '9999px', padding: '10px 24px', backgroundColor: 'var(--color-copper)' }}
            >
              {imageUploadLoading ? 'Saving Photograph...' : 'Save Photograph'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AssetDetails;
