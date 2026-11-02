const db = require('../config/db');
const supabase = require('../config/supabase');
const config = require('../config');

const getHealth = (req, res) => {
  const supabaseStatus = supabase.getStatus();
  const dbStatus = db.getStatus();

  res.status(200).json({
    status: 'healthy',
    service: 'Assetra REST API & Event Indexer',
    environment: config.env,
    timestamp: new Date().toISOString(),
    supabase: supabaseStatus,
    database: supabaseStatus.configured
      ? { type: 'Supabase Postgres', ...supabaseStatus }
      : dbStatus,
    blockchain: {
      rpcUrl: config.blockchain.rpcUrl,
      registryAddress: config.blockchain.registryAddress,
      tokenAddress: config.blockchain.tokenAddress,
      marketplaceAddress: config.blockchain.marketplaceAddress
    }
  });
};

module.exports = {
  getHealth
};
