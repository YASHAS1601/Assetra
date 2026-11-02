const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

module.exports = {
  port: process.env.PORT || 5000,
  env: process.env.NODE_ENV || 'development',
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'assetra_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    url: process.env.DATABASE_URL
  },
  blockchain: {
    rpcUrl: process.env.RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com',
    registryAddress: process.env.REGISTRY_CONTRACT_ADDRESS || '0x525E82f822E004838004ffd6Fe1366Be244EC671',
    tokenAddress: process.env.TOKEN_CONTRACT_ADDRESS || '0x2F0d80D15773A473A00bE3B732D4B46974732501',
    marketplaceAddress: process.env.MARKETPLACE_CONTRACT_ADDRESS || '0x517082aA429ED926BDbeC904a1879BaE1aFd05f7'
  }
};
