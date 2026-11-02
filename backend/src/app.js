const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const healthRoutes = require('./routes/healthRoutes');
const authRoutes = require('./routes/authRoutes');
const assetRoutes = require('./routes/assetRoutes');
const adminRoutes = require('./routes/adminRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const documentRoutes = require('./routes/documentRoutes');
const receiptRoutes = require('./routes/receiptRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// -----------------------------------------------------------------------------
// CORS Configuration with FRONTEND_URL support
// -----------------------------------------------------------------------------
const defaultLocalOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5000'
];

const configuredOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map(url => url.trim().replace(/\/+$/, ''))
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // 1. Allow non-browser requests (curl, server-to-server, Vercel/cloud health checks)
    if (!origin) {
      return callback(null, true);
    }

    const normalizedOrigin = origin.replace(/\/+$/, '');

    // 2. Allow configured production FRONTEND_URL(s)
    if (configuredOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }

    // 3. Allow standard localhost origins in non-production environments
    if (process.env.NODE_ENV !== 'production' && defaultLocalOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }

    // 4. Initial rollout fallback: If FRONTEND_URL is not yet configured, permit with warning
    if (configuredOrigins.length === 0) {
      console.warn(`[CORS Notice] FRONTEND_URL not set in environment. Permitting origin: ${origin}`);
      return callback(null, true);
    }

    console.warn(`[CORS Blocked] Origin not allowed by FRONTEND_URL policy: ${origin}`);
    return callback(new Error(`Origin ${origin} not allowed by CORS policy.`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());

// Rate Limiting for Auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: {
    success: false,
    error: 'TooManyRequests',
    message: 'Too many authentication attempts. Please try again later.'
  }
});

// Root & Health Check Endpoints
app.use('/api/health', healthRoutes);
app.use('/health', healthRoutes);
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'Assetra REST API & Event Indexer',
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
});

// Routes Mounting
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/receipts', receiptRoutes);

// Centralized Error Handler
app.use(errorHandler);

module.exports = app;
