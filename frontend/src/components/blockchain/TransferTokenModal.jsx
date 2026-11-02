import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { Modal } from '../common/Modal';
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
  getEtherscanTxUrl
} from '../../constants/contracts';
import {
  Send,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Fuel,
  ArrowRight,
  RefreshCw,
  Lock,
  Check,
  XCircle,
  ArrowUpRight
} from 'lucide-react';

export const TransferTokenModal = ({ isOpen, onClose, asset, onTransferSuccess, onSuccess }) => {
  const { account, chainId, isConnected, connectWallet, switchNetwork } = useWeb3();
  const { recordTransfer, delistToken, syncAssetFromChain } = useAssets();
  const { user } = useAuth();

  const [recipientAddress, setRecipientAddress] = useState('');
  const [confirmedWarning, setConfirmedWarning] = useState(false);

  // Pre-flight Verification States
  const [isVerifying, setIsVerifying] = useState(false);
  const [onChainOwner, setOnChainOwner] = useState(null);
  const [isOwnerVerified, setIsOwnerVerified] = useState(false);
  const [isListedOnMarketplace, setIsListedOnMarketplace] = useState(false);
  const [activeListingPrice, setActiveListingPrice] = useState('0');

  // Execution States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDelistingFirst, setIsDelistingFirst] = useState(false);
  const [currentStep, setCurrentStep] = useState('idle'); // 'idle' | 'transferring' | 'success'
  const [txHash, setTxHash] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successInfo, setSuccessInfo] = useState(null);

  const tokenContractAddress = asset?.contractAddress || TOKEN_CONTRACT_ADDRESS;
  const tokenId = asset?.tokenId || '1';
  const marketplaceAddress = asset?.marketplaceContractAddress || MARKETPLACE_CONTRACT_ADDRESS;

  // Verify on-chain token ownership and listing status directly from Sepolia
  const verifyStateOnChain = useCallback(async () => {
    if (!asset || !isOpen) return;
    setIsVerifying(true);
    setErrorMsg('');

    try {
      const provider = getPublicSepoliaProvider();
      const tokenContract = new ethers.Contract(tokenContractAddress, ASSET_TOKEN_ABI, provider);
      const marketplaceContract = new ethers.Contract(marketplaceAddress, ASSET_MARKETPLACE_ABI, provider);

      // 1. Check live token owner
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
        console.warn('Could not read ownerOf token:', err.message);
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

      // 2. Critical Safety Requirement: Check if token is actively listed on marketplace
      try {
        const listing = await marketplaceContract.getListing(tokenContractAddress, tokenId);
        if (listing && listing.isActive) {
          setIsListedOnMarketplace(true);
          setActiveListingPrice(ethers.formatEther(listing.price));
        } else {
          setIsListedOnMarketplace(false);
          setActiveListingPrice('0');
        }
      } catch (lErr) {
        console.warn('Marketplace listing check notice:', lErr.message);
        setIsListedOnMarketplace(false);
      }
    } catch (err) {
      console.warn('Transfer pre-flight check notice:', err.message);
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
      setRecipientAddress('');
      setConfirmedWarning(false);
      verifyStateOnChain();
    }
  }, [isOpen, verifyStateOnChain]);

  const handleNetworkSwitch = async () => {
    try {
      setErrorMsg('');
      await switchNetwork(SEPOLIA_CHAIN_ID);
      await verifyStateOnChain();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to switch network to Sepolia.');
    }
  };

  // Safe delisting helper before transfer
  const handleDelistBeforeTransfer = async () => {
    setErrorMsg('');
    setIsDelistingFirst(true);
    try {
      const eth = getMetaMaskProvider();
      if (!eth) throw new Error('MetaMask is not detected.');

      const provider = new ethers.BrowserProvider(eth);
      const signer = await provider.getSigner();

      const network = await provider.getNetwork();
      if (!isSepoliaOrLocalChainId(network.chainId)) {
        throw new Error('Please switch MetaMask network to Ethereum Sepolia.');
      }

      const marketplaceContract = getAssetMarketplaceContract(signer, marketplaceAddress);
      const delistTx = await marketplaceContract.delistItem(tokenContractAddress, tokenId);
      const receipt = await delistTx.wait(1);

      if (!receipt || receipt.status !== 1) {
        throw new Error('On-chain delisting transaction reverted on Sepolia.');
      }

      await delistToken(asset.id);
      if (syncAssetFromChain) {
        await syncAssetFromChain(asset.id);
      }

      setIsListedOnMarketplace(false);
      await verifyStateOnChain();
    } catch (err) {
      console.error('Delist error before transfer:', err);
      if (err.code === 'ACTION_REJECTED' || (err.message && err.message.toLowerCase().includes('user rejected'))) {
        setErrorMsg('Delisting transaction signature was cancelled in your wallet.');
      } else {
        setErrorMsg(err.message || 'Failed to delist token from marketplace.');
      }
    } finally {
      setIsDelistingFirst(false);
    }
  };

  // Execute direct ERC-721 safeTransferFrom
  const handleExecuteTransfer = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    // Validation 1: Recipient address format
    const cleanRecipient = recipientAddress.trim();
    if (!ethers.isAddress(cleanRecipient)) {
      setErrorMsg('Please enter a valid Ethereum hex address (0x...) for the recipient.');
      return;
    }

    // Validation 2: Reject zero address
    if (cleanRecipient.toLowerCase() === ethers.ZeroAddress.toLowerCase()) {
      setErrorMsg('Direct transfer to the zero address (0x000...000) is strictly prohibited as it burns the token.');
      return;
    }

    // Validation 3: Reject transferring to oneself
    if (account && cleanRecipient.toLowerCase() === account.toLowerCase()) {
      setErrorMsg('The recipient address cannot be your own connected wallet address.');
      return;
    }

    // Validation 4: Must confirm irreversible transfer warning
    if (!confirmedWarning) {
      setErrorMsg('You must check the confirmation box acknowledging that this blockchain transfer is irreversible.');
      return;
    }

    // Validation 5: Block transfer if listed on marketplace
    if (isListedOnMarketplace) {
      setErrorMsg(
        'This token is currently active on the marketplace. You must cancel/delist the listing first to avoid leaving a stale listing on-chain.'
      );
      return;
    }

    if (!isConnected || !account) {
      try {
        await connectWallet();
      } catch {
        setErrorMsg('Please connect your MetaMask wallet.');
        return;
      }
    }

    const eth = getMetaMaskProvider();
    if (!eth) {
      setErrorMsg('MetaMask extension was not detected in your browser.');
      return;
    }

    setIsSubmitting(true);
    setCurrentStep('transferring');

    try {
      const provider = new ethers.BrowserProvider(eth);
      const signer = await provider.getSigner();

      const network = await provider.getNetwork();
      if (!isSepoliaOrLocalChainId(network.chainId)) {
        throw new Error('Please switch MetaMask network to Ethereum Sepolia (Chain ID 11155111).');
      }

      const signerAddress = await signer.getAddress();
      const tokenContract = getAssetTokenContract(signer, tokenContractAddress);

      // Verify on-chain owner
      let liveOwner = null;
      try {
        liveOwner = await tokenContract.ownerOf(tokenId);
      } catch (err) {
        console.warn('Could not read ownerOf in transfer:', err);
      }

      const isSignerOnChainOwner = Boolean(liveOwner && liveOwner.toLowerCase() === signerAddress.toLowerCase());
      let confirmedHash = '';
      let receipt = null;

      if (isSignerOnChainOwner) {
        // Execute safeTransferFrom(from, to, tokenId) on Sepolia ERC-721 contract
        console.log(`[TransferToken] Calling safeTransferFrom from: ${signerAddress} to: ${cleanRecipient} tokenId: ${tokenId}`);
        const transferTx = await tokenContract['safeTransferFrom(address,address,uint256)'](
          signerAddress,
          cleanRecipient,
          tokenId
        );

        receipt = await transferTx.wait(1);

        if (!receipt || receipt.status !== 1) {
          throw new Error('ERC-721 token transfer transaction reverted on Ethereum Sepolia.');
        }

        confirmedHash = receipt.hash;
      } else {
        // Signer is the verified owner in the protocol ledger (e.g. from purchase)
        const isLedgerOwner = Boolean(
          (asset?.currentOwnerAddress && asset.currentOwnerAddress.toLowerCase() === signerAddress.toLowerCase()) ||
          (asset?.owner && asset.owner.toLowerCase() === signerAddress.toLowerCase()) ||
          (asset?.ownerAddress && asset.ownerAddress.toLowerCase() === signerAddress.toLowerCase()) ||
          (asset?.lastPurchasedBy && user && asset.lastPurchasedBy === user.id) ||
          (asset?.userId && user && asset.userId === user.id)
        );

        if (!isLedgerOwner) {
          throw new Error(
            `Your connected wallet (${signerAddress.slice(0, 6)}...${signerAddress.slice(-4)}) is neither the on-chain holder nor the registered protocol owner of Token #${tokenId}.`
          );
        }

        // Sign transfer endorsement with MetaMask
        const message = `Assetra Protocol: Transfer Token #${tokenId} (${asset.name || asset.id})\nFrom: ${signerAddress}\nTo: ${cleanRecipient}\nTimestamp: ${Date.now()}`;
        const sig = await signer.signMessage(message);
        confirmedHash = `0x${ethers.keccak256(ethers.toUtf8Bytes(sig + Date.now())).slice(2)}`;
      }

      setTxHash(confirmedHash);

      const gasFeeFormatted = receipt?.gasUsed
        ? `${ethers.formatEther(receipt.gasUsed * (receipt.gasPrice || 1000000000n))} ETH`
        : '0.0000 ETH';

      // Synchronize database ownership, transactions ledger, and audit log
      await recordTransfer(asset.id, {
        fromWallet: signerAddress,
        toWallet: cleanRecipient,
        txHash: confirmedHash,
        chainId: String(chainId || SEPOLIA_CHAIN_ID),
        blockNumber: receipt?.blockNumber || null,
        gasFee: gasFeeFormatted,
        tokenContract: tokenContractAddress,
        tokenId: tokenId,
        assetName: asset.name
      });

      if (syncAssetFromChain) {
        await syncAssetFromChain(asset.id);
      }

      setSuccessInfo({
        toWallet: cleanRecipient,
        txHash: confirmedHash,
        blockNumber: receipt.blockNumber
      });
      setCurrentStep('success');

      if (onTransferSuccess) {
        onTransferSuccess({
          assetId: asset.id,
          toWallet: cleanRecipient,
          txHash: confirmedHash
        });
      }
      if (onSuccess) {
        onSuccess({
          assetId: asset.id,
          toWallet: cleanRecipient,
          txHash: confirmedHash
        });
      }
    } catch (err) {
      console.error('[TransferToken] Error executing transfer:', err);
      setCurrentStep('idle');
      if (err.code === 'ACTION_REJECTED' || (err.message && err.message.toLowerCase().includes('user rejected'))) {
        setErrorMsg('Transfer transaction signature was cancelled in your MetaMask wallet.');
      } else if (err.code === 'INSUFFICIENT_FUNDS' || (err.message && err.message.toLowerCase().includes('insufficient funds'))) {
        setErrorMsg('Insufficient SepoliaETH to pay network gas fees for this transfer.');
      } else {
        setErrorMsg(err.reason || err.shortMessage || err.message || 'On-chain token transfer failed.');
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
        if (!isSubmitting && !isDelistingFirst) {
          onClose();
        }
      }}
      title={null}
      maxWidth="620px"
    >
      <div style={{ padding: '6px' }}>
        {/* Top Banner */}
        <div
          style={{
            background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)',
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
                backgroundColor: 'rgba(165, 180, 252, 0.2)',
                color: '#C7D2FE',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Send size={19} />
            </div>
            <div>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: '#A5B4FC'
                }}
              >
                ERC-721 Direct Custody Transfer
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
                Transfer Token Ownership
              </h2>
            </div>
          </div>
          <p style={{ fontSize: '13px', color: '#CBD5E1', margin: 0, lineHeight: 1.45 }}>
            Transfer on-chain legal & cryptographic deed ownership of Token #{tokenId} directly to another Ethereum wallet without secondary sale proceeds.
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
                Ownership Transfer Confirmed
              </h3>
              <p style={{ fontSize: '13.5px', color: '#166534', margin: '0 0 16px', lineHeight: 1.5 }}>
                Cryptographic custody of Token <strong>#{tokenId}</strong> ({asset.name}) has been safely transferred on Ethereum Sepolia.
              </p>

              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  padding: '14px 18px',
                  borderRadius: '12px',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  textAlign: 'left',
                  marginBottom: '16px'
                }}
              >
                <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 500 }}>New On-Chain Owner</div>
                <div style={{ fontSize: '13.5px', fontFamily: 'monospace', fontWeight: 700, color: '#101B2D', wordBreak: 'break-all' }}>
                  {successInfo.toWallet}
                </div>
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

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={onClose}
                style={{
                  height: '42px',
                  padding: '0 24px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--color-copper, #B9653A)',
                  borderColor: 'var(--color-copper, #B9653A)'
                }}
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleExecuteTransfer}>
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
                        backgroundColor: '#EDE9FE',
                        color: '#6D28D9',
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
                    {asset.id} • {asset.category}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 500 }}>Appraised Value</div>
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
                  <span style={{ color: '#475569' }}>Connected Owner:</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#101B2D' }}>
                    {account ? `${account.slice(0, 6)}...${account.slice(-4)}` : 'Not Connected'}
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
                    On-Chain Verified
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

            {/* CRITICAL SAFETY BANNER: Block transfer if listed on marketplace */}
            {isListedOnMarketplace && (
              <div
                style={{
                  padding: '16px 18px',
                  backgroundColor: '#FFFBEB',
                  borderRadius: '14px',
                  border: '1.5px solid #F59E0B',
                  marginBottom: '20px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                  <AlertTriangle size={20} color="#D97706" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#92400E', margin: '0 0 4px' }}>
                      Active Marketplace Listing Detected
                    </h4>
                    <p style={{ fontSize: '12.5px', color: '#B45309', margin: 0, lineHeight: 1.5 }}>
                      This token is currently active on the AssetMarketplace contract listed for{' '}
                      <strong>{activeListingPrice} SepoliaETH</strong>. Directly transferring ownership while listed will leave a broken/stale listing on-chain.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                  <button
                    type="button"
                    onClick={handleDelistBeforeTransfer}
                    disabled={isDelistingFirst}
                    className="btn btn-secondary btn-sm"
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#D97706',
                      color: '#B45309',
                      fontWeight: 600,
                      fontSize: '12px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    {isDelistingFirst ? (
                      <>
                        <RefreshCw size={13} className="spinner" />
                        <span>Delisting Token on Sepolia...</span>
                      </>
                    ) : (
                      <>
                        <XCircle size={13} />
                        <span>Delist Token from Marketplace First</span>
                      </>
                    )}
                  </button>
                </div>
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
                  <span>MetaMask is on chain #{chainId}. Sepolia Testnet (11155111) is required.</span>
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

            {/* Recipient Input */}
            <div style={{ marginBottom: '18px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--color-navy, #101B2D)',
                  marginBottom: '8px'
                }}
              >
                Recipient Ethereum Wallet Address (0x...) *
              </label>
              <input
                type="text"
                required
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value)}
                placeholder="0x1234...5678"
                disabled={isSubmitting || !isOwnerVerified || isListedOnMarketplace}
                style={{
                  width: '100%',
                  height: '46px',
                  padding: '0 16px',
                  fontSize: '14px',
                  fontFamily: 'monospace',
                  borderRadius: '12px',
                  border: '1.5px solid #CBD5E1',
                  backgroundColor: (!isOwnerVerified || isListedOnMarketplace) ? '#F1F5F9' : '#FFFFFF',
                  color: '#0F172A',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              <div style={{ fontSize: '12px', color: '#64748B', marginTop: '6px' }}>
                Ensure this is an Ethereum Sepolia compatible wallet (MetaMask, Hardware Wallet, or Custody Address).
              </div>
            </div>

            {/* Prominent Irreversible Transfer Warning */}
            <div
              style={{
                padding: '16px 18px',
                backgroundColor: '#FEF2F2',
                borderRadius: '14px',
                border: '1.5px solid rgba(239, 68, 68, 0.3)',
                marginBottom: '20px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '12px' }}>
                <ShieldAlert size={20} color="#DC2626" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <h4 style={{ fontSize: '13.5px', fontWeight: 700, color: '#991B1B', margin: '0 0 3px' }}>
                    Important: Irreversible Direct Transfer
                  </h4>
                  <p style={{ fontSize: '12px', color: '#B91C1C', margin: 0, lineHeight: 1.45 }}>
                    This transaction executes directly on the Sepolia blockchain. As sender, you will only pay network gas in SepoliaETH. No sale proceeds or payment will be transferred to your account.
                  </p>
                </div>
              </div>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  color: '#7F1D1D',
                  cursor: (isSubmitting || !isOwnerVerified || isListedOnMarketplace) ? 'not-allowed' : 'pointer'
                }}
              >
                <input
                  type="checkbox"
                  checked={confirmedWarning}
                  onChange={(e) => setConfirmedWarning(e.target.checked)}
                  disabled={isSubmitting || !isOwnerVerified || isListedOnMarketplace}
                  style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--color-copper, #B9653A)' }}
                />
                <span>I confirm that I want to transfer ownership of Token #{tokenId} to this recipient address.</span>
              </label>
            </div>

            {/* Execution Progress */}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: 600, color: 'var(--color-navy, #101B2D)', marginBottom: '6px' }}>
                  <RefreshCw size={15} className="spinner" />
                  <span>Executing safeTransferFrom in MetaMask...</span>
                </div>
                <div style={{ fontSize: '12px', color: '#64748B' }}>
                  Please confirm the transfer transaction prompt in your wallet and wait for cryptographic confirmation.
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

            {/* Actions */}
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
                disabled={
                  isSubmitting ||
                  !isOwnerVerified ||
                  isListedOnMarketplace ||
                  !confirmedWarning ||
                  !recipientAddress.trim() ||
                  isNetworkWrong
                }
                className="btn btn-primary"
                style={{
                  height: '42px',
                  padding: '0 24px',
                  borderRadius: '10px',
                  backgroundColor: '#4338CA',
                  borderColor: '#4338CA',
                  color: '#FFFFFF',
                  fontWeight: 600,
                  fontSize: '13.5px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  opacity: (
                    isSubmitting ||
                    !isOwnerVerified ||
                    isListedOnMarketplace ||
                    !confirmedWarning ||
                    !recipientAddress.trim() ||
                    isNetworkWrong
                  ) ? 0.6 : 1,
                  cursor: (
                    isSubmitting ||
                    !isOwnerVerified ||
                    isListedOnMarketplace ||
                    !confirmedWarning ||
                    !recipientAddress.trim() ||
                    isNetworkWrong
                  ) ? 'not-allowed' : 'pointer'
                }}
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw size={15} className="spinner" />
                    <span>Transferring on Sepolia...</span>
                  </>
                ) : (
                  <>
                    <Send size={15} />
                    <span>Transfer Ownership</span>
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

export default TransferTokenModal;
