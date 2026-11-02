/**
 * Assetra Protocol: Centralized Smart Contract Configuration & Hardhat ABIs
 * Network Target: Ethereum Sepolia Testnet (Chain ID 11155111)
 *
 * Deployed Contract Addresses:
 * - AssetToken:        0x2F0d80D15773A473A00bE3B732D4B46974732501
 * - AssetRegistry:     0x525E82f822E004838004ffd6Fe1366Be244EC671
 * - AssetMarketplace:  0x517082aA429ED926BDbeC904a1879BaE1aFd05f7
 */

import { ethers } from 'ethers';
import AssetTokenArtifact from '../contracts/abis/AssetToken.json';
import AssetRegistryArtifact from '../contracts/abis/AssetRegistry.json';
import AssetMarketplaceArtifact from '../contracts/abis/AssetMarketplace.json';

// Network Constants
export const SEPOLIA_CHAIN_ID = '11155111';
export const SEPOLIA_HEX_CHAIN_ID = '0xaa36a7';
export const SEPOLIA_DECIMAL_CHAIN_ID = 11155111n;
export const LOCAL_DEV_DECIMAL_CHAIN_ID = 31337n;
export const SEPOLIA_EXPLORER_BASE = 'https://sepolia.etherscan.io';

/**
 * Normalizes any chain ID representation (hexadecimal, decimal string, number, bigint)
 * into a BigInt. Returns null if invalid or unparseable.
 */
export const normalizeChainIdToBigInt = (chainId) => {
  if (chainId === null || chainId === undefined || chainId === '') return null;
  try {
    if (typeof chainId === 'bigint') return chainId;
    if (typeof chainId === 'number') return BigInt(chainId);
    const str = String(chainId).trim();
    if (str.startsWith('0x') || str.startsWith('0X')) {
      return BigInt(str);
    }
    return BigInt(str);
  } catch (err) {
    console.warn('[contracts.js] Failed to parse chain ID to BigInt:', chainId, err.message);
    return null;
  }
};

/**
 * Normalizes any chain ID to a standard decimal string (e.g., '11155111')
 */
export const normalizeChainIdToString = (chainId) => {
  const bi = normalizeChainIdToBigInt(chainId);
  return bi !== null ? bi.toString() : '';
};

/**
 * Normalizes any chain ID to standard lowercase hex format (e.g., '0xaa36a7')
 */
export const normalizeChainIdToHex = (chainId) => {
  const bi = normalizeChainIdToBigInt(chainId);
  return bi !== null ? `0x${bi.toString(16)}` : '';
};

/**
 * Checks whether a chain ID matches Ethereum Sepolia specifically (11155111n / 0xaa36a7)
 */
export const isSepoliaChainId = (chainId) => {
  const bi = normalizeChainIdToBigInt(chainId);
  return bi === SEPOLIA_DECIMAL_CHAIN_ID;
};

/**
 * Checks whether a chain ID matches Sepolia (11155111n) or local hardhat node (31337n)
 */
export const isSepoliaOrLocalChainId = (chainId) => {
  const bi = normalizeChainIdToBigInt(chainId);
  return bi === SEPOLIA_DECIMAL_CHAIN_ID || bi === LOCAL_DEV_DECIMAL_CHAIN_ID;
};

/**
 * Helper to retrieve the active MetaMask wallet provider, even when multiple
 * Web3 wallet browser extensions are installed (e.g. Coinbase, Phantom, Brave).
 */
export const getMetaMaskProvider = () => {
  if (typeof window === 'undefined' || !window.ethereum) {
    return null;
  }
  if (Array.isArray(window.ethereum.providers) && window.ethereum.providers.length > 0) {
    const metaMask = window.ethereum.providers.find((p) => p.isMetaMask && !p.isBraveWallet);
    return metaMask || window.ethereum.providers.find((p) => p.isMetaMask) || window.ethereum;
  }
  return window.ethereum;
};

export const SEPOLIA_RPC_URLS = [
  'https://ethereum-sepolia-rpc.publicnode.com',
  'https://rpc.sepolia.org',
  'https://1rpc.io/sepolia'
];
export const SEPOLIA_RPC_URL = SEPOLIA_RPC_URLS[0];

// Deployed Smart Contract Addresses on Ethereum Sepolia
export const TOKEN_CONTRACT_ADDRESS =
  import.meta.env.VITE_TOKEN_CONTRACT_ADDRESS || '0x2F0d80D15773A473A00bE3B732D4B46974732501';

