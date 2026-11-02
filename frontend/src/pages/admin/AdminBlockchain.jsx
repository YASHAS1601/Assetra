import React, { useState } from 'react';
import { useAssets } from '../../context/AssetContext';
import { useWeb3 } from '../../context/Web3Context';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { formatCurrency } from '../../constants/currencies';
import { ethers } from 'ethers';
import {
  Cpu,
  Layers,
  Wallet,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Send,
  RefreshCw,
  FileCode,
  Lock,
  ArrowRight
} from 'lucide-react';

import {
  REGISTRY_CONTRACT_ADDRESS,
  TOKEN_CONTRACT_ADDRESS,
  MARKETPLACE_CONTRACT_ADDRESS,
  SEPOLIA_CHAIN_ID,
  isSepoliaOrLocalChainId,
  ASSET_REGISTRY_ABI,
  getAssetRegistryContract,
  getEtherscanTxUrl,
  getEtherscanAddressUrl
} from '../../constants/contracts';

export const AdminBlockchain = () => {
  const { assets, tokenizeAsset, fetchAssets } = useAssets();
  const { account, chainId, isConnected, isConnecting, isSepolia, connectWallet, switchToSepolia, getSigner } = useWeb3();

  const [selectedAsset, setSelectedAsset] = useState(null);
  const [tokenStandard, setTokenStandard] = useState('ERC-721');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [totalSupply, setTotalSupply] = useState('1');
  const [isMinting, setIsMinting] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });

  // Only APPROVED and NOT YET TOKENIZED assets are eligible for tokenization
  const tokenizedAssets = assets.filter((a) => a.status === 'TOKENIZED' || a.tokenStatus === 'TOKENIZED');
  const eligibleAssets = assets.filter(
    (a) => (a.status === 'APPROVED' || a.verificationStatus === 'APPROVED') && a.status !== 'TOKENIZED' && a.tokenStatus !== 'TOKENIZED'
  );

  const handleOpenMintModal = (asset) => {
    setSelectedAsset(asset);
    setTokenSymbol(asset.tokenSymbol || `${asset.category.slice(0, 3).toUpperCase()}-${asset.id.slice(-3)}`);
    setTotalSupply(asset.totalSupply ? String(asset.totalSupply) : '1');
    setStatusMessage({ type: '', text: '' });
  };

  const handleExecuteTokenization = async (e) => {
    e.preventDefault();
    if (!selectedAsset) return;

    if (!isConnected) {
      setStatusMessage({
        type: 'error',
        text: 'Administrator wallet not connected. Please connect MetaMask to submit on-chain minting.'
      });
      return;
    }

    if (!isSepoliaOrLocalChainId(chainId)) {
      try {
        await switchToSepolia();
      } catch (swErr) {
        setStatusMessage({
          type: 'error',
          text: `Please switch MetaMask network to Ethereum Sepolia (11155111).`
        });
        return;
      }
    }

    setIsMinting(true);
    setStatusMessage({ type: 'info', text: 'Requesting on-chain tokenizeAsset transaction signature in MetaMask...' });

    try {
      const signer = await getSigner();
      const registryContract = getAssetRegistryContract(signer);

      // Verify on-chain registration & approval
      const isReg = await registryContract.isRegistered(selectedAsset.id);
      if (!isReg) {
        throw new Error(`Asset ${selectedAsset.id} is not registered on-chain in AssetRegistry. Approve on-chain first.`);
      }

      const onChainRecord = await registryContract.getAsset(selectedAsset.id);
      if (Number(onChainRecord.status) === 4 || (onChainRecord.tokenId && onChainRecord.tokenId.toString() !== '0')) {
        throw new Error(
          `Asset ${selectedAsset.id} is already tokenized on-chain (ERC-721 Token ID #${onChainRecord.tokenId.toString()}). Minting another token is not permitted.`
        );
      }

      if (!onChainRecord.isApproved) {
        throw new Error(`Asset ${selectedAsset.id} must have on-chain approval before tokenization.`);
      }

      const tx = await registryContract.tokenizeAsset(selectedAsset.id);
      setStatusMessage({
        type: 'info',
        text: `Transaction broadcast! Waiting for Sepolia block confirmation: ${tx.hash.slice(0, 16)}...`
      });

      const receipt = await tx.wait(1);
      if (!receipt || receipt.status !== 1) {
        throw new Error('On-chain tokenization transaction reverted on Sepolia.');
      }

      // Parse minted token ID from AssetTokenized event
      let mintedTokenId = '1';
      for (const log of receipt.logs) {
        try {
          const parsed = registryContract.interface.parseLog(log);
          if (parsed && parsed.name === 'AssetTokenized') {
            mintedTokenId = parsed.args.tokenId.toString();
            break;
          }
        } catch {
          // Ignore logs from other contracts
        }
      }

      // Persist tokenization in Supabase
      await tokenizeAsset(
        selectedAsset.id,
        {
          tokenStandard: 'ERC-721',
          tokenSymbol,
          totalSupply: 1,
          contractAddress: TOKEN_CONTRACT_ADDRESS
        },
        {
          hash: receipt.hash,
          blockNumber: receipt.blockNumber,
          chainId: SEPOLIA_CHAIN_ID,
          tokenId: mintedTokenId,
          gasFee: '0.0050 ETH'
        }
      );

      if (fetchAssets) await fetchAssets();

      setStatusMessage({
        type: 'success',
        text: `Asset tokenized successfully! Minted ERC-721 Token ID #${mintedTokenId} confirmed on Sepolia block #${receipt.blockNumber}.`
      });

      setTimeout(() => {
        setSelectedAsset(null);
        setStatusMessage({ type: '', text: '' });
      }, 3500);
    } catch (err) {
      console.error('Tokenization execution error:', err);
      const errMsg = err.reason || err.shortMessage || err.message || 'Tokenization minting failed.';
      setStatusMessage({ type: 'error', text: errMsg });
    } finally {
      setIsMinting(false);
    }
  };

  return (
    <div style={{ paddingBottom: '48px' }}>
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--color-copper)'
              }}
            >
              Smart Contract Engine
            </span>
          </div>
          <h2
            className="font-serif"
            style={{
              fontSize: '32px',
              fontWeight: 600,
              color: 'var(--color-charcoal)',
              letterSpacing: '-0.02em',
              lineHeight: 1.2
            }}
          >
            Blockchain Minting & Smart Contract Operations
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--color-secondary-text)', marginTop: '4px' }}>
            Inspect deployed Sepolia protocol contracts (Chain ID: 11155111), tokenize verified assets, and monitor on-chain state.
          </p>
        </div>
      </div>

      {/* Protocol Smart Contract Infrastructure Overview */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '20px',
          marginBottom: '32px'
        }}
      >
        <div
          style={{
            padding: '24px',
            backgroundColor: '#FFFFFF',
            borderRadius: '24px',
            boxShadow: 'var(--shadow-card)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--color-peach)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Cpu size={18} style={{ color: 'var(--color-copper)' }} />
              </div>
              <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-secondary-text)', letterSpacing: '0.06em' }}>
                AssetRegistry
              </span>
            </div>
            <a
              href={getEtherscanAddressUrl(REGISTRY_CONTRACT_ADDRESS)}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--color-copper)', fontSize: '12px' }}
            >
              <ExternalLink size={14} />
            </a>
          </div>
          <div style={{ backgroundColor: '#F8FAFC', padding: '10px 14px', borderRadius: '12px' }}>
            <code style={{ fontFamily: 'monospace', fontSize: '11.5px', color: 'var(--color-charcoal)', display: 'block', wordBreak: 'break-all' }}>
              {REGISTRY_CONTRACT_ADDRESS}
            </code>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-secondary-text)', marginTop: '10px' }}>
            Lifecycle & Compliance • Verifier Gated
          </div>
        </div>

        <div
          style={{
            padding: '24px',
            backgroundColor: '#FFFFFF',
            borderRadius: '24px',
            boxShadow: 'var(--shadow-card)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--color-mint)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileCode size={18} style={{ color: '#1B6A4C' }} />
              </div>
              <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-secondary-text)', letterSpacing: '0.06em' }}>
                AssetToken
              </span>
            </div>
            <a
              href={getEtherscanAddressUrl(TOKEN_CONTRACT_ADDRESS)}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--color-copper)', fontSize: '12px' }}
            >
              <ExternalLink size={14} />
            </a>
          </div>
          <div style={{ backgroundColor: '#F8FAFC', padding: '10px 14px', borderRadius: '12px' }}>
            <code style={{ fontFamily: 'monospace', fontSize: '11.5px', color: 'var(--color-charcoal)', display: 'block', wordBreak: 'break-all' }}>
              {TOKEN_CONTRACT_ADDRESS}
            </code>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-secondary-text)', marginTop: '10px' }}>
            ERC-721 Token Standard • ASTRWA
          </div>
        </div>

        <div
          style={{
            padding: '24px',
            backgroundColor: '#FFFFFF',
            borderRadius: '24px',
            boxShadow: 'var(--shadow-card)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--color-lavender)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Layers size={18} style={{ color: '#5B4EB1' }} />
              </div>
              <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-secondary-text)', letterSpacing: '0.06em' }}>
                AssetMarketplace
              </span>
            </div>
            <a
              href={getEtherscanAddressUrl(MARKETPLACE_CONTRACT_ADDRESS)}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--color-copper)', fontSize: '12px' }}
            >
              <ExternalLink size={14} />
            </a>
          </div>
          <div style={{ backgroundColor: '#F8FAFC', padding: '10px 14px', borderRadius: '12px' }}>
            <code style={{ fontFamily: 'monospace', fontSize: '11.5px', color: 'var(--color-charcoal)', display: 'block', wordBreak: 'break-all' }}>
              {MARKETPLACE_CONTRACT_ADDRESS}
            </code>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-secondary-text)', marginTop: '10px' }}>
            Trustless Escrow & Atomic Purchases
          </div>
        </div>

        <div
          style={{
            padding: '24px',
            backgroundColor: '#FFFFFF',
            borderRadius: '24px',
            boxShadow: 'var(--shadow-card)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: isConnected ? 'var(--color-mint)' : 'var(--color-peach)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Wallet size={18} style={{ color: isConnected ? '#1B6A4C' : '#B9653A' }} />
              </div>
              <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-secondary-text)', letterSpacing: '0.06em' }}>
                Admin Signer Status
              </span>
            </div>
            {isConnected ? (
              <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#1B6A4C', backgroundColor: 'var(--color-mint)', padding: '4px 10px', borderRadius: '9999px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={12} /> Connected
              </span>
            ) : (
              <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#B9653A', backgroundColor: 'var(--color-peach)', padding: '4px 10px', borderRadius: '9999px' }}>
                Disconnected
              </span>
            )}
          </div>

          {isConnected ? (
            <div>
              <div style={{ backgroundColor: '#F8FAFC', padding: '10px 14px', borderRadius: '12px' }}>
                <code style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--color-charcoal)' }}>
                  {account.slice(0, 8)}...{account.slice(-6)}
                </code>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-secondary-text)', marginTop: '10px' }}>
                Network Chain ID: {chainId} {chainId === 31337 || chainId === 1337 ? '(Hardhat Local)' : ''}
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={connectWallet}
              disabled={isConnecting}
              style={{
                backgroundColor: 'var(--color-navy)',
                border: 'none',
                borderRadius: '9999px',
                color: '#FFFFFF',
                width: '100%',
                padding: '9px 16px',
                fontSize: '12.5px',
                fontWeight: 600,
                marginTop: '8px',
                cursor: 'pointer'
              }}
            >
              {isConnecting ? 'Connecting...' : 'Connect MetaMask'}
            </button>
          )}
        </div>
      </div>

      {/* Eligible Approved Assets for Minting */}
      <div style={{ marginBottom: '36px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div>
            <h3 className="font-serif" style={{ fontSize: '22px', fontWeight: 600, color: 'var(--color-charcoal)' }}>
              Compliance-Approved Assets Awaiting On-Chain Minting
            </h3>
            <p style={{ fontSize: '13.5px', color: 'var(--color-secondary-text)', marginTop: '2px' }}>
              These assets have been approved by compliance administrators and are ready for smart contract tokenization.
            </p>
          </div>
          <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--color-copper)', backgroundColor: 'var(--color-peach)', padding: '4px 14px', borderRadius: '9999px' }}>
            {eligibleAssets.length} Eligible
          </span>
        </div>

        {eligibleAssets.length === 0 ? (
          <div
            style={{
              padding: '36px 24px',
              textAlign: 'center',
              backgroundColor: '#FFFFFF',
              borderRadius: '26px',
              boxShadow: 'var(--shadow-card)'
            }}
          >
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'var(--color-mint)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
              <ShieldCheck size={28} style={{ color: '#1B6A4C' }} />
            </div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-charcoal)' }}>
              No Assets Currently Awaiting Tokenization
            </div>
            <div style={{ fontSize: '13px', color: 'var(--color-secondary-text)', marginTop: '4px' }}>
              Assets will appear here once approved in Pending Asset Reviews.
            </div>
          </div>
        ) : (
          <div style={{ borderRadius: '26px', overflow: 'hidden', backgroundColor: '#FFFFFF', boxShadow: 'var(--shadow-card)' }}>
            <table className="fintech-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC' }}>
                  <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 600, color: 'var(--color-secondary-text)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>Asset Title & Identifier</th>
                  <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 600, color: 'var(--color-secondary-text)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>Category</th>
                  <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 600, color: 'var(--color-secondary-text)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>Appraisal Value</th>
                  <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 600, color: 'var(--color-secondary-text)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>Approved By</th>
                  <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 600, color: 'var(--color-secondary-text)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid rgba(0,0,0,0.04)', textAlign: 'right' }}>Smart Contract Action</th>
                </tr>
              </thead>
              <tbody>
                {eligibleAssets.map((asset) => (
                  <tr key={asset.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.03)' }}>
                    <td style={{ padding: '18px 20px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--color-charcoal)', fontSize: '14px' }}>
                        {asset.name}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--color-secondary-text)', fontFamily: 'monospace', marginTop: '2px' }}>
                        {asset.id} • {asset.location}
                      </div>
                    </td>

                    <td style={{ padding: '18px 20px', fontSize: '13px', color: 'var(--color-charcoal)' }}>
                      {asset.category}
                    </td>

                    <td style={{ padding: '18px 20px', fontWeight: 600, color: 'var(--color-charcoal)', fontSize: '14px' }}>
                      {formatCurrency(asset.valuation, asset.currency)}
                    </td>

                    <td style={{ padding: '18px 20px', fontSize: '12px', color: 'var(--color-secondary-text)', fontFamily: 'monospace' }}>
                      {asset.verifierAddress ? `${asset.verifierAddress.slice(0, 6)}...${asset.verifierAddress.slice(-4)}` : 'Admin Office'}
                    </td>

                    <td style={{ padding: '18px 20px', textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => handleOpenMintModal(asset)}
                        style={{
                          backgroundColor: 'var(--color-navy)',
                          border: 'none',
                          borderRadius: '9999px',
                          color: '#FFFFFF',
                          padding: '7px 18px',
                          fontSize: '12.5px',
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          cursor: 'pointer'
                        }}
                      >
                        <Cpu size={14} />
                        <span>Configure & Mint</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Minted & Active Tokenized Assets Table */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div>
            <h3 className="font-serif" style={{ fontSize: '22px', fontWeight: 600, color: 'var(--color-charcoal)' }}>
              Deployed On-Chain Tokens
            </h3>
            <p style={{ fontSize: '13.5px', color: 'var(--color-secondary-text)', marginTop: '2px' }}>
              Permanent smart contract tokens registered on-chain and persisted in Supabase.
            </p>
          </div>
          <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#1B6A4C', backgroundColor: 'var(--color-mint)', padding: '4px 14px', borderRadius: '9999px' }}>
            {tokenizedAssets.length} Active Tokens
          </span>
        </div>

        <div style={{ borderRadius: '26px', overflow: 'hidden', backgroundColor: '#FFFFFF', boxShadow: 'var(--shadow-card)' }}>
          <table className="fintech-table" style={{ width: '100%', minWidth: '780px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC' }}>
                <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 600, color: 'var(--color-secondary-text)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid rgba(0,0,0,0.04)', minWidth: '130px', whiteSpace: 'nowrap' }}>Token Identifier</th>
                <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 600, color: 'var(--color-secondary-text)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid rgba(0,0,0,0.04)', minWidth: '180px' }}>Asset Title</th>
                <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 600, color: 'var(--color-secondary-text)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid rgba(0,0,0,0.04)', minWidth: '150px', whiteSpace: 'nowrap' }}>Standard & Symbol</th>
                <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 600, color: 'var(--color-secondary-text)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid rgba(0,0,0,0.04)', minWidth: '160px', whiteSpace: 'nowrap' }}>Contract Address</th>
                <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 600, color: 'var(--color-secondary-text)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid rgba(0,0,0,0.04)', minWidth: '160px', whiteSpace: 'nowrap' }}>Mint Transaction Hash</th>
                <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 600, color: 'var(--color-secondary-text)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid rgba(0,0,0,0.04)', minWidth: '140px', whiteSpace: 'nowrap' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {tokenizedAssets.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-secondary-text)', fontSize: '13.5px' }}>
                    No assets have been minted yet. Execute on-chain minting above to generate tokens.
                  </td>
                </tr>
              ) : (
                tokenizedAssets.map((asset) => (
                  <tr key={asset.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.03)' }}>
                    <td style={{ padding: '18px 20px', minWidth: '130px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontWeight: 700, color: 'var(--color-charcoal)', fontFamily: 'monospace', fontSize: '13px', backgroundColor: '#F8FAFC', padding: '4px 10px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
                        #{asset.tokenId || '101'}
                      </span>
                    </td>

                    <td style={{ padding: '18px 20px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--color-charcoal)', fontSize: '14px' }}>
                        {asset.name}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--color-secondary-text)', marginTop: '2px' }}>
                        {formatCurrency(asset.valuation, asset.currency)}
                      </div>
                    </td>

                    <td style={{ padding: '18px 20px', fontSize: '13px', color: 'var(--color-charcoal)' }}>
                      {asset.tokenStandard || 'ERC-721'} ({asset.tokenSymbol || 'AST-TOK'})
                    </td>

                    <td style={{ padding: '18px 20px' }}>
                      <code style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--color-secondary-text)' }}>
                        {(asset.contractAddress || REGISTRY_CONTRACT_ADDRESS).slice(0, 10)}...{(asset.contractAddress || REGISTRY_CONTRACT_ADDRESS).slice(-6)}
                      </code>
                    </td>

                    <td style={{ padding: '18px 20px' }}>
                      {asset.txHash ? (
                        <code style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--color-copper)' }}>
                          {asset.txHash.slice(0, 10)}...{asset.txHash.slice(-6)}
                        </code>
                      ) : (
                        <span style={{ fontSize: '12.5px', color: 'var(--color-secondary-text)' }}>Verified Settlement</span>
                      )}
                    </td>

                    <td style={{ padding: '18px 20px' }}>
                      <span
                        style={{
                          fontSize: '11.5px',
                          fontWeight: 600,
                          padding: '4px 12px',
                          borderRadius: '9999px',
                          backgroundColor: 'var(--color-mint)',
                          color: '#1B6A4C',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}
                      >
                        <CheckCircle2 size={12} />
                        ON-CHAIN LIVE
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mint Configuration Modal */}
      <Modal
        isOpen={!!selectedAsset}
        onClose={() => {
          if (!isMinting) setSelectedAsset(null);
        }}
        title={`Execute On-Chain Token Minting`}
      >
        {selectedAsset && (
          <form onSubmit={handleExecuteTokenization}>
            <div style={{ marginBottom: '20px' }}>
              <h4 className="font-serif" style={{ fontSize: '24px', fontWeight: 600, color: 'var(--color-charcoal)' }}>
                {selectedAsset.name}
              </h4>
              <p style={{ fontSize: '12.5px', color: 'var(--color-secondary-text)', fontFamily: 'monospace', marginTop: '4px' }}>
                Asset Dossier: {selectedAsset.id} • Appraised: {formatCurrency(selectedAsset.valuation, selectedAsset.currency)}
              </p>
            </div>

            {statusMessage.text && (
              <div
                style={{
                  padding: '14px 18px',
                  borderRadius: '16px',
                  marginBottom: '20px',
                  fontSize: '13px',
                  backgroundColor: statusMessage.type === 'error' ? '#FEE2E2' : statusMessage.type === 'success' ? 'var(--color-mint)' : 'var(--color-peach)',
                  color: statusMessage.type === 'error' ? '#DC2626' : statusMessage.type === 'success' ? '#1B6A4C' : '#B9653A',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}
              >
                {statusMessage.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
                <span>{statusMessage.text}</span>
              </div>
            )}

            <div className="input-group" style={{ marginBottom: '18px' }}>
              <label className="input-label" style={{ fontWeight: 600, color: 'var(--color-charcoal)', marginBottom: '8px', display: 'block', fontSize: '13px' }}>
                Token Standard
              </label>
              <select
                value={tokenStandard}
                onChange={(e) => setTokenStandard(e.target.value)}
                style={{
                  width: '100%',
                  height: '44px',
                  fontSize: '13px',
                  borderRadius: '14px',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid rgba(0,0,0,0.05)',
                  padding: '0 16px',
                  outline: 'none',
                  color: 'var(--color-charcoal)'
                }}
              >
                <option value="ERC-721">ERC-721 (Non-Fungible Real-World Deed)</option>
                <option value="ERC-1155">ERC-1155 (Fractional Token Shares)</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '18px' }}>
              <div className="input-group">
                <label className="input-label" style={{ fontWeight: 600, color: 'var(--color-charcoal)', marginBottom: '8px', display: 'block', fontSize: '13px' }}>
                  Token Symbol
                </label>
                <input
                  type="text"
                  required
                  value={tokenSymbol}
                  onChange={(e) => setTokenSymbol(e.target.value)}
                  placeholder="e.g. AST-VAND"
                  style={{
                    width: '100%',
                    height: '44px',
                    fontSize: '13px',
                    borderRadius: '14px',
                    backgroundColor: '#F8FAFC',
                    border: '1px solid rgba(0,0,0,0.05)',
                    padding: '0 16px',
                    outline: 'none',
                    color: 'var(--color-charcoal)'
                  }}
                />
              </div>

              <div className="input-group">
                <label className="input-label" style={{ fontWeight: 600, color: 'var(--color-charcoal)', marginBottom: '8px', display: 'block', fontSize: '13px' }}>
                  Total Supply Units
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={totalSupply}
                  onChange={(e) => setTotalSupply(e.target.value)}
                  style={{
                    width: '100%',
                    height: '44px',
                    fontSize: '13px',
                    borderRadius: '14px',
                    backgroundColor: '#F8FAFC',
                    border: '1px solid rgba(0,0,0,0.05)',
                    padding: '0 16px',
                    outline: 'none',
                    color: 'var(--color-charcoal)'
                  }}
                />
              </div>
            </div>

            <div
              style={{
                padding: '16px 20px',
                backgroundColor: '#F8FAFC',
                borderRadius: '16px',
                fontSize: '12.5px',
                color: 'var(--color-secondary-text)',
                marginBottom: '24px',
                lineHeight: 1.6
              }}
            >
              <strong style={{ color: 'var(--color-charcoal)' }}>Cryptographic Settlement:</strong> This action will trigger a signature request in your connected MetaMask wallet to call <code style={{ fontFamily: 'monospace' }}>AssetRegistry.registerAsset()</code> and mint an immutable token recorded to block storage.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                disabled={isMinting}
                onClick={() => setSelectedAsset(null)}
                style={{
                  backgroundColor: '#F8FAFC',
                  border: 'none',
                  borderRadius: '9999px',
                  color: 'var(--color-charcoal)',
                  padding: '9px 20px',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isMinting}
                style={{
                  backgroundColor: 'var(--color-navy)',
                  border: 'none',
                  borderRadius: '9999px',
                  color: '#FFFFFF',
                  padding: '9px 24px',
                  fontSize: '13px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer'
                }}
              >
                <Cpu size={14} />
                <span>{isMinting ? 'Broadcasting to Ethereum...' : 'Confirm & Mint Token'}</span>
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default AdminBlockchain;
