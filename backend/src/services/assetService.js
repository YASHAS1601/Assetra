const db = require('../config/db');
const supabase = require('../config/supabase');

class AssetService {
  async getAllAssets(filters = {}) {
    const adminClient = supabase.getSupabaseAdmin();
    if (adminClient) {
      let query = adminClient.from('assets').select('*').order('created_at', { ascending: false });

      if (filters.explore) {
        // Cross-User Marketplace Discovery:
        // Strictly show APPROVED assets.
        query = query.or('verification_status.eq.APPROVED,is_verified.eq.true,status.eq.APPROVED,status.eq.TOKENIZED');
      } else {
        if (filters.userId) query = query.eq('user_id', filters.userId);
        if (filters.status && filters.status !== 'All Statuses' && filters.status !== 'ALL') {
          query = query.eq('status', filters.status);
        }
      }

      if (filters.category && filters.category !== 'All Categories') {
        query = query.eq('category', filters.category);
      }

      const { data, error } = await query;
      if (error) {
        throw new Error(`Failed to fetch assets from Supabase: ${error.message}`);
      }
      return data || [];
    }

    if (db.pool && db.getStatus().connected) {
      let queryStr = 'SELECT * FROM assets';
      const params = [];
      const conditions = [];

      if (filters.explore) {
        conditions.push("(verification_status = 'APPROVED' OR is_verified = TRUE OR status IN ('APPROVED', 'TOKENIZED'))");
      } else {
        if (filters.userId) {
          params.push(filters.userId);
          conditions.push(`user_id = $${params.length}`);
        }
        if (filters.status && filters.status !== 'All Statuses' && filters.status !== 'ALL') {
          params.push(filters.status);
          conditions.push(`status = $${params.length}`);
        }
      }

      if (filters.category && filters.category !== 'All Categories') {
        params.push(filters.category);
        conditions.push(`category = $${params.length}`);
      }

      if (conditions.length > 0) {
        queryStr += ' WHERE ' + conditions.join(' AND ');
      }
      queryStr += ' ORDER BY created_at DESC';

      const res = await db.query(queryStr, params);
      return res.rows;
    }

    throw new Error('Database service is not configured. Please configure Supabase or PostgreSQL.');
  }

