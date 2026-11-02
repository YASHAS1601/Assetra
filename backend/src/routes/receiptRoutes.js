const express = require('express');
const router = express.Router();
const receiptController = require('../controllers/receiptController');
const { authenticateToken } = require('../middleware/authMiddleware');

// All receipt routes require session authentication
router.get('/my-receipts', authenticateToken, receiptController.getMyReceipts);
router.get('/asset/:assetId', authenticateToken, receiptController.getReceiptByAsset);
router.get('/tx/:txHash', authenticateToken, receiptController.getReceiptByTxHash);

module.exports = router;
