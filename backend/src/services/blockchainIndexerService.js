const db = require('../config/db');

let inMemoryEvents = [
  {
    id: 1,
    transactionHash: '0x9f8c12a73b54d6e901a4852c9301f2e9d345091a27b89410952d7e',
    assetId: 'AST-2026-001',
    assetName: 'One Vanderbilt Suite 4200',
    eventType: 'Token Mint (ERC-721)',
    amount: '$18,500,000 USD',
    blockNumber: 19451002,
    gasFee: '0.0142 ETH',
    status: 'Confirmed',
    timestamp: new Date().toISOString()
  }
];

class BlockchainIndexerService {
  async getEvents(filters = {}) {
    try {
      if (db.pool && db.getStatus().connected) {
        const res = await db.query('SELECT * FROM indexed_events ORDER BY created_at DESC');
        return res.rows;
      }
    } catch (err) {
      console.warn('Postgres fallback for getEvents:', err.message);
    }
    return inMemoryEvents;
  }

  async indexEvent(eventData) {
    const newEvent = {
      id: inMemoryEvents.length + 1,
      transactionHash: eventData.transactionHash || `0x${Math.random().toString(16).substring(2)}`,
      assetId: eventData.assetId || 'AST-2026-000',
      assetName: eventData.assetName || 'Unassigned Asset',
      eventType: eventData.eventType || 'SmartContractEvent',
      amount: eventData.amount || '$0.00 USD',
      blockNumber: eventData.blockNumber || 19490000,
      gasFee: eventData.gasFee || '0.0080 ETH',
      status: eventData.status || 'Confirmed',
      timestamp: new Date().toISOString()
    };

    try {
      if (db.pool && db.getStatus().connected) {
        await db.query(
          `INSERT INTO indexed_events (transaction_hash, asset_id, asset_name, event_type, amount, block_number, gas_fee, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            newEvent.transactionHash, newEvent.assetId, newEvent.assetName,
            newEvent.eventType, newEvent.amount, newEvent.blockNumber,
            newEvent.gasFee, newEvent.status
          ]
        );
      }
    } catch (err) {
      console.warn('Postgres insert event fallback:', err.message);
    }

    inMemoryEvents.unshift(newEvent);
    return newEvent;
  }
}

module.exports = new BlockchainIndexerService();
