const express = require('express');
const router = express.Router();
const assetController = require('../controllers/assetController');
const { validateAssetInput } = require('../middleware/validationMiddleware');

router.get('/', assetController.listAssets);
router.get('/:id', assetController.getAssetById);
router.post('/', validateAssetInput, assetController.createAsset);
router.post('/:id/purchase', assetController.purchaseAsset);
router.post('/:id/transfer', assetController.transferAsset);
router.patch('/:id/listing', assetController.updateListing);

module.exports = router;
