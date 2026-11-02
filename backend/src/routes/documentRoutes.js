const express = require('express');
const router = express.Router();
const documentController = require('../controllers/documentController');
const upload = require('../middleware/uploadMiddleware');
const { authenticateToken } = require('../middleware/authMiddleware');

router.post('/upload', authenticateToken, upload.single('file'), documentController.uploadDocument);
router.get('/asset/:assetId', authenticateToken, documentController.getAssetDocuments);
router.get('/:id', authenticateToken, documentController.getDocument);
router.delete('/:id', authenticateToken, documentController.deleteDocument);

module.exports = router;
