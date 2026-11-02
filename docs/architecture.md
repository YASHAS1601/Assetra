# Assetra Protocol — System Architecture

Assetra is a Tokenized Asset Management System designed for registering, managing, exploring, and tokenizing real-world assets (RWA) on the Ethereum Virtual Machine (EVM).

---

## 🏛️ High-Level System Architecture

```
                               ┌─────────────────────────┐
                               │   User Browser Wallet   │
                               │  (MetaMask / Web3 Provider)
                               └────────────┬────────────┘
                                            │
                                 EIP-1193 / ethers.js v6
                                            │
                                            ▼
┌───────────────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND LAYER (React + Vite)                            │
│  • Pure White Fintech Theme (Inter Typography, #FFFFFF / #F8FAFC, Forest Green #166534) │
│  • Web3 & Wallet State Management (Web3Context)                                       │
│  • Asset Registry & Portfolio Dashboard (AssetContext)                                │
└──────────────┬─────────────────────────────────────────────────────────┬──────────────┘
               │                                                         │
   REST API (JSON / HTTP)                                      JSON-RPC (eth_sendTransaction)
               │                                                         │
               ▼                                                         ▼
┌──────────────────────────────┐                         ┌──────────────────────────────┐
│  BACKEND LAYER (Express.js)  │                         │   BLOCKCHAIN LAYER (Solidity)│
│  • GET /api/health           │                         │  • AssetRegistry.sol          │
│  • GET & POST /api/assets    │                         │  • AssetToken.sol (ERC-721)   │
│  • GET & POST /api/transactions                        │  • Event Emission            │
└──────────────┬───────────────┘                         └──────────────┬───────────────┘
               │                                                         │
         SQL Queries                                               Event Listening
               │                                                         │
               ▼                                                         ▼
┌──────────────────────────────┐                         ┌──────────────────────────────┐
│     POSTGRESQL DATABASE      │                         │  SMART CONTRACT EVENT INDEXER│
│  • assets table              │◄────────────────────────┤  • Indexes AssetRegistered & │
│  • indexed_events table      │                         │    TokenMinted on-chain events│
└──────────────────────────────┘                         └──────────────────────────────┘
```

---

## 🔒 Security & Data Integrity Principles

1. **On-Chain Authoritative State**: The Ethereum blockchain remains the single source of truth for token ownership, contract deployment addresses, and ERC-721 token IDs.
2. **Off-Chain Metadata Storage**: Detailed custody notes, appraisal PDFs, and physical location records are stored off-chain in PostgreSQL and referenced via IPFS hashes.
3. **No Private Key Custody**: Neither the frontend nor backend services handle or store user private keys or seed phrases. All transactions are signed client-side via MetaMask.
