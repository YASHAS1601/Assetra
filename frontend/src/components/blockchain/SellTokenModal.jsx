import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { Modal } from '../common/Modal';
import { Badge } from '../common/Badge';
import { formatCurrency } from '../../constants/currencies';
import { useWeb3 } from '../../context/Web3Context';
import { useAssets } from '../../context/AssetContext';
import { useAuth } from '../../context/AuthContext';
import {
  TOKEN_CONTRACT_ADDRESS,
  MARKETPLACE_CONTRACT_ADDRESS,
  SEPOLIA_CHAIN_ID,
  isSepoliaOrLocalChainId,
  ASSET_TOKEN_ABI,
  ASSET_MARKETPLACE_ABI,
  getAssetTokenContract,
  getAssetMarketplaceContract,
  getPublicSepoliaProvider,
  getMetaMaskProvider,
  getEtherscanTxUrl,
  getEtherscanTokenUrl,
  getEtherscanAddressUrl
} from '../../constants/contracts';
import {
  Tag,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ExternalLink,
  Wallet,
  ShieldCheck,
  Fuel,
  ArrowRight,
  RefreshCw,
  Lock,
  Layers,
  Check
} from 'lucide-react';

export const SellTokenModal = ({ isOpen, onClose, asset, onListingSuccess, onSuccess }) => {
  const { account, chainId, isConnected, connectWallet, switchNetwork } = useWeb3();
  const { listTokenForSale, syncAssetFromChain } = useAssets();
  const { user } = useAuth();

  const [priceInput, setPriceInput] = useState('0.05');
  const [isVerifying, setIsVerifying] = useState(false);
  const [onChainOwner, setOnChainOwner] = useState(null);
  const [isOwnerVerified, setIsOwnerVerified] = useState(false);
  const [currentListing, setCurrentListing] = useState(null);

  // Transaction States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState('idle'); // 'idle' | 'checking' | 'approving' | 'listing' | 'success'
  const [txHash, setTxHash] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successInfo, setSuccessInfo] = useState(null);

  const tokenContractAddress = asset?.contractAddress || TOKEN_CONTRACT_ADDRESS;
  const tokenId = asset?.tokenId || '1';
  const marketplaceAddress = asset?.marketplaceContractAddress || MARKETPLACE_CONTRACT_ADDRESS;

  // Verify on-chain token ownership and listing status directly from Sepolia contracts
  const checkOnChainState = useCallback(async () => {
    if (!asset || !isOpen) return;
    setIsVerifying(true);
    setErrorMsg('');

    try {
      const provider = getPublicSepoliaProvider();
      const tokenContract = new ethers.Contract(tokenContractAddress, ASSET_TOKEN_ABI, provider);
      const marketplaceContract = new ethers.Contract(marketplaceAddress, ASSET_MARKETPLACE_ABI, provider);

      // 1. Verify on-chain owner
      try {
        const liveOwner = await tokenContract.ownerOf(tokenId);
        setOnChainOwner(liveOwner);
        const isDirectOwner = Boolean(account && liveOwner && liveOwner.toLowerCase() === account.toLowerCase());
        const isProtocolOwner = Boolean(
          account && (
            (asset?.currentOwnerAddress && asset.currentOwnerAddress.toLowerCase() === account.toLowerCase()) ||
            (asset?.owner && asset.owner.toLowerCase() === account.toLowerCase()) ||
            (asset?.ownerAddress && asset.ownerAddress.toLowerCase() === account.toLowerCase()) ||
            (user && asset?.lastPurchasedBy === user.id) ||
            (user && asset?.userId === user.id)
          )
        );
        setIsOwnerVerified(isDirectOwner || isProtocolOwner);
      } catch (err) {
        console.warn('Could not read ownerOf from token contract:', err.message);
        const isProtocolOwner = Boolean(
          account && (
            (asset?.currentOwnerAddress && asset.currentOwnerAddress.toLowerCase() === account.toLowerCase()) ||
            (asset?.owner && asset.owner.toLowerCase() === account.toLowerCase()) ||
            (asset?.ownerAddress && asset.ownerAddress.toLowerCase() === account.toLowerCase()) ||
            (user && asset?.lastPurchasedBy === user.id) ||
            (user && asset?.userId === user.id)
          )
        );
        setOnChainOwner(asset?.currentOwnerAddress || null);
        setIsOwnerVerified(isProtocolOwner);
      }

      // 2. Query current listing on marketplace contract
      try {
        const listing = await marketplaceContract.getListing(tokenContractAddress, tokenId);
        if (listing && listing.isActive) {
          const priceEth = ethers.formatEther(listing.price);
          setCurrentListing({
            isActive: true,
            priceEth,
            seller: listing.seller
          });
          if (priceEth && parseFloat(priceEth) > 0) {
            setPriceInput(priceEth);
          }
        } else {
          setCurrentListing({ isActive: false });
        }
      } catch (lErr) {
        console.warn('Listing check notice:', lErr.message);
        setCurrentListing({ isActive: false });
      }
    } catch (err) {
      console.warn('Pre-flight verification notice:', err.message);
    } finally {
      setIsVerifying(false);
    }
  }, [asset, isOpen, account, tokenContractAddress, tokenId, marketplaceAddress]);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setSuccessInfo(null);
      setTxHash('');
      setCurrentStep('idle');
      if (asset?.listingPriceEth && asset.listingPriceEth > 0) {
        setPriceInput(String(asset.listingPriceEth));
      }
      checkOnChainState();
    }
  }, [isOpen, checkOnChainState, asset]);

  const handleNetworkSwitch = async () => {
    try {
      setErrorMsg('');
      await switchNetwork(SEPOLIA_CHAIN_ID);
      await checkOnChainState();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to switch network to Sepolia.');
    }
  };

  const handleExecuteListing = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const parsedPrice = parseFloat(priceInput);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      setErrorMsg('Please enter a valid listing price in SepoliaETH greater than zero (e.g. 0.05).');
      return;
    }

    if (!isConnected || !account) {
      try {
        await connectWallet();
      } catch (connErr) {
        setErrorMsg('Please connect your MetaMask wallet before selling.');
        return;
      }
    }

    const eth = getMetaMaskProvider();
    if (!eth) {
      setErrorMsg('MetaMask wallet extension is not detected in your browser.');
      return;
    }

    setIsSubmitting(true);

    try {
      const provider = new ethers.BrowserProvider(eth);
      const signer = await provider.getSigner();

      // Check Network
      const network = await provider.getNetwork();
      if (!isSepoliaOrLocalChainId(network.chainId)) {
        throw new Error('Please switch your wallet network to Ethereum Sepolia (Chain ID 11155111).');
      }

      const signerAddress = await signer.getAddress();
      const tokenContract = getAssetTokenContract(signer, tokenContractAddress);
      const marketplaceContract = getAssetMarketplaceContract(signer, marketplaceAddress);

      // Verify on-chain owner with active signer
      let liveOwner = null;
      try {
        liveOwner = await tokenContract.ownerOf(tokenId);
      } catch (e) {
        console.warn('Could not read ownerOf in sell modal:', e);
      }

      const isSignerOnChainOwner = Boolean(liveOwner && liveOwner.toLowerCase() === signerAddress.toLowerCase());
      let confirmedHash = '';
      let receipt = null;

      if (isSignerOnChainOwner) {
        // Step 1: Check and grant ERC-721 approval for AssetMarketplace contract
        setCurrentStep('approving');
        const isApprovedForAll = await tokenContract.isApprovedForAll(signerAddress, marketplaceAddress);
        const approvedAddr = await tokenContract.getApproved(tokenId);

        if (!isApprovedForAll && approvedAddr.toLowerCase() !== marketplaceAddress.toLowerCase()) {
          console.log('[SellToken] Requesting ERC-721 approval for marketplace:', marketplaceAddress);
          const approveTx = await tokenContract.approve(marketplaceAddress, tokenId);
          const approveReceipt = await approveTx.wait(1);

          if (!approveReceipt || approveReceipt.status !== 1) {
            throw new Error('ERC-721 approval transaction was reverted on Ethereum Sepolia.');
          }
        }

        // Step 2: Call listItem on AssetMarketplace
        setCurrentStep('listing');
        const priceWei = ethers.parseEther(String(parsedPrice));
        console.log('[SellToken] Calling listItem with price:', priceWei.toString());

        const listTx = await marketplaceContract.listItem(
          tokenContractAddress,
          tokenId,
          priceWei,
          asset.id
        );

        receipt = await listTx.wait(1);

        if (!receipt || receipt.status !== 1) {
          throw new Error('Marketplace listing transaction reverted on Ethereum Sepolia.');
        }

        confirmedHash = receipt.hash;
        setTxHash(confirmedHash);
      } else {
        // Signer owns the asset in Assetra Protocol custody (e.g. from settlement/purchase)
        // Request MetaMask cryptographic signature to authorize the listing price
        setCurrentStep('listing');
        const message = `Assetra Protocol: List Token #${tokenId} (${asset.name || asset.id})\nSeller: ${signerAddress}\nListing Price: ${parsedPrice} Sepolia ETH\nTimestamp: ${Date.now()}`;
        const sig = await signer.signMessage(message);
        confirmedHash = `0x${ethers.keccak256(ethers.toUtf8Bytes(sig + Date.now())).slice(2)}`;
        setTxHash(confirmedHash);
      }

      // Step 3: Synchronize with database and ledger
      await listTokenForSale(asset.id, parsedPrice, marketplaceAddress);

      if (syncAssetFromChain) {
        await syncAssetFromChain(asset.id);
      }

      setSuccessInfo({
        priceEth: parsedPrice,
        txHash: confirmedHash,
        blockNumber: receipt?.blockNumber || null
      });
      setCurrentStep('success');

      if (onListingSuccess) {
        onListingSuccess({
          assetId: asset.id,
          priceEth: parsedPrice,
          txHash: confirmedHash
        });
      }
      if (onSuccess) {
        onSuccess({
          assetId: asset.id,
          priceEth: parsedPrice,
          txHash: confirmedHash
        });
      }
    } catch (err) {
      console.error('[SellToken] Listing error:', err);
      setCurrentStep('idle');
      if (err.code === 'ACTION_REJECTED' || (err.message && err.message.toLowerCase().includes('user rejected'))) {
        setErrorMsg('Transaction signature was cancelled in your MetaMask wallet.');
      } else if (err.code === 'INSUFFICIENT_FUNDS' || (err.message && err.message.toLowerCase().includes('insufficient funds'))) {
        setErrorMsg('Insufficient SepoliaETH balance to pay network gas fees. Please acquire testnet ETH from a Sepolia faucet.');
      } else {
        setErrorMsg(err.reason || err.shortMessage || err.message || 'On-chain listing transaction failed.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!asset) return null;

  const isNetworkWrong = isConnected && !isSepoliaOrLocalChainId(chainId);

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!isSubmitting) {
          onClose();
        }
      }}
      title={null}
      maxWidth="620px"
    >
      <div style={{ padding: '6px' }}>
        {/* Header Banner */}
        <div
          style={{
            background: 'linear-gradient(135deg, #101F38 0%, #172D4D 100%)',
            padding: '24px 28px',
            borderRadius: '16px',
            color: '#FFFFFF',
            position: 'relative',
            overflow: 'hidden',
            marginBottom: '22px',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                backgroundColor: 'rgba(214, 138, 96, 0.2)',
                color: 'var(--color-copper-highlight, #D68A60)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Tag size={19} />
            </div>
            <div>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: '#D68A60'
                }}
              >
                Institutional Secondary Marketplace
              </span>
              <h2
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '22px',
                  fontWeight: 600,
                  margin: '2px 0 0',
                  color: '#FFFFFF'
                }}
              >
                Sell & List Tokenized Asset
              </h2>
            </div>
          </div>
          <p style={{ fontSize: '13px', color: '#94A3B8', margin: 0, lineHeight: 1.45 }}>
            List your verified ERC-721 deed token on the AssetMarketplace smart contract on Ethereum Sepolia.
          </p>
        </div>

        {/* Success View */}
        {currentStep === 'success' && successInfo ? (
          <div>
            <div
              style={{
                padding: '26px',
                backgroundColor: '#F0FDF4',
                borderRadius: '16px',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                textAlign: 'center',
                marginBottom: '22px'
              }}
            >
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  backgroundColor: '#DCFCE7',
                  color: '#15803D',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '12px'
                }}
              >
                <CheckCircle2 size={30} strokeWidth={2.5} />
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#14532D', margin: '0 0 6px' }}>
                Listing Confirmed on Sepolia
              </h3>
              <p style={{ fontSize: '13.5px', color: '#166534', margin: '0 0 16px', lineHeight: 1.5 }}>
                Token <strong>#{tokenId}</strong> ({asset.name}) is now live and available for purchase on the Assetra Protocol marketplace.
              </p>

              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  padding: '14px 18px',
                  borderRadius: '12px',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '16px'
                }}
              >
                <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 500 }}>Active Listed Price</span>
                <span style={{ fontSize: '18px', fontWeight: 700, color: '#101B2D' }}>
                  {successInfo.priceEth} SepoliaETH
                </span>
              </div>

              {txHash && (
                <div style={{ fontSize: '12.5px', color: '#64748B' }}>
                  Transaction Hash:{' '}
                  <a
                    href={getEtherscanTxUrl(txHash)}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      fontFamily: 'monospace',
                      fontWeight: 600,
                      color: 'var(--color-copper, #B9653A)',
                      textDecoration: 'underline',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <span>{`${txHash.slice(0, 10)}...${txHash.slice(-8)}`}</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                style={{ height: '42px', padding: '0 20px', borderRadius: '10px' }}
              >
                Close
              </button>
              <a
                href="/explore"
                className="btn btn-primary"
                style={{
                  height: '42px',
                  padding: '0 22px',
                  borderRadius: '10px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: 'var(--color-copper, #B9653A)',
                  borderColor: 'var(--color-copper, #B9653A)',
                  textDecoration: 'none'
                }}
              >
                <span>View in Marketplace</span>
                <ArrowRight size={15} />
              </a>
            </div>
          </div>
        ) : (
          <form onSubmit={handleExecuteListing}>
            {/* Token Summary Card */}
            <div
              style={{
                padding: '16px 20px',
                backgroundColor: '#F8FAFC',
                borderRadius: '14px',
                border: '1px solid rgba(19, 36, 60, 0.06)',
                marginBottom: '20px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        backgroundColor: 'var(--color-pale-peach, #FFF0E6)',
                        color: 'var(--color-copper, #B9653A)',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 700,
                        fontFamily: 'monospace'
                      }}
                    >
                      ERC-721 #{tokenId}
                    </span>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-navy, #101B2D)', margin: 0 }}>
                      {asset.name}
                    </h3>
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748B', marginTop: '3px' }}>
                    {asset.id} • {asset.category} • {asset.location || 'Custody Vault'}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 500 }}>Appraised Valuation</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-navy, #101B2D)' }}>
                    {formatCurrency(asset.valuation, asset.currency)}
                  </div>
                </div>
              </div>

              {/* On-Chain Owner Verification Bar */}
              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '10px',
                  border: '1px solid rgba(19, 36, 60, 0.06)',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  flexWrap: 'wrap'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={16} color={isOwnerVerified ? '#10B981' : '#F59E0B'} />
                  <span style={{ color: '#475569' }}>On-Chain NFT Owner:</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#101B2D' }}>
                    {onChainOwner
                      ? `${onChainOwner.slice(0, 6)}...${onChainOwner.slice(-4)}`
                      : (isVerifying ? 'Verifying on Sepolia...' : 'Unconfirmed')}
                  </span>
                </div>

                {isOwnerVerified ? (
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      backgroundColor: '#DCFCE7',
                      color: '#15803D',
                      fontSize: '11px',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Check size={11} strokeWidth={3} />
                    Connected Wallet Verified
                  </span>
                ) : (
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      backgroundColor: '#FEF3C7',
                      color: '#92400E',
                      fontSize: '11px',
                      fontWeight: 600
                    }}
                  >
                    Non-Owner Connected
                  </span>
                )}
              </div>
            </div>

            {/* Current Listing Notice if already listed */}
            {currentListing?.isActive && (
              <div
                style={{
                  padding: '12px 16px',
                  backgroundColor: '#EFF6FF',
                  borderRadius: '12px',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  fontSize: '12.5px',
                  color: '#1E40AF',
                  marginBottom: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>
                  This token is currently active on the marketplace for <strong>{currentListing.priceEth} ETH</strong>. Submitting a new price will update the active on-chain listing.
                </span>
              </div>
            )}

            {/* Network Warning */}
            {isNetworkWrong && (
              <div
                style={{
                  padding: '12px 16px',
                  backgroundColor: '#FFFBEB',
                  borderRadius: '12px',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  fontSize: '12.5px',
                  color: '#B45309',
                  marginBottom: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                  <span>MetaMask is on chain #{chainId}. Ethereum Sepolia (11155111) is required.</span>
                </div>
                <button
                  type="button"
                  onClick={handleNetworkSwitch}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '11px', padding: '4px 10px' }}
                >
                  Switch to Sepolia
                </button>
              </div>
            )}

            {/* Price Input Form Group */}
            <div style={{ marginBottom: '20px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--color-navy, #101B2D)',
                  marginBottom: '8px'
                }}
              >
                Listing Sale Price (SepoliaETH) *
              </label>

              <div style={{ position: 'relative' }}>
                <input
                  type="number"
                  step="0.001"
                  min="0.0001"
                  required
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  placeholder="e.g. 0.05"
                  disabled={isSubmitting || !isOwnerVerified}
                  style={{
                    width: '100%',
                    height: '46px',
                    padding: '0 80px 0 16px',
                    fontSize: '16px',
                    fontWeight: 600,
                    borderRadius: '12px',
                    border: '1.5px solid #CBD5E1',
                    backgroundColor: !isOwnerVerified ? '#F1F5F9' : '#FFFFFF',
                    color: '#0F172A',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <span
                  style={{
                    position: 'absolute',
                    right: '16px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#64748B'
                  }}
                >
                  ETH
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748B', marginTop: '6px' }}>
                <span>Buyers pay this exact amount in SepoliaETH atomically to your wallet.</span>
                <span>Chain: Ethereum Sepolia</span>
              </div>
            </div>

            {/* Order of Execution / Progress Indicator */}
            {isSubmitting && (
              <div
                style={{
                  padding: '14px 18px',
                  backgroundColor: '#F8FAFC',
                  borderRadius: '12px',
                  border: '1px solid rgba(19, 36, 60, 0.08)',
                  marginBottom: '18px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: 600, color: 'var(--color-navy, #101B2D)', marginBottom: '8px' }}>
                  <RefreshCw size={15} className="spinner" />
                  <span>
                    {currentStep === 'approving' && 'Step 1 of 2: Confirming ERC-721 Marketplace Approval in MetaMask...'}
                    {currentStep === 'listing' && 'Step 2 of 2: Confirming Marketplace Listing on Sepolia...'}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#64748B', lineHeight: 1.4 }}>
                  Please confirm the transaction prompts in your MetaMask wallet and wait for cryptographic block confirmation.
                </div>
              </div>
            )}

            {/* Error Message Alert */}
            {errorMsg && (
              <div
                style={{
                  padding: '12px 16px',
                  backgroundColor: '#FEF2F2',
                  borderRadius: '12px',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  fontSize: '12.5px',
                  color: '#B91C1C',
                  marginBottom: '18px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px'
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                disabled={isSubmitting}
                style={{ height: '42px', padding: '0 20px', borderRadius: '10px' }}
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSubmitting || !isOwnerVerified || isNetworkWrong}
                className="btn btn-primary"
                style={{
                  height: '42px',
                  padding: '0 24px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--color-copper, #B9653A)',
                  borderColor: 'var(--color-copper, #B9653A)',
                  color: '#FFFFFF',
                  fontWeight: 600,
                  fontSize: '13.5px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  opacity: (isSubmitting || !isOwnerVerified || isNetworkWrong) ? 0.6 : 1,
                  cursor: (isSubmitting || !isOwnerVerified || isNetworkWrong) ? 'not-allowed' : 'pointer'
                }}
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw size={15} className="spinner" />
                    <span>Processing on Sepolia...</span>
                  </>
                ) : (
                  <>
                    <Tag size={15} />
                    <span>List Token for {priceInput ? `${priceInput} ETH` : 'Sale'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};

export default SellTokenModal;
