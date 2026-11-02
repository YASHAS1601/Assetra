const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const supabase = require('../config/supabase');

const ALLOWED_MIME_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Resolve an active Supabase client:
 * 1. Admin service-role client (trusted backend operations)
 * 2. User-scoped authenticated client using Bearer token (RLS enforced)
 */
const getActiveClient = (req) => {
  const admin = supabase.getSupabaseAdmin();
  if (admin) return admin;

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (supabase.supabaseUrl && (process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY) && token) {
    const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
    return createClient(supabase.supabaseUrl, key, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } }
    });
  }

  return null;
};

/**
 * Secure Document Upload Handler
 * Uploads file to private Supabase Storage bucket 'asset-documents' and registers metadata in public.asset_documents
 */
const uploadDocument = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: 'No document file was provided for upload.'
    });
  }

  if (!ALLOWED_MIME_TYPES.includes(req.file.mimetype)) {
    if (req.file.path && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    return res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: 'Invalid file format. Only PDF, PNG, and JPEG documents are permitted.'
    });
  }

  if (req.file.size > MAX_FILE_SIZE) {
    if (req.file.path && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    return res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: 'File size exceeds maximum allowable limit of 10MB.'
    });
  }

  const client = getActiveClient(req);
  if (!client) {
    if (req.file.path && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    return res.status(503).json({
      success: false,
      error: 'ServiceUnavailable',
      message: 'Supabase storage service is not configured. Please configure SUPABASE_SECRET_KEY or SUPABASE_PUBLISHABLE_KEY.'
    });
  }

  const userId = req.user ? req.user.id : null;
  if (!userId) {
    if (req.file.path && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Authentication required to upload custody documents.'
    });
  }

  const assetId = req.body.assetId || null;
  const cleanOriginalName = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
  const storagePath = `${userId}/${assetId || 'unassigned'}/${Date.now()}-${cleanOriginalName}`;

  try {
    const fileBuffer = req.file.buffer || (req.file.path ? fs.readFileSync(req.file.path) : null);
    if (!fileBuffer) {
      throw new Error('Unable to read uploaded file buffer.');
    }

    // 1. Upload to private Supabase Storage bucket 'asset-documents'
    const { data: storageData, error: uploadErr } = await client.storage
      .from('asset-documents')
      .upload(storagePath, fileBuffer, {
        contentType: req.file.mimetype,
        upsert: false
      });

    if (uploadErr) {
      throw uploadErr;
    }

    // 2. Insert record into public.asset_documents
    const docRecord = {
      asset_id: assetId,
      user_id: userId,
      storage_path: storagePath,
      filename: cleanOriginalName,
      original_name: req.file.originalname,
      mime_type: req.file.mimetype,
      size_bytes: req.file.size,
      is_private: true
    };

    const { data: dbData, error: dbErr } = await client
      .from('asset_documents')
      .insert([docRecord])
      .select()
      .single();

    if (dbErr) {
      // Rollback storage upload if DB insert fails
      try {
        await client.storage.from('asset-documents').remove([storagePath]);
      } catch (cleanupErr) {
        console.warn('Storage rollback cleanup error:', cleanupErr.message);
      }
      throw dbErr;
    }

    // Clean up temporary local file if written by multer
    if (req.file.path && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }

    return res.status(201).json({
      success: true,
      message: 'Custody evidence document stored securely in private Supabase Storage.',
      data: dbData
    });
  } catch (err) {
    if (req.file.path && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    console.error('Supabase document upload error:', err.message);
    return res.status(500).json({
      success: false,
      error: 'StorageError',
      message: `Failed to upload document to secure storage: ${err.message}`
    });
  }
};

/**
 * Secure Document Download / Access Handler
 * Validates caller authorization (asset owner or verified admin) and generates short-lived signed URL
 */
