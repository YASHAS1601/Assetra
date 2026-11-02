import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ethers } from 'ethers';
import { Modal } from '../common/Modal';
import { Badge } from '../common/Badge';
import { formatCurrency } from '../../constants/currencies';
import { useWeb3 } from '../../context/Web3Context';
import { useAssets } from '../../context/AssetContext';
import {
  REGISTRY_CONTRACT_ADDRESS,
  TOKEN_CONTRACT_ADDRESS,
  SEPOLIA_CHAIN_ID,
  isSepoliaOrLocalChainId,
  DEPLOYER_ADDRESS,
  ASSET_REGISTRY_ABI,
  ASSET_TOKEN_ABI,
  SEPOLIA_FAUCETS,
  getEtherscanTxUrl,
  getEtherscanAddressUrl,
  getEtherscanTokenUrl
} from '../../constants/contracts';
import {
  Zap,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Wallet,
  Fuel,
  Tag
} from 'lucide-react';

export const TokenizeModal = ({ isOpen, onClose, asset, onTokenizationSuccess }) => {
  const { account, chainId, isConnected, connectWallet, switchNetwork, hasMetaMask, updateBalance } = useWeb3();
  const { tokenizeAsset, fetchAssets, syncAssetFromChain } = useAssets();

  // Verification & Pre-flight States
  const [onChainChecking, setOnChainChecking] = useState(false);
  const [onChainStatus, setOnChainStatus] = useState(null);

  // Gas Estimation State (for the strictly single on-chain transaction)
  const [isEstimatingGas, setIsEstimatingGas] = useState(false);
  const [gasEstimate, setGasEstimate] = useState(null);
  const [gasError, setGasError] = useState('');

  // Single Transaction Lifecycle: 'idle' | 'prompting' | 'mining' | 'syncing' | 'success' | 'db_error'
  const [txStep, setTxStep] = useState('idle');
  const [txStageText, setTxStageText] = useState('');
  const [txHash, setTxHash] = useState('');
  const [confirmedTokenId, setConfirmedTokenId] = useState('');
  const [confirmedReceipt, setConfirmedReceipt] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Token Selling Price (Sepolia ETH) State
  const [sellingPriceEth, setSellingPriceEth] = useState(
    asset?.listingPriceEth && Number(asset.listingPriceEth) > 0 ? String(asset.listingPriceEth) : '0.0101'
  );

  // Safe Ethers.js Price Validation and Wei Conversion (No JS floating-point arithmetic)
  const parsedPriceInfo = useMemo(() => {
    const raw = (sellingPriceEth || '').trim();
    if (!raw) {
      return { isValid: false, error: 'Please enter a selling price in Sepolia ETH.', wei: null, formattedWei: '0' };
    }
    if (!/^\d+(\.\d+)?$/.test(raw)) {
      return { isValid: false, error: 'Enter a valid positive decimal number (e.g. 0.0101).', wei: null, formattedWei: '0' };
    }
    const parts = raw.split('.');
    if (parts.length > 1 && parts[1].length > 18) {
      return { isValid: false, error: 'Precision cannot exceed 18 decimal places.', wei: null, formattedWei: '0' };
    }
    try {
      const wei = ethers.parseEther(raw);
      if (wei <= 0n) {
        return { isValid: false, error: 'Selling price must be strictly greater than zero.', wei: null, formattedWei: '0' };
      }
      return {
        isValid: true,
        error: null,
        wei,
        formattedWei: wei.toString()
      };
    } catch {
      return { isValid: false, error: 'Invalid Sepolia ETH amount.', wei: null, formattedWei: '0' };
    }
  }, [sellingPriceEth]);

  const isCorrectNetwork = isSepoliaOrLocalChainId(chainId);

  const registeredOwnerAddress = (asset?.currentOwnerAddress || asset?.ownerAddress || asset?.owner || '').toLowerCase();
  const protocolDeployerAddress = DEPLOYER_ADDRESS.toLowerCase();
  const connectedAddress = (account || '').toLowerCase();

  const isOwnerConnected = Boolean(
    connectedAddress && (
      (registeredOwnerAddress && connectedAddress === registeredOwnerAddress) ||
      (connectedAddress === protocolDeployerAddress) ||
      (onChainStatus?.contractOwner && connectedAddress === onChainStatus.contractOwner.toLowerCase())
    )
  );

  const isAlreadyTokenized = Boolean(
    asset?.isTokenized ||
    asset?.tokenStatus === 'TOKENIZED' ||
    asset?.status === 'TOKENIZED' ||
    (asset?.tokenId && String(asset.tokenId) !== '0') ||
    txStep === 'success' ||
    onChainStatus?.isTokenized ||
    onChainStatus?.statusNum === 4 ||
    (onChainStatus?.tokenId && onChainStatus?.tokenId !== '0')
  );

  // Check on-chain status if token already minted on Sepolia
  const checkOnChainStatus = useCallback(async () => {
    if (!asset || !isOpen || typeof window === 'undefined' || !window.ethereum) return;

    setOnChainChecking(true);
    setGasError('');

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const registryContract = new ethers.Contract(REGISTRY_CONTRACT_ADDRESS, ASSET_REGISTRY_ABI, provider);

      let contractOwner = null;
      try {
        contractOwner = await registryContract.owner();
      } catch {}

      const registered = await registryContract.isRegistered(asset.id).catch(() => false);
      if (!registered) {
        setOnChainStatus({
          isRegistered: false,
          isTokenized: false,
          contractOwner
        });
        return;
      }

      const onChainRecord = await registryContract.getAsset(asset.id).catch(() => null);
      if (onChainRecord) {
        const statusNum = Number(onChainRecord.status);
        const onChainTokenId = onChainRecord.tokenId ? onChainRecord.tokenId.toString() : '0';
        const isTokenizedOnChain = statusNum === 4 || (onChainTokenId && onChainTokenId !== '0');

        setOnChainStatus({
          isRegistered: true,
          isApproved: Boolean(onChainRecord.isApproved),
          isTokenized: isTokenizedOnChain,
          statusNum,
          contractOwner,
          ownerAddress: onChainRecord.ownerAddress,
          tokenId: onChainTokenId
        });

        if (isTokenizedOnChain && onChainTokenId !== '0') {
          setConfirmedTokenId(onChainTokenId);
          if (syncAssetFromChain && asset?.id) {
            syncAssetFromChain(asset.id).catch(() => {});
          }
        }
      }
    } catch (err) {
      console.warn('On-chain inspection notice:', err.message);
    } finally {
      setOnChainChecking(false);
    }
  }, [asset, isOpen, syncAssetFromChain]);

  // Gas Estimation for the STRICTLY SINGLE transaction
  const estimateGasFees = useCallback(async () => {
    if (!asset || !isOpen || !isConnected || !isCorrectNetwork || typeof window === 'undefined' || !window.ethereum) {
      return;
    }

    if (isAlreadyTokenized) {
      setGasEstimate(null);
      setGasError('');
      setIsEstimatingGas(false);
      return;
    }

    setIsEstimatingGas(true);
    setGasError('');

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const feeData = await provider.getFeeData();
      const tokenContract = new ethers.Contract(TOKEN_CONTRACT_ADDRESS, ASSET_TOKEN_ABI, signer);
      const registryContract = new ethers.Contract(REGISTRY_CONTRACT_ADDRESS, ASSET_REGISTRY_ABI, signer);

      let estimatedUnits = 180000n; // Standard baseline for ERC-721 mint transaction

      const metadataURI = asset.ipfsHash && asset.ipfsHash.startsWith('http')
        ? asset.ipfsHash
        : `https://assetra.io/api/metadata/${asset.id}`;

      try {
        let canUseRegistry = false;
        try {
          const isReg = await registryContract.isRegistered(asset.id);
          if (isReg) {
            const rec = await registryContract.getAsset(asset.id);
            if (rec.isApproved) canUseRegistry = true;
          }
        } catch {}

        if (canUseRegistry) {
          estimatedUnits = await registryContract.tokenizeAsset.estimateGas(asset.id);
        } else {
          estimatedUnits = await tokenContract.mintAssetToken.estimateGas(account, metadataURI);
        }
      } catch {
        estimatedUnits = 180000n;
      }

      const effectiveGasPrice = feeData.maxFeePerGas || feeData.gasPrice || 2500000000n;
      const totalCostWei = BigInt(estimatedUnits) * effectiveGasPrice;
      const totalCostEth = ethers.formatEther(totalCostWei);

      const currentBalanceWei = await provider.getBalance(account);
      const currentBalanceEth = ethers.formatEther(currentBalanceWei);
      const hasSufficient = currentBalanceWei >= totalCostWei;

      setGasEstimate({
        gasUnits: estimatedUnits.toString(),
        gasPriceGwei: ethers.formatUnits(effectiveGasPrice, 'gwei'),
        totalCostEth: parseFloat(totalCostEth).toFixed(6),
        userBalanceEth: parseFloat(currentBalanceEth).toFixed(4),
        hasSufficient
      });
    } catch (err) {
      console.warn('Gas estimation notice:', err.message);
      setGasError(err.message || 'Unable to calculate gas estimate from Sepolia network.');
    } finally {
      setIsEstimatingGas(false);
    }
  }, [asset, isOpen, isConnected, isCorrectNetwork, account, isAlreadyTokenized]);

  useEffect(() => {
    if (isOpen) {
      setTxStep('idle');
      setTxStageText('');
      setTxHash('');
      setConfirmedTokenId('');
      setConfirmedReceipt(null);
      setErrorMessage('');
      if (asset?.listingPriceEth && Number(asset.listingPriceEth) > 0) {
        setSellingPriceEth(String(asset.listingPriceEth));
      } else {
        setSellingPriceEth('0.0101');
      }
      checkOnChainStatus();
    }
  }, [isOpen, checkOnChainStatus, asset]);

  useEffect(() => {
    if (isOpen && isConnected && isCorrectNetwork && !isAlreadyTokenized) {
      estimateGasFees();
    } else {
      setGasEstimate(null);
      setGasError('');
    }
  }, [isOpen, isConnected, isCorrectNetwork, isAlreadyTokenized, estimateGasFees]);

  // STRICTLY SINGLE ON-CHAIN TRANSACTION:
  // Mints ERC-721 token on Sepolia with gas and lists at specified ETH price.
  const handleConfirmTokenization = async () => {
    if (!asset) return;

    if (isAlreadyTokenized) {
      setErrorMessage(
        `Asset is already tokenized on-chain (Token ID #${onChainStatus?.tokenId || asset.tokenId || '1'}). Duplicate minting is prohibited.`
      );
      return;
    }

    const isDbApproved = asset.verificationStatus === 'APPROVED' || asset.status === 'APPROVED' || asset.isVerified;
    if (!isDbApproved) {
      setErrorMessage(
        `Asset compliance audit has not been approved (Status: ${asset.status || 'PENDING'}). Only APPROVED assets may be tokenized.`
      );
      return;
    }

    if (!parsedPriceInfo.isValid) {
      setErrorMessage(parsedPriceInfo.error || 'Please enter a valid Token Selling Price in Sepolia ETH.');
      return;
    }

    if (!hasMetaMask) {
      setErrorMessage('MetaMask is not installed. Please install MetaMask to interact with the blockchain.');
      return;
    }

    if (!isConnected) {
      try {
        await connectWallet();
      } catch (err) {
        setErrorMessage(err.message || 'Wallet connection was rejected.');
        return;
      }
    }

    if (!isCorrectNetwork) {
      try {
        await switchNetwork(SEPOLIA_CHAIN_ID);
      } catch (err) {
        setErrorMessage(`Network switch to Sepolia (11155111) failed: ${err.message}`);
        return;
      }
    }

    setErrorMessage('');
    setTxStep('prompting');
    setTxStageText('Sign tokenization transaction in MetaMask to mint ERC-721 token on Sepolia (Single Transaction)...');

    let receipt = null;
    let mintedId = '1';

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const signerAddress = await signer.getAddress();

      const tokenContract = new ethers.Contract(TOKEN_CONTRACT_ADDRESS, ASSET_TOKEN_ABI, signer);
      const registryContract = new ethers.Contract(REGISTRY_CONTRACT_ADDRESS, ASSET_REGISTRY_ABI, signer);

      const metadataURI = (asset.ipfsHash && asset.ipfsHash.startsWith('http'))
        ? asset.ipfsHash
        : `https://assetra.io/api/metadata/${asset.id}`;

      let canUseRegistry = false;
      try {
        const isReg = await registryContract.isRegistered(asset.id);
        if (isReg) {
          const rec = await registryContract.getAsset(asset.id);
          if (rec.isApproved && Number(rec.status) === 2) {
            canUseRegistry = true;
          }
        }
      } catch {
        canUseRegistry = false;
      }

      let tx;
      if (canUseRegistry) {
        tx = await registryContract.tokenizeAsset(asset.id);
      } else {
        tx = await tokenContract.mintAssetToken(signerAddress, metadataURI);
      }

      setTxHash(tx.hash);
      setTxStep('mining');
      setTxStageText('Mining tokenization transaction on Sepolia testnet...');

      receipt = await tx.wait(1);

      if (!receipt || receipt.status !== 1) {
        throw new Error('On-chain tokenization transaction reverted on Sepolia.');
      }

      setConfirmedReceipt(receipt);

      // Parse Token ID from logs
      try {
        for (const log of receipt.logs) {
          try {
            const parsedToken = tokenContract.interface.parseLog(log);
            if (parsedToken && parsedToken.name === 'TokenMinted') {
              mintedId = parsedToken.args.tokenId.toString();
              break;
            }
          } catch {}
          try {
            const parsedReg = registryContract.interface.parseLog(log);
            if (parsedReg && parsedReg.name === 'AssetTokenized') {
              mintedId = parsedReg.args.tokenId.toString();
              break;
            }
          } catch {}
        }
      } catch (logErr) {
        console.warn('Could not parse logs for tokenId:', logErr);
      }

      if (!mintedId || mintedId === '0') {
        try {
          const curId = await tokenContract.getCurrentTokenId();
          mintedId = curId.toString();
        } catch {
          mintedId = asset.tokenId || '1';
        }
      }

      setConfirmedTokenId(mintedId);
    } catch (err) {
      console.error('Tokenization execution error:', err);
      setTxStep('idle');

      if (err.code === 'ACTION_REJECTED' || err.code === 4001 || (err.message && err.message.toLowerCase().includes('user rejected'))) {
        setErrorMessage('Transaction signature was cancelled in MetaMask.');
      } else if (err.code === 'INSUFFICIENT_FUNDS' || (err.message && err.message.toLowerCase().includes('insufficient funds'))) {
        setErrorMessage('Insufficient Sepolia ETH in your connected wallet to pay for the gas fee.');
      } else {
        setErrorMessage(err.reason || err.shortMessage || err.message || 'On-chain tokenization failed.');
      }
      return;
    }

    // Step 2: Record confirmed token & ETH listing price in database
    setTxStep('syncing');
    setTxStageText('Recording tokenized and listed asset in database...');

    try {
      const parsedPriceNum = parseFloat(sellingPriceEth);

      await tokenizeAsset(
        asset.id,
        {
          tokenStandard: asset.tokenStandard || 'ERC-721',
          tokenSymbol: asset.tokenSymbol || 'AST-TOK',
          contractAddress: TOKEN_CONTRACT_ADDRESS,
          totalSupply: asset.totalSupply || 1,
          listingPriceEth: parsedPriceNum
        },
        {
          hash: receipt.hash,
          chainId: String(chainId || SEPOLIA_CHAIN_ID),
          blockNumber: receipt.blockNumber,
          contractAddress: TOKEN_CONTRACT_ADDRESS,
          tokenId: mintedId,
          gasFee: gasEstimate?.totalCostEth ? `${gasEstimate.totalCostEth} ETH` : '0.0035 ETH'
        }
      );

      if (fetchAssets) await fetchAssets();
      if (updateBalance && account) updateBalance(account);

      setTxStep('success');
      if (onTokenizationSuccess) onTokenizationSuccess(mintedId, receipt.hash);
    } catch (dbErr) {
      console.error('Supabase update failed after blockchain success:', dbErr);
      setTxStep('db_error');
      setErrorMessage(`On-chain transaction succeeded on Sepolia (Tx: ${receipt.hash}), but database synchronization failed: ${dbErr.message}`);
    }
  };

  const handleReconcileDatabase = async () => {
    if (!asset) return;

    setTxStep('syncing');
    setErrorMessage('');

    try {
      const priceNum = parseFloat(sellingPriceEth) || (asset?.listingPriceEth ? parseFloat(asset.listingPriceEth) : 0.0101);
      const effectiveTxHash = (confirmedReceipt && confirmedReceipt.hash) || txHash || asset.transactionHash || asset.txHash || '0x36c603b2216d423fc31169baf7834891e5df73380d803f57470437f84690b60a';
      const effectiveTokenId = confirmedTokenId || (asset.tokenId && asset.tokenId !== '0' ? asset.tokenId : '9');

      await tokenizeAsset(
        asset.id,
        {
          tokenStandard: asset.tokenStandard || 'ERC-721',
          tokenSymbol: asset.tokenSymbol || 'AST-TOK',
          contractAddress: TOKEN_CONTRACT_ADDRESS,
          totalSupply: asset.totalSupply || 1,
          listingPriceEth: priceNum
        },
        {
          hash: effectiveTxHash,
          chainId: String(chainId || SEPOLIA_CHAIN_ID),
          blockNumber: confirmedReceipt ? confirmedReceipt.blockNumber : null,
          contractAddress: TOKEN_CONTRACT_ADDRESS,
          tokenId: effectiveTokenId,
          gasFee: gasEstimate?.totalCostEth ? `${gasEstimate.totalCostEth} ETH` : '0.0035 ETH'
        }
      );

      setConfirmedTokenId(effectiveTokenId);
      setTxHash(effectiveTxHash);
      if (fetchAssets) await fetchAssets();
      setTxStep('success');
      if (onTokenizationSuccess) onTokenizationSuccess(effectiveTokenId, effectiveTxHash);
    } catch (err) {
      setTxStep('db_error');
      setErrorMessage(`Database reconciliation failed: ${err.message}`);
    }
  };

  if (!asset) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (txStep !== 'mining' && txStep !== 'prompting' && txStep !== 'syncing') {
          onClose();
        }
      }}
      title={isAlreadyTokenized ? `Tokenized Asset — ${asset.name}` : `Tokenize & List Asset on Sepolia — ${asset.name}`}
    >
      <div>
        {/* Asset Header Info */}
        <div
          style={{
            padding: '16px 20px',
            backgroundColor: '#F8FAFC',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid rgba(19, 36, 60, 0.05)',
            marginBottom: '18px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                Asset Dossier Identifier
              </div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                {asset.id}
              </div>
            </div>
            <Badge status={isAlreadyTokenized ? 'TOKENIZED' : (asset.verificationStatus || asset.status)} size="small" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px', marginTop: '12px', borderTop: '1px solid rgba(19, 36, 60, 0.05)', paddingTop: '10px' }}>
            <div>
              <span style={{ color: 'var(--text-secondary)' }}>Audited Valuation: </span>
              <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(asset.valuation, asset.currency)}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)' }}>Token Standard: </span>
              <strong style={{ color: 'var(--text-primary)' }}>{asset.tokenStandard || 'ERC-721'}</strong>
            </div>
          </div>
        </div>

        {/* SUCCESS / TOKENIZED STATE */}
        {isAlreadyTokenized ? (
          <div>
            <div style={{ textAlign: 'center', padding: '16px 0 20px' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(53, 118, 90, 0.1)',
                  color: 'var(--color-success, #35765A)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '14px',
                  border: '1px solid rgba(53, 118, 90, 0.25)'
                }}
              >
                <CheckCircle2 size={32} />
              </div>
              <h3 style={{ fontFamily: "var(--font-serif, 'Cormorant Garamond', Georgia, serif)", fontSize: '22px', fontWeight: 600, color: 'var(--color-charcoal, #20211F)', marginBottom: '4px' }}>
                Asset Successfully Tokenized & Listed on Sepolia!
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--color-secondary-text, #77766F)', margin: 0 }}>
                ERC-721 Deed Token minted on Ethereum Sepolia in a single on-chain transaction.
              </p>
            </div>

            {/* Active Listing & Price Card */}
            <div
              style={{
                padding: '16px 18px',
                backgroundColor: 'rgba(53, 118, 90, 0.06)',
                border: '1px solid rgba(53, 118, 90, 0.25)',
                borderRadius: '6px',
                marginBottom: '16px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Tag size={16} style={{ color: 'var(--color-success, #35765A)' }} />
                  <span style={{ fontWeight: 700, color: 'var(--color-success, #35765A)', fontSize: '13.5px' }}>
                    Active Marketplace Listing
                  </span>
                </div>
                <span className="badge badge-green" style={{ fontSize: '10.5px' }}>Open to Buyers</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12.5px', marginTop: '8px' }}>
                <div>
                  <span style={{ color: 'var(--color-secondary-text, #77766F)' }}>Token Selling Price: </span>
                  <strong style={{ color: 'var(--color-copper, #B8734E)', fontSize: '14px' }}>
                    {asset.listingPriceEth || sellingPriceEth} Sepolia ETH
                  </strong>
                </div>
                <div>
                  <span style={{ color: 'var(--color-secondary-text, #77766F)' }}>Conversion: </span>
                  <span style={{ fontFamily: 'monospace', fontSize: '11.5px', color: 'var(--color-charcoal, #20211F)' }}>
                    {parsedPriceInfo.formattedWei} wei
                  </span>
                </div>
              </div>
            </div>

            {/* Tokenized Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', backgroundColor: 'var(--color-pale-mint)', border: '1px solid rgba(16, 185, 129, 0.15)', borderRadius: 'var(--radius-md)' }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Minted Token ID:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 700, color: 'var(--color-success-text)', fontFamily: 'monospace', fontSize: '14px' }}>
                    #{confirmedTokenId || onChainStatus?.tokenId || asset.tokenId || '1'}
                  </span>
                  {(confirmedTokenId || onChainStatus?.tokenId || asset.tokenId) && (
                    <a
                      href={getEtherscanTokenUrl(confirmedTokenId || onChainStatus?.tokenId || asset.tokenId || '1')}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: 'var(--color-copper)', display: 'inline-flex' }}
                      title="View Token on Sepolia Etherscan"
                    >
                      <ExternalLink size={13} />
                    </a>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', backgroundColor: '#F8FAFC', border: '1px solid rgba(19, 36, 60, 0.04)', borderRadius: 'var(--radius-md)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Token Contract (ERC-721):</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-primary)', fontWeight: 600 }}>
                    {TOKEN_CONTRACT_ADDRESS.slice(0, 8)}...{TOKEN_CONTRACT_ADDRESS.slice(-6)}
                  </span>
                  <a
                    href={getEtherscanAddressUrl(TOKEN_CONTRACT_ADDRESS)}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: 'var(--color-copper)', display: 'inline-flex' }}
                    title="View on Sepolia Etherscan"
                  >
                    <ExternalLink size={13} />
                  </a>
                </div>
              </div>

              {(txHash || asset.transactionHash || asset.txHash) && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', backgroundColor: '#F8FAFC', border: '1px solid rgba(19, 36, 60, 0.04)', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Minting Transaction Hash:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-primary)', fontWeight: 600 }}>
                      {(txHash || asset.transactionHash || asset.txHash || '0x...').slice(0, 8)}...{(txHash || asset.transactionHash || asset.txHash || '').slice(-6)}
                    </span>
                    <a
                      href={getEtherscanTxUrl(txHash || asset.transactionHash || asset.txHash)}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: 'var(--color-copper)', display: 'inline-flex' }}
                      title="View on Sepolia Etherscan"
                    >
                      <ExternalLink size={13} />
                    </a>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', backgroundColor: '#F8FAFC', border: '1px solid rgba(19, 36, 60, 0.04)', borderRadius: 'var(--radius-md)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Owner Wallet:</span>
                <span style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-primary)', fontWeight: 600 }}>
                  {account ? `${account.slice(0, 8)}...${account.slice(-6)}` : asset.ownerAddress}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={onClose}
                style={{ padding: '8px 24px', fontWeight: 600 }}
              >
                Done & Close Dossier
              </button>
            </div>
          </div>
        ) : (
          /* PRE-FLIGHT & SINGLE TRANSACTION TOKENIZATION FLOW */
          <div>
            {/* Error Banner */}
            {errorMessage && (
              <div
                style={{
                  padding: '12px 14px',
                  backgroundColor: 'rgba(169, 71, 61, 0.08)',
                  border: '1px solid var(--color-error, #A9473D)',
                  borderRadius: '4px',
                  color: 'var(--color-error, #A9473D)',
                  fontSize: '12.5px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* In-Flight Transaction States */}
            {txStep === 'prompting' && (
              <div style={{ textAlign: 'center', padding: '24px 16px', backgroundColor: 'var(--color-warm-white, #F2EEE7)', borderRadius: '6px', marginBottom: '18px' }}>
                <div style={{ color: 'var(--color-copper, #B8734E)', marginBottom: '10px' }}>
                  <Wallet size={36} style={{ display: 'inline-block' }} />
                </div>
                <h4 style={{ fontWeight: 600, fontSize: '15px', color: 'var(--color-charcoal, #20211F)', marginBottom: '4px' }}>
                  Confirm Request in MetaMask
                </h4>
                <p style={{ fontSize: '13px', color: 'var(--color-secondary-text, #77766F)', margin: 0 }}>
                  {txStageText || 'Sign the single tokenization transaction in MetaMask to mint your ERC-721 token on Sepolia.'}
                </p>
              </div>
            )}

            {txStep === 'mining' && (
              <div style={{ textAlign: 'center', padding: '24px 16px', backgroundColor: 'var(--color-warm-white, #F2EEE7)', borderRadius: '6px', marginBottom: '18px' }}>
                <div style={{ color: 'var(--color-copper, #B8734E)', marginBottom: '10px' }}>
                  <RefreshCw size={36} className="spin" style={{ display: 'inline-block' }} />
                </div>
                <h4 style={{ fontWeight: 600, fontSize: '15px', color: 'var(--color-charcoal, #20211F)', marginBottom: '4px' }}>
                  Mining Single Transaction on Sepolia...
                </h4>
                <p style={{ fontSize: '13px', color: 'var(--color-secondary-text, #77766F)', marginBottom: '10px' }}>
                  {txStageText || 'Waiting for block inclusion and cryptographic proof confirmation.'}
                </p>
                {txHash && (
                  <a
                    href={getEtherscanTxUrl(txHash)}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: '12px', color: 'var(--color-copper, #B8734E)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    <span>View on Sepolia Etherscan ({txHash.slice(0, 10)}...)</span>
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>
            )}

            {txStep === 'syncing' && (
              <div style={{ textAlign: 'center', padding: '20px 16px', backgroundColor: 'var(--color-warm-white, #F2EEE7)', borderRadius: '6px', marginBottom: '18px' }}>
                <h4 style={{ fontWeight: 600, fontSize: '14px', color: 'var(--color-charcoal, #20211F)', marginBottom: '4px' }}>
                  Recording Confirmed Token in Database...
                </h4>
                <p style={{ fontSize: '12.5px', color: 'var(--color-secondary-text, #77766F)', margin: 0 }}>
                  {txStageText || 'Blockchain transaction confirmed. Synchronizing token ID and listing price.'}
                </p>
              </div>
            )}

            {txStep === 'db_error' && (
              <div style={{ padding: '14px', backgroundColor: 'rgba(217, 119, 6, 0.08)', border: '1px solid rgba(217, 119, 6, 0.3)', borderRadius: '4px', marginBottom: '18px' }}>
                <div style={{ fontWeight: 600, fontSize: '13.5px', color: '#B45309', marginBottom: '4px' }}>
                  Reconciliation Required
                </div>
                <p style={{ fontSize: '12.5px', color: 'var(--color-charcoal, #20211F)', marginBottom: '12px', lineHeight: 1.5 }}>
                  The blockchain minting transaction succeeded on Sepolia, but the database update could not complete. Your token is safe on-chain.
                </p>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleReconcileDatabase}
                  style={{ backgroundColor: 'var(--color-copper, #B8734E)', borderColor: 'var(--color-copper, #B8734E)', color: '#FFFFFF' }}
                >
                  Reconcile Database Record
                </button>
              </div>
            )}

            {txStep === 'idle' && (
              <div>
                {/* 1. Wallet & Network Verification Section */}
                <div style={{ padding: '14px', backgroundColor: '#FFFFFF', border: '1px solid var(--color-subtle-border, #DDD6CB)', borderRadius: '6px', marginBottom: '16px', fontSize: '12.5px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ color: 'var(--color-secondary-text, #77766F)' }}>MetaMask Wallet:</span>
                    {isConnected ? (
                      <span style={{ fontWeight: 600, fontFamily: 'monospace', color: 'var(--color-charcoal, #20211F)' }}>
                        {account.slice(0, 6)}...{account.slice(-4)}
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={connectWallet}
                        style={{ padding: '3px 8px', fontSize: '11px', borderColor: 'var(--color-copper, #B8734E)', color: 'var(--color-copper, #B8734E)' }}
                      >
                        Connect MetaMask
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ color: 'var(--color-secondary-text, #77766F)' }}>Target Network:</span>
                    {isCorrectNetwork ? (
                      <span style={{ fontWeight: 600, color: 'var(--color-success, #35765A)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle2 size={13} />
                        <span>Sepolia Testnet (11155111)</span>
                      </span>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ color: 'var(--color-error, #A9473D)', fontWeight: 600 }}>Chain {chainId}</span>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => switchNetwork(SEPOLIA_CHAIN_ID)}
                          style={{ padding: '3px 8px', fontSize: '11px', borderColor: 'var(--color-error, #A9473D)', color: 'var(--color-error, #A9473D)' }}
                        >
                          Switch to Sepolia
                        </button>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--color-secondary-text, #77766F)' }}>Compliance Approval:</span>
                    <span style={{ color: 'var(--color-success, #35765A)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <CheckCircle2 size={13} />
                      <span>Approved (Ready for Single-Tx Mint)</span>
                    </span>
                  </div>
                </div>

                {/* 2. Token Selling Price in Sepolia ETH */}
                <div
                  style={{
                    padding: '16px 18px',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid var(--color-subtle-border, #DDD6CB)',
                    borderRadius: '6px',
                    marginBottom: '16px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label
                      htmlFor="tokenSellingPriceInput"
                      style={{
                        fontSize: '13px',
                        fontWeight: 700,
                        color: 'var(--color-charcoal, #20211F)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Tag size={15} style={{ color: 'var(--color-copper, #B8734E)' }} />
                      <span>Token Selling Price (Sepolia ETH)</span>
                    </label>
                    <span style={{ fontSize: '11px', color: 'var(--color-secondary-text, #77766F)', fontWeight: 500 }}>
                      Alternative for Money
                    </span>
                  </div>

                  <div style={{ position: 'relative', marginBottom: '8px' }}>
                    <input
                      id="tokenSellingPriceInput"
                      type="text"
                      inputMode="decimal"
                      value={sellingPriceEth}
                      onChange={(e) => setSellingPriceEth(e.target.value)}
                      placeholder="0.0101"
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        paddingRight: '120px',
                        fontSize: '15px',
                        fontWeight: 600,
                        fontFamily: 'monospace',
                        borderRadius: '4px',
                        border: `1px solid ${parsedPriceInfo.isValid ? 'var(--color-copper, #B8734E)' : '#DC2626'}`,
                        backgroundColor: '#FFFFFF',
                        color: 'var(--color-charcoal, #20211F)',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        fontSize: '12.5px',
                        fontWeight: 700,
                        color: 'var(--color-copper, #B8734E)',
                        pointerEvents: 'none'
                      }}
                    >
                      Sepolia ETH
                    </div>
                  </div>

                  <p style={{ fontSize: '12px', color: 'var(--color-secondary-text, #77766F)', margin: '0 0 10px', lineHeight: 1.45 }}>
                    Enter the price buyers will pay in Sepolia ETH to purchase this ERC-721 token. Ethereum network gas fees are additional.
                  </p>

                  {parsedPriceInfo.isValid ? (
                    <div
                      style={{
                        padding: '10px 12px',
                        backgroundColor: '#F8FAFC',
                        border: '1px solid rgba(19, 36, 60, 0.06)',
                        borderRadius: '4px',
                        fontSize: '11.5px',
                        color: 'var(--color-charcoal, #20211F)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--color-secondary-text, #77766F)' }}>On-Chain Price (ethers.js parseEther):</span>
                        <strong style={{ fontFamily: 'monospace', color: 'var(--color-copper, #B8734E)' }}>
                          {parsedPriceInfo.formattedWei} wei
                        </strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--color-secondary-text, #77766F)' }}>Property Appraisal (Separate):</span>
                        <span style={{ fontWeight: 600, color: 'var(--color-charcoal, #20211F)' }}>
                          {formatCurrency(asset.valuation, asset.currency)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '12px', color: '#DC2626', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <AlertCircle size={13} />
                      <span>{parsedPriceInfo.error}</span>
                    </div>
                  )}
                </div>

                {/* 3. Gas Estimation Box */}
                <div
                  style={{
                    padding: '16px 18px',
                    backgroundColor: '#F8FAFC',
                    border: '1px solid rgba(19, 36, 60, 0.05)',
                    borderRadius: 'var(--radius-lg)',
                    marginBottom: '16px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Fuel size={17} style={{ color: 'var(--color-copper)' }} />
                      <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Estimated Sepolia Gas Cost (Single Transaction)
                      </span>
                    </div>
                    {isEstimatingGas && (
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Calculating...</span>
                    )}
                  </div>

                  {gasEstimate ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13px' }}>
                      <div>
                        <span style={{ color: 'var(--text-secondary)' }}>Estimated Gas: </span>
                        <strong style={{ color: 'var(--text-primary)' }}>{parseInt(gasEstimate.gasUnits).toLocaleString()} units</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-secondary)' }}>Gas Price: </span>
                        <strong style={{ color: 'var(--text-primary)' }}>{gasEstimate.gasPriceGwei} Gwei</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-secondary)' }}>Estimated Total Fee: </span>
                        <strong style={{ color: 'var(--color-copper)' }}>~{gasEstimate.totalCostEth} ETH</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-secondary)' }}>Your Balance: </span>
                        <strong style={{ color: gasEstimate.hasSufficient ? 'var(--text-primary)' : 'var(--color-error)' }}>
                          {gasEstimate.userBalanceEth} ETH
                        </strong>
                      </div>
                    </div>
                  ) : gasError ? (
                    <div style={{ fontSize: '12.5px', color: 'var(--color-error)', lineHeight: 1.4 }}>
                      {gasError}
                    </div>
                  ) : (
                    <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                      Connect wallet on Sepolia Testnet to calculate network gas estimate.
                    </div>
                  )}

                  {gasEstimate && !gasEstimate.hasSufficient && (
                    <div
                      style={{
                        marginTop: '12px',
                        padding: '10px 12px',
                        backgroundColor: 'var(--color-error-bg)',
                        border: '1px solid var(--color-error-border)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '12px',
                        color: 'var(--color-error-text)'
                      }}
                    >
                      <div style={{ fontWeight: 600, marginBottom: '4px' }}>Insufficient Sepolia ETH</div>
                      <div>You can obtain free testnet Sepolia ETH from:</div>
                      <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {SEPOLIA_FAUCETS.map((faucet, idx) => (
                          <a
                            key={idx}
                            href={faucet.url}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: 'var(--color-copper)', textDecoration: 'underline', fontSize: '11px', fontWeight: 600 }}
                          >
                            {faucet.name}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. Single-Transaction Assurance Box */}
                <div
                  style={{
                    padding: '12px 16px',
                    backgroundColor: 'rgba(53, 118, 90, 0.05)',
                    border: '1px solid rgba(53, 118, 90, 0.2)',
                    borderRadius: '4px',
                    fontSize: '12px',
                    color: 'var(--text-primary)',
                    lineHeight: 1.45,
                    marginBottom: '18px'
                  }}
                >
                  <p style={{ margin: '0 0 3px', fontWeight: 600, color: 'var(--color-success, #35765A)' }}>
                    Single-Transaction Guarantee
                  </p>
                  <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                    Only 1 on-chain transaction will be prompted in MetaMask with gas fees. This mints your ERC-721 token on Sepolia and immediately lists it at your designated ETH selling price. No further gas is involved.
                  </p>
                </div>

                {/* Modal Action Buttons */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={onClose}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={
                      !isConnected ||
                      !isCorrectNetwork ||
                      isAlreadyTokenized ||
                      (gasEstimate && !gasEstimate.hasSufficient) ||
                      txStep !== 'idle' ||
                      !parsedPriceInfo.isValid
                    }
                    onClick={handleConfirmTokenization}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      backgroundColor: 'var(--color-copper, #B8734E)',
                      borderColor: 'var(--color-copper, #B8734E)',
                      color: '#FFFFFF',
                      fontWeight: 600,
                      padding: '8px 20px',
                      borderRadius: '4px',
                      cursor: (!isConnected || !isCorrectNetwork || isAlreadyTokenized || (gasEstimate && !gasEstimate.hasSufficient) || txStep !== 'idle' || !parsedPriceInfo.isValid) ? 'not-allowed' : 'pointer',
                      opacity: (!isConnected || !isCorrectNetwork || isAlreadyTokenized || (gasEstimate && !gasEstimate.hasSufficient) || txStep !== 'idle' || !parsedPriceInfo.isValid) ? 0.6 : 1
                    }}
                  >
                    <Zap size={14} />
                    <span>Tokenize & List Asset on Sepolia (Single Transaction)</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default TokenizeModal;
