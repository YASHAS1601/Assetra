const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');

router.get('/', transactionController.listTransactions);
router.post('/index', transactionController.indexEvent);

module.exports = router;
