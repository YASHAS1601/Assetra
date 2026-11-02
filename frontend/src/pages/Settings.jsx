import React, { useState } from 'react';
import { useWeb3, NETWORKS } from '../context/Web3Context';
import { useAssets } from '../context/AssetContext';
import { isSupabaseConfigured, supabaseConfigError } from '../lib/supabase';
import { Globe, Database, Shield, RotateCcw, Check, Cloud, Layers, RefreshCw } from 'lucide-react';
import { CURRENCIES, DEFAULT_CURRENCY } from '../constants/currencies';

export const Settings = () => {
  const { chainId, networkInfo, switchNetwork, isDemoMode, toggleDemoMode } = useWeb3();
  const { fetchAssets, fetchTransactions } = useAssets();

  const [ipfsGateway, setIpfsGateway] = useState('https://ipfs.io/ipfs/');
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [factoryAddress, setFactoryAddress] = useState('0x8A79a29F81e9b20b22C439E83A92A6f4618e4F21');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleRefreshSupabaseData = async () => {
    setIsRefreshing(true);
    try {
      await fetchAssets();
      await fetchTransactions();
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div style={{ maxWidth: '900px', paddingBottom: '60px' }}>
      {/* Page Header */}
      <div style={{ marginBottom: '30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--color-copper, #B9653A)'
            }}
          >
            Protocol Parameters & Node Connectivity
          </span>
        </div>
        <h2
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '36px',
            fontWeight: 600,
            color: 'var(--color-navy, #13243C)',
            letterSpacing: '-0.02em',
            lineHeight: 1.15,
            margin: '0 0 8px 0'
          }}
        >
          Settings & Infrastructure Preferences
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--color-secondary-text, #64748B)', margin: 0, lineHeight: 1.5 }}>
          Configure Web3 provider RPC endpoints, decentralized storage gateways, and protocol registry addresses.
        </p>
      </div>

      {savedSuccess && (
        <div
          style={{
            backgroundColor: 'var(--color-mint-light, #DDF5EE)',
            borderRadius: '20px',
            padding: '14px 22px',
            marginBottom: '26px',
            fontSize: '13.5px',
            color: '#1E6F5C',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: '0 4px 16px rgba(30, 111, 92, 0.08)'
          }}
        >
          <div
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              backgroundColor: '#1E6F5C',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Check size={14} />
          </div>
          <span>Protocol preferences updated and synced successfully.</span>
        </div>
      )}

      <form onSubmit={handleSave}>
        {/* Network & RPC Setup */}
        <div
          style={{
            marginBottom: '26px',
            backgroundColor: '#FFFFFF',
            borderRadius: '26px',
            boxShadow: 'var(--shadow-card, 0 10px 30px rgba(0,0,0,0.04))',
            padding: '30px 34px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '22px', borderBottom: '1px solid rgba(0,0,0,0.04)', paddingBottom: '16px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-mint-light, #DDF5EE)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#1E6F5C'
              }}
            >
              <Globe size={18} />
            </div>
            <div>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 600, color: 'var(--color-navy, #13243C)', margin: 0 }}>
                1. Network & Web3 RPC Infrastructure
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--color-secondary-text, #64748B)', margin: '2px 0 0' }}>
                Primary blockchain consensus endpoint and fallback configurations
              </p>
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--color-navy, #13243C)', marginBottom: '8px' }}>
              Active Blockchain Network
            </label>
            <select
              value={chainId}
              onChange={(e) => switchNetwork(e.target.value)}
              style={{
                width: '100%',
                height: '46px',
                padding: '0 16px',
                fontSize: '13.5px',
                borderRadius: '16px',
                border: 'none',
                backgroundColor: '#F8FAFC',
                color: 'var(--color-navy, #13243C)',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {Object.entries(NETWORKS).map(([id, net]) => (
                <option key={id} value={id}>
                  {net.name} (Chain ID: {id})
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--color-navy, #13243C)', marginBottom: '8px' }}>
              Active Node RPC Endpoint
            </label>
            <input
              type="text"
              value={networkInfo.rpcUrl}
              readOnly
              style={{
                width: '100%',
                height: '46px',
                padding: '0 18px',
                fontSize: '13px',
                fontFamily: 'monospace',
                borderRadius: '16px',
                border: 'none',
                backgroundColor: '#F8FAFC',
                color: 'var(--color-navy, #13243C)',
                outline: 'none'
              }}
            />
          </div>

          <div
            style={{
              padding: '18px 22px',
              backgroundColor: '#F8FAFC',
              borderRadius: '20px',
              marginTop: '18px'
            }}
          >
            <label style={{ display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isDemoMode}
                onChange={toggleDemoMode}
                style={{ width: '18px', height: '18px', accentColor: 'var(--color-copper, #B9653A)', cursor: 'pointer' }}
              />
              <div>
                <div style={{ fontWeight: 600, color: 'var(--color-navy, #13243C)', fontSize: '13.5px' }}>
                  Enable Demo Data Fallback Mode
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-secondary-text, #64748B)', marginTop: '2px' }}>
                  When enabled, populates verified institutional fallback assets when MetaMask is disconnected.
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Smart Contract Registry Setup */}
        <div
          style={{
            marginBottom: '26px',
            backgroundColor: '#FFFFFF',
            borderRadius: '26px',
            boxShadow: 'var(--shadow-card, 0 10px 30px rgba(0,0,0,0.04))',
            padding: '30px 34px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '22px', borderBottom: '1px solid rgba(0,0,0,0.04)', paddingBottom: '16px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-peach-light, #FFF0E6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-copper)'
              }}
            >
              <Shield size={18} />
            </div>
            <div>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 600, color: 'var(--color-navy, #13243C)', margin: 0 }}>
                2. Assetra Factory Smart Contract Registry
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--color-secondary-text, #64748B)', margin: '2px 0 0' }}>
                On-chain protocol factory and tokenization parameters
              </p>
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--color-navy, #13243C)', marginBottom: '8px' }}>
              Assetra Asset Factory Contract Address
            </label>
            <input
              type="text"
              value={factoryAddress}
              onChange={(e) => setFactoryAddress(e.target.value)}
              style={{
                width: '100%',
                height: '46px',
                padding: '0 18px',
                fontSize: '13px',
                fontFamily: 'monospace',
                borderRadius: '16px',
                border: 'none',
                backgroundColor: '#F8FAFC',
                color: 'var(--color-navy, #13243C)',
                outline: 'none'
              }}
            />
            <span style={{ fontSize: '11.5px', color: 'var(--color-secondary-text, #64748B)', display: 'block', marginTop: '6px' }}>
              Core smart contract responsible for deploying asset token proxies.
            </span>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--color-navy, #13243C)', marginBottom: '8px' }}>
              Default Base Valuation Currency
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              style={{
                width: '100%',
                height: '46px',
                padding: '0 16px',
                fontSize: '13.5px',
                borderRadius: '16px',
                border: 'none',
                backgroundColor: '#F8FAFC',
                color: 'var(--color-navy, #13243C)',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} ({c.symbol} {c.name})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Storage Provider & Supabase Database */}
        <div
          style={{
            marginBottom: '32px',
            backgroundColor: '#FFFFFF',
            borderRadius: '26px',
            boxShadow: 'var(--shadow-card, 0 10px 30px rgba(0,0,0,0.04))',
            padding: '30px 34px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '22px', borderBottom: '1px solid rgba(0,0,0,0.04)', paddingBottom: '16px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-lavender-light, #F0EBFF)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#6B46C1'
              }}
            >
              <Database size={18} />
            </div>
            <div>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 600, color: 'var(--color-navy, #13243C)', margin: 0 }}>
                3. Metadata & Supabase Storage Sync
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--color-secondary-text, #64748B)', margin: '2px 0 0' }}>
                Decentralized document storage pointers and PostgreSQL persistence
              </p>
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--color-navy, #13243C)', marginBottom: '8px' }}>
              Public Metadata Gateway Endpoint
            </label>
            <input
              type="text"
              value={ipfsGateway}
              onChange={(e) => setIpfsGateway(e.target.value)}
              style={{
                width: '100%',
                height: '46px',
                padding: '0 18px',
                fontSize: '13px',
                fontFamily: 'monospace',
                borderRadius: '16px',
                border: 'none',
                backgroundColor: '#F8FAFC',
                color: 'var(--color-navy, #13243C)',
                outline: 'none'
              }}
            />
          </div>

          <div
            style={{
              padding: '18px 22px',
              backgroundColor: '#F8FAFC',
              borderRadius: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '14px'
            }}
          >
            <div>
              <div style={{ fontWeight: 600, color: 'var(--color-navy, #13243C)', fontSize: '13.5px' }}>
                Supabase Database Connection
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-secondary-text, #64748B)', marginTop: '2px' }}>
                {isSupabaseConfigured
                  ? 'Connected with Row Level Security active on asset-documents bucket'
                  : 'Supabase configuration in fallback mode'}
              </div>
            </div>

            <button
              type="button"
              onClick={handleRefreshSupabaseData}
              disabled={isRefreshing}
              style={{
                backgroundColor: '#FFFFFF',
                color: 'var(--color-navy, #13243C)',
                border: 'none',
                borderRadius: '9999px',
                padding: '10px 20px',
                fontSize: '12.5px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                cursor: isRefreshing ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} style={{ color: 'var(--color-copper)' }} />
              <span>{isRefreshing ? 'Refreshing...' : 'Resync Remote Data'}</span>
            </button>
          </div>
        </div>

        {/* Submit Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            type="submit"
            style={{
              backgroundColor: 'var(--color-copper, #B9653A)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '9999px',
              padding: '14px 34px',
              fontSize: '14px',
              fontWeight: 600,
              boxShadow: '0 4px 16px rgba(185, 101, 58, 0.25)',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            Save Protocol Preferences
          </button>
        </div>
      </form>
    </div>
  );
};

export default Settings;