export const REGISTRY_CONTRACT_ADDRESS =
  import.meta.env.VITE_REGISTRY_CONTRACT_ADDRESS || '0x525E82f822E004838004ffd6Fe1366Be244EC671';

export const MARKETPLACE_CONTRACT_ADDRESS =
  import.meta.env.VITE_MARKETPLACE_CONTRACT_ADDRESS || '0x517082aA429ED926BDbeC904a1879BaE1aFd05f7';

// Protocol Deployer & Initial Verifier Address
export const DEPLOYER_ADDRESS = '0x726541B8b8bFcA25952940A18F0C58d189499C4B';

// Actual Hardhat-Generated ABIs
export const ASSET_TOKEN_ABI = AssetTokenArtifact.abi;
export const ASSET_REGISTRY_ABI = AssetRegistryArtifact.abi;
export const ASSET_MARKETPLACE_ABI = AssetMarketplaceArtifact.abi;

// Centralized Contract Registry Object
export const CONTRACTS_CONFIG = {
  chainId: 11155111,
  hexChainId: '0xaa36a7',
  networkName: 'Ethereum Sepolia',
  rpcUrl: SEPOLIA_RPC_URL,
  explorerBaseUrl: SEPOLIA_EXPLORER_BASE,
  contracts: {
    token: {
      address: TOKEN_CONTRACT_ADDRESS,
      name: 'AssetToken',
      standard: 'ERC-721',
      symbol: 'ASTRWA',
      abi: ASSET_TOKEN_ABI
    },
    registry: {
      address: REGISTRY_CONTRACT_ADDRESS,
      name: 'AssetRegistry',
      abi: ASSET_REGISTRY_ABI
    },
    marketplace: {
      address: MARKETPLACE_CONTRACT_ADDRESS,
      name: 'AssetMarketplace',
      abi: ASSET_MARKETPLACE_ABI
    }
  }
};

/**
 * Public fallback JSON-RPC Provider for read operations on Sepolia
 */
export const getPublicSepoliaProvider = () => {
  return new ethers.JsonRpcProvider(SEPOLIA_RPC_URL, {
    chainId: 11155111,
    name: 'sepolia'
  });
};

/**
 * Contract Instance Getters (works with Signer or Provider)
 */
export const getAssetRegistryContract = (signerOrProvider) => {
  const provider = signerOrProvider || getPublicSepoliaProvider();
  return new ethers.Contract(REGISTRY_CONTRACT_ADDRESS, ASSET_REGISTRY_ABI, provider);
};

export const getAssetTokenContract = (signerOrProvider) => {
  const provider = signerOrProvider || getPublicSepoliaProvider();
  return new ethers.Contract(TOKEN_CONTRACT_ADDRESS, ASSET_TOKEN_ABI, provider);
};

export const getAssetMarketplaceContract = (signerOrProvider) => {
  const provider = signerOrProvider || getPublicSepoliaProvider();
  return new ethers.Contract(MARKETPLACE_CONTRACT_ADDRESS, ASSET_MARKETPLACE_ABI, provider);
};

/**
 * Status Enum mapping from AssetRegistry.sol:
 * 0: Submitted, 1: Registered, 2: Approved, 3: Rejected, 4: Tokenized, 5: Decommissioned
 */
export const ON_CHAIN_STATUS = {
  0: 'Submitted',
  1: 'Registered',
  2: 'Approved',
  3: 'Rejected',
  4: 'Tokenized',
  5: 'Decommissioned'
};

export const SEPOLIA_FAUCETS = [
  { name: 'Google Cloud Web3 Faucet', url: 'https://cloud.google.com/application/web3/faucet/ethereum/sepolia' },
  { name: 'Sepolia PoW Faucet', url: 'https://sepolia-faucet.pk910.de/' },
  { name: 'Alchemy Sepolia Faucet', url: 'https://sepoliafaucet.com/' },
  { name: 'Infura Sepolia Faucet', url: 'https://www.infura.io/faucet/sepolia' }
];

export const getEtherscanTxUrl = (txHash) => {
  if (!txHash) return '';
  return `${SEPOLIA_EXPLORER_BASE}/tx/${txHash}`;
};

export const getEtherscanAddressUrl = (address) => {
  if (!address) return '';
  return `${SEPOLIA_EXPLORER_BASE}/address/${address}`;
};

export const getEtherscanTokenUrl = (tokenId) => {
  if (!tokenId) return '';
  return `${SEPOLIA_EXPLORER_BASE}/token/${TOKEN_CONTRACT_ADDRESS}?a=${tokenId}`;
};
