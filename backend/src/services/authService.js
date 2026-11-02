const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const supabase = require('../config/supabase');
const { JWT_SECRET } = require('../middleware/authMiddleware');

class AuthService {
  async registerUser({ email, password, fullName, walletAddress }) {
    if (!email || !password || !fullName) {
      throw new Error('Email, password, and full name are required.');
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanName = fullName.trim();
    const cleanWallet = walletAddress ? walletAddress.trim() : null;

    // 1. Supabase Auth registration
    const adminClient = supabase.getSupabaseAdmin();
    const publicClient = supabase.getSupabasePublic();
    const client = adminClient || publicClient;

    if (client) {
      const { data, error: signUpErr } = await client.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: cleanName,
            wallet_address: cleanWallet
          }
        }
      });

      if (signUpErr) {
        throw new Error(signUpErr.message || 'Registration failed.');
      }

      if (!data.user) {
        throw new Error('Registration failed: no user returned from authentication service.');
      }

      // Check if profile was inserted by trigger, or insert directly
      if (adminClient) {
        await adminClient
          .from('profiles')
          .upsert({
            id: data.user.id,
            email: cleanEmail,
            full_name: cleanName,
            role: 'USER', // Registration ALWAYS assigns USER role
            wallet_address: cleanWallet
          });
      }

      const safeUser = {
        id: data.user.id,
        email: cleanEmail,
        fullName: cleanName,
        role: 'USER',
        walletAddress: cleanWallet,
        createdAt: data.user.created_at || new Date().toISOString()
      };

      const token = data.session?.access_token || this.generateToken(safeUser);
      return { token, user: safeUser };
    }

    // 2. Direct PostgreSQL fallback
    if (db.pool && db.getStatus().connected) {
      const existing = await this.findUserByEmail(cleanEmail);
      if (existing) {
        throw new Error('User account with this email address already exists.');
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const res = await db.query(
        `INSERT INTO users (email, password_hash, full_name, role, status, wallet_address)
         VALUES ($1, $2, $3, 'USER', 'ACTIVE', $4) RETURNING id, email, full_name, role, wallet_address, created_at`,
        [cleanEmail, passwordHash, cleanName, cleanWallet]
      );
      const dbUser = res.rows[0];
      const safeUser = {
        id: dbUser.id,
        email: dbUser.email,
        fullName: dbUser.full_name,
        role: 'USER',
        walletAddress: dbUser.wallet_address,
        createdAt: dbUser.created_at
      };
      const token = this.generateToken(safeUser);
      return { token, user: safeUser };
    }

    throw new Error('Authentication service unavailable. Supabase is not configured.');
  }

  async loginUser({ email, password }) {
    if (!email || !password) {
      throw new Error('Email and password are required.');
    }

    const cleanEmail = email.toLowerCase().trim();

    // 1. Supabase Auth authentication
    const publicClient = supabase.getSupabasePublic();
    const adminClient = supabase.getSupabaseAdmin();
    const client = publicClient || adminClient;

    if (client) {
      const { data, error: signInErr } = await client.auth.signInWithPassword({
        email: cleanEmail,
        password
      });

      if (signInErr) {
        if (signInErr.message?.toLowerCase().includes('email not confirmed') || signInErr.code === 'email_not_confirmed') {
          throw new Error('Email address is not confirmed. Please verify your email inbox or confirm in Supabase dashboard.');
        }
        if (signInErr.message?.toLowerCase().includes('invalid login credentials') || signInErr.code === 'invalid_credentials') {
          throw new Error('Invalid email or password.');
        }
        throw new Error(signInErr.message || 'Invalid credentials.');
      }

      if (!data.user) {
        throw new Error('Authentication succeeded but user identity was not returned.');
      }

      // Query authoritative role from public.profiles
      const lookupClient = adminClient || client;
      const { data: profile, error: profErr } = await lookupClient
        .from('profiles')
        .select('id, email, full_name, role, wallet_address')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profErr) {
        throw new Error(`Profile verification failed: ${profErr.message}`);
      }

      if (!profile) {
        throw new Error(`Profile record not found in public.profiles for user ${cleanEmail}.`);
      }

      const safeUser = {
        id: profile.id,
        email: profile.email || cleanEmail,
        fullName: profile.full_name || data.user.user_metadata?.full_name || '',
        role: profile.role, // Authoritative role strictly from database
        walletAddress: profile.wallet_address || data.user.user_metadata?.wallet_address || null
      };

      const token = data.session?.access_token || this.generateToken(safeUser);
      return { token, user: safeUser };
    }

    // 2. Direct PostgreSQL fallback
    if (db.pool && db.getStatus().connected) {
      const res = await db.query('SELECT * FROM users WHERE LOWER(email) = $1', [cleanEmail]);
      if (res.rows.length === 0) {
        throw new Error('Invalid credentials.');
      }
      const user = res.rows[0];
      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) {
        throw new Error('Invalid credentials.');
      }
      const safeUser = {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        walletAddress: user.wallet_address
      };
      const token = this.generateToken(safeUser);
      return { token, user: safeUser };
    }

    throw new Error('Authentication service unavailable. Supabase is not configured.');
  }

  async findUserByEmail(email) {
    const cleanEmail = email.toLowerCase().trim();
    const adminClient = supabase.getSupabaseAdmin();

    if (adminClient) {
      const { data: profile } = await adminClient
        .from('profiles')
        .select('*')
        .eq('email', cleanEmail)
        .maybeSingle();
      if (profile) return profile;
    }

    if (db.pool && db.getStatus().connected) {
      const res = await db.query('SELECT * FROM users WHERE LOWER(email) = $1', [cleanEmail]);
      if (res.rows.length > 0) return res.rows[0];
    }

    return null;
  }

  async createAdminUser({ email, password, fullName }) {
    const cleanEmail = email.toLowerCase().trim();
    const cleanName = fullName ? fullName.trim() : 'Assetra System Admin';

    const adminClient = supabase.getSupabaseAdmin();
    if (adminClient) {
      // Find or create in auth.users
      const { data: profile, error: profErr } = await adminClient
        .from('profiles')
        .upsert({
          email: cleanEmail,
          full_name: cleanName,
          role: 'ADMIN'
        })
        .select()
        .single();

      if (profErr) {
        throw new Error(`Failed to assign admin role: ${profErr.message}`);
      }
      return profile;
    }

    if (db.pool && db.getStatus().connected) {
      const passwordHash = await bcrypt.hash(password, 10);
      const res = await db.query(
        `INSERT INTO users (email, password_hash, full_name, role, status)
         VALUES ($1, $2, $3, 'ADMIN', 'ACTIVE')
         ON CONFLICT (email) DO UPDATE SET role = 'ADMIN', password_hash = EXCLUDED.password_hash
         RETURNING id, email, full_name, role, wallet_address`,
        [cleanEmail, passwordHash, cleanName]
      );
      return res.rows[0];
    }

    throw new Error('Cannot provision admin: Database connection is not available.');
  }

  generateToken(user) {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        fullName: user.fullName || user.full_name,
        walletAddress: user.walletAddress || user.wallet_address
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
  }
}

module.exports = new AuthService();