  async getAssetById(id) {
    const adminClient = supabase.getSupabaseAdmin();
    if (adminClient) {
      const { data, error } = await adminClient
        .from('assets')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to retrieve asset from Supabase: ${error.message}`);
      }
      return data;
    }

    if (db.pool && db.getStatus().connected) {
      const res = await db.query('SELECT * FROM assets WHERE id = $1', [id]);
      if (res.rows.length > 0) return res.rows[0];
      return null;
    }

    throw new Error('Database service is not configured.');
  }

  async createAsset(assetData, user = {}) {
    const uniqueSuffix = Date.now().toString(36).toUpperCase().slice(-4);
    const newId = `AST-${new Date().getFullYear()}-${uniqueSuffix}`;
    const ownerAddress = assetData.ownerAddress || user.walletAddress || '0x0000000000000000000000000000000000000000';

    const newAsset = {
      id: newId,
      user_id: user.id || null,
      name: assetData.name.trim(),
      category: assetData.category || 'Commercial Real Estate',
      description: assetData.description ? assetData.description.trim() : null,
      location: assetData.location ? assetData.location.trim() : null,
      valuation: parseFloat(assetData.valuation) || 0,
      currency: assetData.currency || 'INR',
      appraisal_date: assetData.appraisalDate || new Date().toISOString().split('T')[0],
      custodian: assetData.custodian ? assetData.custodian.trim() : null,
      status: 'PENDING_REVIEW', // Mandatory default for user submissions
      is_verified: false,
      verification_status: 'PENDING',
      token_status: 'NOT_TOKENIZED',
      listing_status: 'UNLISTED',
      listing_price_eth: 0,
      token_standard: assetData.tokenStandard || 'ERC-721',
      contract_address: null,
      token_id: null,
      token_symbol: assetData.tokenSymbol ? assetData.tokenSymbol.trim() : 'AST-TOK',
      total_supply: parseInt(assetData.totalSupply, 10) || 1,
      owner_address: ownerAddress,
      current_owner_address: ownerAddress,
      ipfs_hash: assetData.ipfsHash || null,
      image_url: assetData.imageUrl || null
    };

    const adminClient = supabase.getSupabaseAdmin();
    if (adminClient) {
      const { data, error } = await adminClient
        .from('assets')
        .insert([newAsset])
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create asset in Supabase: ${error.message}`);
      }
      return data;
    }

    if (db.pool && db.getStatus().connected) {
      await db.query(
        `INSERT INTO assets (id, user_id, name, category, description, location, valuation, currency, appraisal_date, custodian, status, is_verified, verification_status, token_status, listing_status, token_standard, owner_address, current_owner_address, ipfs_hash, image_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'PENDING_REVIEW', FALSE, 'PENDING', 'NOT_TOKENIZED', 'UNLISTED', $11, $12, $12, $13, $14)`,
        [
          newAsset.id, newAsset.user_id, newAsset.name, newAsset.category, newAsset.description, newAsset.location,
          newAsset.valuation, newAsset.currency, newAsset.appraisal_date, newAsset.custodian,
          newAsset.token_standard, newAsset.owner_address, newAsset.ipfs_hash, newAsset.image_url
        ]
      );
      return newAsset;
    }

    throw new Error('Database service is not configured.');
  }

  async updateAssetStatus(assetId, newStatus, meta = {}) {
    const asset = await this.getAssetById(assetId);
    if (!asset) {
      throw new Error(`Asset '${assetId}' not found.`);
    }

    const updatePayload = {
      status: newStatus,
      updated_at: new Date().toISOString()
    };

    if (newStatus === 'APPROVED') {
      updatePayload.is_verified = true;
      updatePayload.verification_status = 'APPROVED';
      if (meta.verifierAddress) updatePayload.verifier_address = meta.verifierAddress;
      updatePayload.approved_at = meta.approvedAt || new Date().toISOString();
      if (meta.notes) updatePayload.review_notes = meta.notes;
    } else if (newStatus === 'REJECTED') {
      updatePayload.is_verified = false;
      updatePayload.verification_status = 'REJECTED';
      if (meta.rejectionReason) updatePayload.rejection_reason = meta.rejectionReason;
    } else if (newStatus === 'TOKENIZED') {
      updatePayload.token_status = 'TOKENIZED';
      if (meta.contractAddress) updatePayload.contract_address = meta.contractAddress;
      if (meta.tokenId) updatePayload.token_id = String(meta.tokenId);
    }

    const adminClient = supabase.getSupabaseAdmin();
    if (adminClient) {
      const { data, error } = await adminClient
        .from('assets')
        .update(updatePayload)
        .eq('id', assetId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update asset status in Supabase: ${error.message}`);
      }

      await adminClient
        .from('audit_logs')
        .insert([{
          asset_id: assetId,
          admin_id: meta.adminId || null,
          admin_email: meta.adminEmail || 'admin@assetra.io',
          action: newStatus,
          previous_status: asset.status,
          new_status: newStatus,
          notes: meta.notes || meta.rejectionReason || `Status changed to ${newStatus}`
        }]);

      return data;
    }

    if (db.pool && db.getStatus().connected) {
      await db.query(
        `UPDATE assets SET status = $1, is_verified = $2, verification_status = $3, updated_at = NOW() WHERE id = $4`,
        [newStatus, updatePayload.is_verified || false, updatePayload.verification_status || 'PENDING', assetId]
      );
      return { ...asset, ...updatePayload };
    }

    throw new Error('Database service is not configured.');
  }

  // Update marketplace listing state (owner only)
  async updateListing(assetId, listingData = {}, user = {}) {
    const asset = await this.getAssetById(assetId);
    if (!asset) {
      throw new Error(`Asset '${assetId}' not found.`);
    }

    const isOwner = (user.id && asset.user_id === user.id) ||
      (user.walletAddress && asset.current_owner_address && user.walletAddress.toLowerCase() === asset.current_owner_address.toLowerCase());

    if (!isOwner && user.role !== 'ADMIN') {
      throw new Error('Unauthorized: Only the current asset owner can update marketplace listing.');
    }

    const updatePayload = {
      listing_status: listingData.listingStatus || 'LISTED',
      listing_price_eth: parseFloat(listingData.listingPriceEth) || 0,
      marketplace_contract_address: listingData.marketplaceContractAddress || '0x517082aA429ED926BDbeC904a1879BaE1aFd05f7',
      updated_at: new Date().toISOString()
    };

    const adminClient = supabase.getSupabaseAdmin();
    if (adminClient) {
      let { data, error } = await adminClient
        .from('assets')
        .update(updatePayload)
        .eq('id', assetId)
        .select()
        .single();

      if (error && error.message && error.message.includes('marketplace_contract_address')) {
        const fallbackPayload = {
          listing_status: updatePayload.listing_status,
          listing_price_eth: updatePayload.listing_price_eth,
          updated_at: updatePayload.updated_at
        };
        const retry = await adminClient
          .from('assets')
          .update(fallbackPayload)
          .eq('id', assetId)
          .select()
          .single();
        data = retry.data;
        error = retry.error;
      }

      if (error) {
        throw new Error(`Failed to update listing: ${error.message}`);
      }
      return data;
    }

    if (db.pool && db.getStatus().connected) {
      await db.query(
        `UPDATE assets SET listing_status = $1, listing_price_eth = $2, updated_at = NOW() WHERE id = $3`,
        [updatePayload.listing_status, updatePayload.listing_price_eth, assetId]
      );
      return { ...asset, ...updatePayload };
    }

    throw new Error('Database service is not configured.');
  }

  // Record completed on-chain token purchase (synchronizing DB with blockchain)
  async recordPurchase(assetId, purchaseData = {}, user = {}) {
    const { buyerWallet, txHash, chainId, priceEth, blockNumber, gasFee } = purchaseData;

    if (!buyerWallet || !txHash) {
      throw new Error('Buyer wallet address and transaction hash are required.');
    }

    const adminClient = supabase.getSupabaseAdmin();
    if (adminClient) {
      // 1. Attempt using the atomic RPC function
      try {
        const { data: rpcData, error: rpcErr } = await adminClient.rpc('record_token_purchase', {
          p_asset_id: assetId,
          p_buyer_wallet: buyerWallet,
          p_tx_hash: txHash,
          p_chain_id: chainId || '31337',
          p_price_eth: parseFloat(priceEth) || 0,
          p_block_number: blockNumber ? parseInt(blockNumber, 10) : null,
          p_gas_fee: gasFee || '0.0050 ETH'
        });

        if (!rpcErr && rpcData) {
          return rpcData;
        }
      } catch (err) {
        console.warn('RPC record_token_purchase error, falling back to direct table update:', err.message);
      }

      // 2. Direct table update
      let existingReceipt = null;
      try {
        const { data: foundRc } = await adminClient
          .from('purchase_receipts')
          .select('*')
          .eq('transaction_hash', txHash)
          .maybeSingle();
        if (foundRc) existingReceipt = foundRc;
      } catch (chkErr) {
        // table might not exist yet
      }

      if (existingReceipt) {
        const { data: curAsset } = await adminClient.from('assets').select('*').eq('id', assetId).maybeSingle();
        return {
          asset: curAsset,
          receipt: existingReceipt,
          idempotent: true
        };
      }

      const updatePayload = {
        current_owner_address: buyerWallet,
        listing_status: 'UNLISTED',
        last_purchased_at: new Date().toISOString(),
        last_purchased_by: user.id || null,
        updated_at: new Date().toISOString()
      };

      const { data: updatedAsset, error: updateErr } = await adminClient
        .from('assets')
        .update(updatePayload)
        .eq('id', assetId)
        .select()
        .single();

      if (updateErr) {
        throw new Error(`Failed to update asset purchase record: ${updateErr.message}`);
      }

      // Generate receipt
      const year = new Date().getFullYear();
      const hashSeg = txHash.replace(/^0x/, '').slice(0, 6).toUpperCase();
      const receiptNo = `REC-${year}-${hashSeg}`;

      let receiptRecord = {
        receipt_number: receiptNo,
        asset_id: assetId,
        asset_name: updatedAsset?.name || 'Tokenized Asset',
        token_id: String(updatedAsset?.token_id || purchaseData.tokenId || '1'),
        buyer_id: user.id || null,
        buyer_wallet: buyerWallet,
        seller_wallet: purchaseData.sellerWallet || updatedAsset?.owner_address || '0x0000000000000000000000000000000000000000',
        price_eth: parseFloat(priceEth) || 0,
        currency: 'ETH',
        transaction_hash: txHash,
        block_number: blockNumber ? parseInt(blockNumber, 10) : null,
        chain_id: String(chainId || '11155111'),
        token_contract: purchaseData.tokenContract || updatedAsset?.contract_address || '0x2F0d80D15773A473A00bE3B732D4B46974732501',
        marketplace_contract: purchaseData.marketplaceContract || '0x517082aA429ED926BDbeC904a1879BaE1aFd05f7',
        gas_fee: gasFee || '0.0050 ETH'
      };

      try {
        const { data: insRc, error: insErr } = await adminClient
          .from('purchase_receipts')
          .insert([receiptRecord])
          .select()
          .maybeSingle();

        if (!insErr && insRc) {
          receiptRecord = insRc;
        }
      } catch (rcInsErr) {
        console.warn('Backend receipt table insert notice:', rcInsErr.message);
      }

      const txId = `TX-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase().slice(-4)}`;
      try {
        await adminClient.from('transactions').insert([{
          id: txId,
          asset_id: assetId,
          user_id: user.id || null,
          transaction_type: 'Token Purchase (Marketplace)',
          status: 'CONFIRMED',
          transaction_hash: txHash,
          chain_id: String(chainId || '11155111'),
          token_id: updatedAsset?.token_id || '1',
          amount: `${priceEth || '0'} ETH`,
          block_number: blockNumber || null,
          gas_fee: gasFee || '0.0050 ETH'
        }]);
      } catch (txErr) {
        console.warn('Transactions insert notice:', txErr.message);
      }

      return {
        asset: updatedAsset,
        receipt: receiptRecord,
        idempotent: false
      };
    }

    throw new Error('Database service is not configured.');
  }

  // Record on-chain direct token transfer (safeTransferFrom)
  async recordTransfer(assetId, transferData = {}, user = {}) {
    const { fromWallet, toWallet, txHash, chainId, blockNumber, gasFee, tokenId } = transferData;
    const adminClient = supabase.getSupabaseAdmin();
    if (adminClient) {
      const { data: updatedAsset, error: updateErr } = await adminClient
        .from('assets')
        .update({
          current_owner_address: toWallet,
          listing_status: 'UNLISTED',
          listing_price_eth: 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', assetId)
        .select()
        .single();

      if (updateErr) {
        throw new Error(`Failed to update asset transfer record: ${updateErr.message}`);
      }

      const txId = `TX-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase().slice(-4)}`;
      try {
        await adminClient.from('transactions').insert([{
          id: txId,
          asset_id: assetId,
          user_id: user.id || null,
          transaction_type: 'Token Transfer (Direct)',
          status: 'CONFIRMED',
          transaction_hash: txHash,
          chain_id: String(chainId || '11155111'),
          token_id: String(tokenId || updatedAsset?.token_id || '1'),
          amount: '0.0000 ETH',
          block_number: blockNumber ? parseInt(blockNumber, 10) : null,
          gas_fee: gasFee || '0.0050 ETH'
        }]);
      } catch (txErr) {
        console.warn('Transactions insert notice on transfer:', txErr.message);
      }

      try {
        await adminClient.from('audit_logs').insert([{
          asset_id: assetId,
          admin_id: user.id || null,
          admin_email: user.email || 'system@assetra.io',
          action: 'TRANSFERRED',
          previous_status: 'TOKENIZED',
          new_status: 'TOKENIZED',
          notes: `Token transferred directly from ${fromWallet} to ${toWallet}. Tx: ${txHash}`
        }]);
      } catch (alErr) {
        console.warn('Audit log write notice on transfer:', alErr.message);
      }

      return updatedAsset;
    }

    if (db.pool && db.getStatus().connected) {
      await db.query(
        `UPDATE assets SET current_owner_address = $1, listing_status = 'UNLISTED', listing_price_eth = 0, updated_at = NOW() WHERE id = $2`,
        [toWallet, assetId]
      );
      return { id: assetId, current_owner_address: toWallet, listing_status: 'UNLISTED' };
    }

    throw new Error('Database service is not configured.');
  }
}

module.exports = new AssetService();
