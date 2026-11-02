const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

// Enforce ADMIN role authentication on all administrative endpoints
router.use(authenticateToken);
router.use(requireRole('ADMIN'));

router.get('/submissions', adminController.listSubmissions);
router.get('/submissions/:id', adminController.getSubmissionDetails);
router.post('/submissions/:id/start-review', adminController.startReview);
router.post('/submissions/:id/approve', adminController.approveAsset);
router.post('/submissions/:id/reject', adminController.rejectAsset);
router.post('/submissions/:id/request-info', adminController.requestMoreInfo);

module.exports = router;
