const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');
const config = require('../config');

const JWT_SECRET = process.env.JWT_SECRET || 'assetra_secret_jwt_key_2026';

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Authentication required. Please provide a valid Bearer token.'
    });
  }

  // 1. If Supabase is configured, verify via Supabase Auth
  const adminClient = supabase.getSupabaseAdmin();
  const publicClient = supabase.getSupabasePublic();

  if (adminClient) {
    try {
      const { data: { user }, error: authErr } = await adminClient.auth.getUser(token);
      if (authErr) {
        return res.status(401).json({
          success: false,
          error: 'AuthenticationError',
          message: authErr.message || 'Invalid or expired session token.'
        });
      }

      if (user) {
        // Query trusted role directly from public.profiles table (never trust client claims)
        const { data: profile, error: profErr } = await adminClient
          .from('profiles')
          .select('id, email, full_name, role, wallet_address')
          .eq('id', user.id)
          .maybeSingle();

        if (profErr) {
          return res.status(500).json({
            success: false,
            error: 'DatabaseError',
            message: `Profile lookup failed: ${profErr.message}`
          });
        }

        if (!profile) {
          return res.status(401).json({
            success: false,
            error: 'ProfileNotFound',
            message: `User account '${user.email}' is authenticated but has no profile registered in public.profiles.`
          });
        }

        req.user = {
          id: user.id,
          email: user.email,
          role: profile.role, // Authoritative database role
          fullName: profile.full_name || user.user_metadata?.full_name || '',
          walletAddress: profile.wallet_address || user.user_metadata?.wallet_address || null
        };
        return next();
      }
    } catch (sbErr) {
      return res.status(401).json({
        success: false,
        error: 'AuthenticationError',
        message: `Authentication verification failed: ${sbErr.message}`
      });
    }
  } else if (publicClient && supabase.supabaseUrl) {
    try {
      const { data: { user }, error: authErr } = await publicClient.auth.getUser(token);
      if (authErr) {
        return res.status(401).json({
          success: false,
          error: 'AuthenticationError',
          message: authErr.message || 'Invalid or expired session token.'
        });
      }

      if (user) {
        // Query authoritative profile from public.profiles table using caller's verified bearer token under RLS
        const { createClient } = require('@supabase/supabase-js');
        const pubKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
        const userClient = createClient(supabase.supabaseUrl, pubKey, {
          auth: { autoRefreshToken: false, persistSession: false },
          global: { headers: { Authorization: `Bearer ${token}` } }
        });

        const { data: profile, error: profErr } = await userClient
          .from('profiles')
          .select('id, email, full_name, role, wallet_address')
          .eq('id', user.id)
          .maybeSingle();

        if (profErr) {
          return res.status(500).json({
            success: false,
            error: 'DatabaseError',
            message: `Profile lookup failed: ${profErr.message}`
          });
        }

        if (!profile) {
          return res.status(401).json({
            success: false,
            error: 'ProfileNotFound',
            message: `User account '${user.email}' is authenticated but has no profile registered in public.profiles.`
          });
        }

        req.user = {
          id: user.id,
          email: user.email,
          role: profile.role, // Authoritative database role
          fullName: profile.full_name || user.user_metadata?.full_name || '',
          walletAddress: profile.wallet_address || user.user_metadata?.wallet_address || null
        };
        return next();
      }
    } catch (sbErr) {
      return res.status(401).json({
        success: false,
        error: 'AuthenticationError',
        message: `Authentication verification failed: ${sbErr.message}`
      });
    }
  }

  // 2. Fallback to server JWT secret verification
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Invalid or expired session token.'
    });
  }
};

const requireRole = (requiredRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Authentication required.'
      });
    }

    if (req.user.role !== requiredRole) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: `Access denied. Requires '${requiredRole}' administrative permissions.`
      });
    }

    next();
  };
};

module.exports = {
  authenticateToken,
  requireRole,
  JWT_SECRET
};