const getDocument = async (req, res) => {
  const { id } = req.params;
  const client = getActiveClient(req);

  if (!client) {
    return res.status(503).json({
      success: false,
      error: 'ServiceUnavailable',
      message: 'Supabase storage is not configured on the server.'
    });
  }

  try {
    // 1. Fetch document metadata by document ID or storage path
    const docIdOrPath = req.query.path || (id ? decodeURIComponent(id) : null);
    if (!docIdOrPath) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Document ID or storage path is required.'
      });
    }

    let query = client.from('asset_documents').select('*');
    if (docIdOrPath.includes('/')) {
      query = query.eq('storage_path', docIdOrPath);
    } else {
      query = query.eq('id', docIdOrPath);
    }

    const { data: doc, error: docErr } = await query.maybeSingle();

    if (docErr || !doc) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Document record not found in database.'
      });
    }

    // 2. Strict authorization check: must be document uploader or verified ADMIN
    const isOwner = req.user && req.user.id === doc.user_id;
    const isAdmin = req.user && req.user.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Access denied: You are not authorized to view or download this private custody document.'
      });
    }

    // 3. Generate short-lived signed URL (300 seconds = 5 minutes expiry)
    const { data: signedData, error: signedErr } = await client.storage
      .from('asset-documents')
      .createSignedUrl(doc.storage_path, 300);

    if (signedErr) {
      throw signedErr;
    }

    return res.status(200).json({
      success: true,
      downloadUrl: signedData.signedUrl,
      data: doc
    });
  } catch (err) {
    console.error('Supabase document retrieval error:', err.message);
    return res.status(500).json({
      success: false,
      error: 'StorageError',
      message: `Failed to generate secure document URL: ${err.message}`
    });
  }
};

/**
 * Fetch all documents for a specific asset
 */
const getAssetDocuments = async (req, res) => {
  const { assetId } = req.params;
  const client = getActiveClient(req);

  if (!client) {
    return res.status(503).json({
      success: false,
      error: 'ServiceUnavailable',
      message: 'Supabase service is not configured.'
    });
  }

  try {
    const isOwnerOrAdmin = req.user && (req.user.role === 'ADMIN' || req.user.id);
    if (!isOwnerOrAdmin) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Authentication required to access documents.'
      });
    }

    let query = client
      .from('asset_documents')
      .select('*')
      .eq('asset_id', assetId);

    // If caller is not an ADMIN, restrict search to caller's own documents
    if (req.user.role !== 'ADMIN') {
      query = query.eq('user_id', req.user.id);
    }

    const { data: docs, error: fetchErr } = await query.order('created_at', { ascending: false });

    if (fetchErr) {
      throw fetchErr;
    }

    return res.status(200).json({
      success: true,
      data: docs || []
    });
  } catch (err) {
    console.error('Failed to fetch asset documents:', err.message);
    return res.status(500).json({
      success: false,
      error: 'DatabaseError',
      message: `Failed to retrieve asset documents: ${err.message}`
    });
  }
};

/**
 * Delete document: Prohibited if associated asset has completed review (APPROVED)
 */
const deleteDocument = async (req, res) => {
  const { id } = req.params;
  const client = getActiveClient(req);

  if (!client) {
    return res.status(503).json({
      success: false,
      error: 'ServiceUnavailable',
      message: 'Supabase service is not configured.'
    });
  }

  try {
    const { data: doc, error: docErr } = await client
      .from('asset_documents')
      .select('*, assets(verification_status, is_verified)')
      .eq('id', id)
      .maybeSingle();

    if (docErr || !doc) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Document record not found.'
      });
    }

    const isOwner = req.user && req.user.id === doc.user_id;
    const isAdmin = req.user && req.user.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Unauthorized: You do not have permission to delete this document.'
      });
    }

    // Security rule: Prevent deletion of documents attached to approved assets
    const assetVerified = doc.assets?.verification_status === 'APPROVED' || doc.assets?.is_verified;
    if (assetVerified) {
      return res.status(400).json({
        success: false,
        error: 'ComplianceViolation',
        message: 'Document deletion rejected: Supporting title evidence for approved assets cannot be removed.'
      });
    }

    // Delete database record
    await client.from('asset_documents').delete().eq('id', id);

    // Delete storage file
    if (doc.storage_path) {
      try {
        await client.storage.from('asset-documents').remove([doc.storage_path]);
      } catch (stErr) {
        console.warn('Storage file deletion notice:', stErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Document successfully removed.'
    });
  } catch (err) {
    console.error('Document deletion error:', err.message);
    return res.status(500).json({
      success: false,
      error: 'DatabaseError',
      message: `Failed to delete document: ${err.message}`
    });
  }
};

module.exports = {
  uploadDocument,
  getDocument,
  getAssetDocuments,
  deleteDocument
};
