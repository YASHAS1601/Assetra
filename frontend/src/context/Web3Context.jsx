import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { ethers } from 'ethers';
import {
  SEPOLIA_CHAIN_ID,
  SEPOLIA_HEX_CHAIN_ID,
  SEPOLIA_EXPLORER_BASE,
  SEPOLIA_RPC_URLS,
  getPublicSepoliaProvider,
  getMetaMaskProvider,
  normalizeChainIdToString,
  normalizeChainIdToHex,
  isSepoliaChainId,
  isSepoliaOrLocalChainId
} from '../constants/contracts';

const Web3Context = createContext();

export const NETWORKS = {
  '11155111': {
    name: 'Ethereum Sepolia',
    currency: 'ETH',
    rpcUrl: SEPOLIA_RPC_URLS[0],
    explorer: SEPOLIA_EXPLORER_BASE,
    isTestnet: true
  },
  '31337': {
    name: 'Hardhat Local',
    currency: 'ETH',
    rpcUrl: 'http://127.0.0.1:8545',
    explorer: '',
    isTestnet: true
  },
  '1': {
    name: 'Ethereum Mainnet',
    currency: 'ETH',
    rpcUrl: 'https://eth.llama-rpc.com',
    explorer: 'https://etherscan.io',
    isTestnet: false
  },
  '137': {
    name: 'Polygon Mainnet',
    currency: 'POL',
    rpcUrl: 'https://polygon-rpc.com',
    explorer: 'https://polygonscan.com',
    isTestnet: false
  }
};

