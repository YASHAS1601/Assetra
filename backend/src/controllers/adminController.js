const assetService = require('../services/assetService');

const listSubmissions = async (req, res, next) => {
  try {
    const { status, category } = req.query;
    const allAssets = await assetService.getAllAssets({ category });

    const filtered = status && status !== 'ALL'
      ? allAssets.filter(a => a.status === status)
      : allAssets;

    const metrics = {
      pendingCount: allAssets.filter(a => a.status === 'PENDING_REVIEW').length,
      underReviewCount: allAssets.filter(a => a.status === 'UNDER_REVIEW').length,
      approvedCount: allAssets.filter(a => a.status === 'APPROVED' || a.status === 'TOKENIZED').length,
      rejectedCount: allAssets.filter(a => a.status === 'REJECTED').length,
      moreInfoCount: allAssets.filter(a => a.status === 'MORE_INFO_REQUESTED').length,
      totalCount: allAssets.length
    };

    res.status(200).json({
      success: true,
      metrics,
      count: filtered.length,
      data: filtered
    });
  } catch (err) {
    next(err);
  }
};

const getSubmissionDetails = async (req, res, next) => {
  try {
    const { id } = req.params;
    const asset = await assetService.getAssetById(id);
    if (!asset) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: `Asset submission '${id}' not found.`
      });
    }

    res.status(200).json({
      success: true,
      data: asset
    });
  } catch (err) {
    next(err);
  }
};

const startReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updated = await assetService.updateAssetStatus(id, 'UNDER_REVIEW', {
      adminEmail: req.user.email,
      adminId: req.user.id,
      notes: 'Review process initiated by administrator.'
    });

    res.status(200).json({
      success: true,
      message: 'Asset status set to UNDER_REVIEW.',
      data: updated
    });
  } catch (err) {
    next(err);
  }
};

const approveAsset = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const updated = await assetService.updateAssetStatus(id, 'APPROVED', {
      adminEmail: req.user.email,
      adminId: req.user.id,
      verifierAddress: req.user.walletAddress || '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      notes: notes || 'Asset documentation and valuation verified.',
      isVerified: true,
      approvedAt: new Date().toISOString()
    });

    res.status(200).json({
      success: true,
      message: 'Asset submission APPROVED. The asset is now eligible for on-chain tokenization.',
      data: updated
    });
  } catch (err) {
    next(err);
  }
};

const rejectAsset = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'A clear reason for rejection is mandatory.'
      });
    }

    const updated = await assetService.updateAssetStatus(id, 'REJECTED', {
      adminEmail: req.user.email,
      adminId: req.user.id,
      rejectionReason: reason.trim(),
      notes: `Application REJECTED: ${reason.trim()}`,
      isVerified: false
    });

    res.status(200).json({
      success: true,
      message: 'Asset submission REJECTED.',
      data: updated
    });
  } catch (err) {
    next(err);
  }
};

const requestMoreInfo = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    if (!notes || notes.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Instructions for requested additional information are required.'
      });
    }

    const updated = await assetService.updateAssetStatus(id, 'MORE_INFO_REQUESTED', {
      adminEmail: req.user.email,
      adminId: req.user.id,
      reviewNotes: notes.trim(),
      notes: `Additional Information Requested: ${notes.trim()}`
    });

    res.status(200).json({
      success: true,
      message: 'Application returned to user for additional information.',
      data: updated
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listSubmissions,
  getSubmissionDetails,
  startReview,
  approveAsset,
  rejectAsset,
  requestMoreInfo
};
