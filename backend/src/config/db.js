const { Pool } = require('pg');
const config = require('./index');

let pool = null;
let isConnected = false;

if (config.db.url || config.db.host) {
  try {
    pool = new Pool({
      connectionString: config.db.url || `postgresql://${config.db.user}:${config.db.password}@${config.db.host}:${config.db.port}/${config.db.database}`,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 2000
    });

    pool.on('error', (err) => {
      console.warn('PostgreSQL Pool Error:', err.message);
      isConnected = false;
    });
  } catch (err) {
    console.warn('PostgreSQL initialization skipped:', err.message);
  }
}

const query = async (text, params) => {
  if (pool) {
    try {
      const res = await pool.query(text, params);
      isConnected = true;
      return res;
    } catch (err) {
      isConnected = false;
      throw err;
    }
  }
  throw new Error('Database pool not initialized.');
};

const getStatus = () => ({
  type: 'PostgreSQL',
  connected: isConnected,
  host: config.db.host,
  database: config.db.database
});

module.exports = {
  pool,
  query,
  getStatus
};
