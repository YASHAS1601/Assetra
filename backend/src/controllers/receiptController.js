const supabase = require('../config/supabase');

/**
 * Controller for retrieving institutional settlement receipts.
 * Strictly enforces authorization so users can only access their own receipts unless admin.
 */

const getMyReceipts = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const userWallet = (req.user?.walletAddress || '').toLowerCase();

    const adminClient = supabase.getSupabaseAdmin();
    if (!adminClient) {
      return res.status(200).json({ success: true, count: 0, data: [] });
    }

    let query = adminClient
      .from('purchase_receipts')
      .select('*')
      .order('created_at', { ascending: false });

    if (req.user?.role !== 'ADMIN') {
      if (userId && userWallet) {
        query = query.or(`buyer_id.eq.${userId},buyer_wallet.ilike.${userWallet}`);
      } else if (userId) {
        query = query.eq('buyer_id', userId);
      } else if (userWallet) {
        query = query.ilike('buyer_wallet', userWallet);
      } else {
        return res.status(200).json({ success: true, count: 0, data: [] });
      }
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to fetch receipts: ${error.message}`);
    }

    res.status(200).json({
      success: true,
      count: (data || []).length,
      data: data || []
    });
  } catch (err) {
    next(err);
  }
};

const getReceiptByAsset = async (req, res, next) => {
  try {
    const { assetId } = req.params;
    const userId = req.user?.id;
    const userWallet = (req.user?.walletAddress || '').toLowerCase();
    const isAdmin = req.user?.role === 'ADMIN';

    const adminClient = supabase.getSupabaseAdmin();
    if (!adminClient) {
      return res.status(404).json({ success: false, error: 'NotFound', message: 'No receipt found.' });
    }

    const { data, error } = await adminClient
      .from('purchase_receipts')
      .select('*')
      .eq('asset_id', assetId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: `Settlement receipt for asset '${assetId}' not found.`
      });
    }

    // Authorization check
    const isBuyer = (userId && data.buyer_id === userId) ||
      (userWallet && data.buyer_wallet && data.buyer_wallet.toLowerCase() === userWallet);

    if (!isBuyer && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Access denied: You are not authorized to view or download this private settlement receipt.'
      });
    }

    res.status(200).json({
      success: true,
      data
    });
  } catch (err) {
    next(err);
  }
};

const getReceiptByTxHash = async (req, res, next) => {
  try {
    const { txHash } = req.params;
    const userId = req.user?.id;
    const userWallet = (req.user?.walletAddress || '').toLowerCase();
    const isAdmin = req.user?.role === 'ADMIN';

    const adminClient = supabase.getSupabaseAdmin();
    if (!adminClient) {
      return res.status(404).json({ success: false, error: 'NotFound', message: 'No receipt found.' });
    }

    const { data, error } = await adminClient
      .from('purchase_receipts')
      .select('*')
      .eq('transaction_hash', txHash)
      .maybeSingle();

    if (error || !data) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: `Settlement receipt for transaction '${txHash}' not found.`
      });
    }

    // Authorization check
    const isBuyer = (userId && data.buyer_id === userId) ||
      (userWallet && data.buyer_wallet && data.buyer_wallet.toLowerCase() === userWallet);

    if (!isBuyer && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Access denied: You are not authorized to view or download this private settlement receipt.'
      });
    }

    res.status(200).json({
      success: true,
      data
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getMyReceipts,
  getReceiptByAsset,
  getReceiptByTxHash
};