export const Web3Provider = ({ children }) => {
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(SEPOLIA_CHAIN_ID);
  const [balance, setBalance] = useState('0.00');
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [hasMetaMask, setHasMetaMask] = useState(false);
  const [error, setError] = useState(null);
  const accountRef = useRef(account);

  useEffect(() => {
    accountRef.current = account;
  }, [account]);

  // Update real balance when account changes using connected MetaMask provider
  const updateBalance = useCallback(async (userAccount) => {
    if (!userAccount) {
      setBalance('0.00');
      return;
    }
    const eth = getMetaMaskProvider();
    if (eth) {
      try {
        const provider = new ethers.BrowserProvider(eth);
        const rawBalance = await provider.getBalance(userAccount);
        const formatted = ethers.formatEther(rawBalance);
        setBalance(parseFloat(formatted).toFixed(4));
      } catch (err) {
        console.warn('[Web3Context] Could not fetch wallet balance:', err.message);
        setBalance('0.00');
      }
    } else {
      setBalance('0.00');
    }
  }, []);

  // Passive initial detection: detect wallet and network without prompting for access
  useEffect(() => {
    const eth = getMetaMaskProvider();
    if (eth) {
      setHasMetaMask(true);

      // 1. Detect current network silently
      eth
        .request({ method: 'eth_chainId' })
        .then((rawHexOrDec) => {
          if (rawHexOrDec) {
            const normalized = normalizeChainIdToString(rawHexOrDec);
            console.log('[Web3Context] Initial detected chain ID:', rawHexOrDec, '-> normalized:', normalized);
            setChainId(normalized);
          }
        })
        .catch((err) => {
          console.warn('[Web3Context] Silent chainId detection notice:', err.message);
        });

      // 2. Detect already authorized accounts without prompting
      eth
        .request({ method: 'eth_accounts' })
        .then((accounts) => {
          if (accounts && accounts.length > 0) {
            const userAccount = accounts[0];
            setAccount(userAccount);
            setIsConnected(true);
            updateBalance(userAccount);
          }
        })
        .catch((err) => {
          console.warn('[Web3Context] Silent accounts detection notice:', err.message);
        });
    }
  }, [updateBalance]);

  // Connect MetaMask Wallet (Explicit user request)
  const connectWallet = async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const eth = getMetaMaskProvider();
      if (!eth) {
        throw new Error('MetaMask extension not detected. Please install MetaMask to interact with Sepolia blockchain.');
      }

      const provider = new ethers.BrowserProvider(eth);
      const accounts = await provider.send('eth_requestAccounts', []);
      const network = await provider.getNetwork();

      const normalizedChainId = normalizeChainIdToString(network.chainId);
      console.log('[Web3Context] connectWallet: live network chainId:', network.chainId, '-> normalized:', normalizedChainId);

      if (accounts.length > 0) {
        const userAccount = accounts[0];
        setAccount(userAccount);
        setChainId(normalizedChainId);
        setIsConnected(true);
        await updateBalance(userAccount);
        return userAccount;
      } else {
        throw new Error('No accounts selected in MetaMask.');
      }
    } catch (err) {
      console.error('[Web3Context] Wallet connection error:', err);
      setError(err.message || 'Failed to connect wallet');
      setIsConnected(false);
      setAccount(null);
      setBalance('0.00');
      throw err;
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setAccount(null);
    setIsConnected(false);
    setBalance('0.00');
    setError(null);
  };

  // Switch network with automatic chain addition fallback (Chain ID 0xaa36a7 for Sepolia)
  const switchNetwork = async (targetChainId = SEPOLIA_CHAIN_ID) => {
    const eth = getMetaMaskProvider();
    if (!eth) {
      throw new Error('MetaMask is not available. Please install MetaMask to switch networks.');
    }

    const hexChainId = normalizeChainIdToHex(targetChainId) || SEPOLIA_HEX_CHAIN_ID;
    console.log('[Web3Context] Requesting network switch to:', targetChainId, `(${hexChainId})`);

    try {
      await eth.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: hexChainId }]
      });
      const currentChainHex = await eth.request({ method: 'eth_chainId' });
      const currentChainDec = normalizeChainIdToString(currentChainHex || targetChainId);
      console.log('[Web3Context] Network switch confirmed. Current chain:', currentChainDec);
      setChainId(currentChainDec);
      if (accountRef.current) {
        updateBalance(accountRef.current);
      }
      return currentChainDec;
    } catch (switchError) {
      console.error('[Web3Context] wallet_switchEthereumChain error:', switchError);

      // User rejected the request in MetaMask (EIP-1193 code 4001)
      if (switchError.code === 4001) {
        const userMsg = 'Network switch request was rejected in MetaMask.';
        setError(userMsg);
        throw new Error(userMsg);
      }

      // Error code 4902: Unrecognized chain in wallet
      if (switchError.code === 4902 || switchError?.data?.originalError?.code === 4902) {
        try {
          if (isSepoliaChainId(targetChainId)) {
            console.log('[Web3Context] Adding Ethereum Sepolia (0xaa36a7) to MetaMask...');
            await eth.request({
              method: 'wallet_addEthereumChain',
              params: [
                {
                  chainId: SEPOLIA_HEX_CHAIN_ID,
                  chainName: 'Ethereum Sepolia Testnet',
                  nativeCurrency: { name: 'Sepolia ETH', symbol: 'ETH', decimals: 18 },
                  rpcUrls: SEPOLIA_RPC_URLS,
                  blockExplorerUrls: [SEPOLIA_EXPLORER_BASE]
                }
              ]
            });
            setChainId(SEPOLIA_CHAIN_ID);
            if (accountRef.current) {
              updateBalance(accountRef.current);
            }
            return SEPOLIA_CHAIN_ID;
          } else if (normalizeChainIdToString(targetChainId) === '31337') {
            await eth.request({
              method: 'wallet_addEthereumChain',
              params: [
                {
                  chainId: '0x7a69',
                  chainName: 'Hardhat Local',
                  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                  rpcUrls: ['http://127.0.0.1:8545']
                }
              ]
            });
            setChainId('31337');
            return '31337';
          }
        } catch (addError) {
          console.error('[Web3Context] wallet_addEthereumChain error:', addError);
          const addMsg = addError.code === 4001
            ? 'Network addition request was rejected in MetaMask.'
            : (addError.message || 'Failed to add network to MetaMask');
          setError(addMsg);
          throw new Error(addMsg);
        }
      } else {
        const errorMsg = switchError.message || 'Failed to switch network in MetaMask';
        setError(errorMsg);
        throw new Error(errorMsg);
      }
    }
  };

  // Convenience helper: Switch directly to Sepolia (0xaa36a7)
  const switchToSepolia = async () => {
    return switchNetwork(SEPOLIA_CHAIN_ID);
  };

  // Obtain Signer for executing transactions using MetaMask provider
  const getSigner = async () => {
    const eth = getMetaMaskProvider();
    if (!eth) {
      throw new Error('MetaMask is not available. Please install MetaMask to sign transactions.');
    }
    const provider = new ethers.BrowserProvider(eth);
    return await provider.getSigner();
  };

  // Obtain Provider (MetaMask provider if present, otherwise public Sepolia RPC)
  const getProvider = () => {
    const eth = getMetaMaskProvider();
    if (eth) {
      return new ethers.BrowserProvider(eth);
    }
    return getPublicSepoliaProvider();
  };

  // Setup event listeners for MetaMask account and chain changes
  useEffect(() => {
    const eth = getMetaMaskProvider();
    if (!eth || !eth.on) return;

    const handleAccountsChanged = (accounts) => {
      console.log('[Web3Context] MetaMask accountsChanged event:', accounts);
      if (accounts && accounts.length > 0) {
        setAccount(accounts[0]);
        setIsConnected(true);
        updateBalance(accounts[0]);
      } else {
        disconnectWallet();
      }
    };

    const handleChainChanged = (newChainHex) => {
      const normalizedChainId = normalizeChainIdToString(newChainHex);
      console.log('[Web3Context] MetaMask chainChanged event:', newChainHex, '-> normalized:', normalizedChainId);
      setChainId(normalizedChainId);
      if (accountRef.current) {
        updateBalance(accountRef.current);
      }
    };

    eth.on('accountsChanged', handleAccountsChanged);
    eth.on('chainChanged', handleChainChanged);

    return () => {
      if (typeof eth.removeListener === 'function') {
        eth.removeListener('accountsChanged', handleAccountsChanged);
        eth.removeListener('chainChanged', handleChainChanged);
      } else if (typeof eth.off === 'function') {
        eth.off('accountsChanged', handleAccountsChanged);
        eth.off('chainChanged', handleChainChanged);
      }
    };
  }, [updateBalance]);

  const normalizedCurrentChain = normalizeChainIdToString(chainId);
  const networkInfo = NETWORKS[normalizedCurrentChain] || {
    name: `Chain ${normalizedCurrentChain || chainId}`,
    currency: 'ETH',
    rpcUrl: '',
    explorer: '',
    isTestnet: true
  };

  const isSepolia = isSepoliaOrLocalChainId(chainId);

  return (
    <Web3Context.Provider
      value={{
        account,
        chainId,
        networkInfo,
        balance,
        isConnected,
        isConnecting,
        isSepolia,
        hasMetaMask,
        error,
        connectWallet,
        disconnectWallet,
        switchNetwork,
        switchToSepolia,
        updateBalance,
        getSigner,
        getProvider
      }}
    >
      {children}
    </Web3Context.Provider>
  );
};

export const useWeb3 = () => useContext(Web3Context);
export default Web3Context;
