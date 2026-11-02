# Assetra Deployment & Setup Guide

This guide details how to set up, compile, test, and run the Assetra multi-tier full-stack application across frontend, backend, and smart contracts.

---

## 📋 Prerequisites
- Node.js (v18+ or v20+)
- npm (v9+)
- Hardhat (included in `smart-contracts/`)
- PostgreSQL (v14+, optional for backend DB persistence)

---

## 1. Smart Contracts Setup & Local Deployment

```bash
cd smart-contracts

# Install dependencies
npm install

# Compile Solidity contracts
npx hardhat compile

# Run automated tests
npx hardhat test

# Launch a local Hardhat blockchain node (In a separate terminal)
npx hardhat node

# Deploy contracts to local Hardhat node
npx hardhat run scripts/deploy.js --network localhost
```

---

## 2. Backend Setup & API Service

```bash
cd backend

# Install dependencies
npm install

# Setup Environment file
cp .env.example .env

# (Optional) Initialize PostgreSQL Database Schema
psql -U postgres -d assetra_db -f src/models/schema.sql

# Run unit & integration tests
npm test

# Start the Express server
npm start
# Server starts at http://localhost:5000/
```

---

## 3. Frontend React Setup

```bash
cd frontend

# Install dependencies
npm install

# Run Vite dev server
npm run dev

# Build production bundle
npm run build
```

---

## 🌐 Connecting MetaMask to Local Hardhat Node
1. Open MetaMask extension.
2. Add a custom network:
   - Network Name: `Hardhat Localhost`
   - RPC URL: `http://127.0.0.1:8545`
   - Chain ID: `31337`
   - Currency Symbol: `ETH`
3. Import one of Hardhat's default test account private keys to interact with local contracts.
