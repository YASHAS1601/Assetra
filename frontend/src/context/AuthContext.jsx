import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured, supabaseConfigError } from '../lib/supabase';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [role, setRole] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch verified profile from public.profiles table
  const fetchUserProfile = useCallback(async (userId, userEmail, userMetadata = {}) => {
    if (!isSupabaseConfigured || !userId) {
      return null;
    }

    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, wallet_address, created_at')
      .eq('id', userId)
      .maybeSingle();

    if (profileErr) {
      throw new Error(`Authoritative profile lookup failed: ${profileErr.message}`);
    }

    if (!profile) {
      throw new Error(`Profile record not found in database for user ${userEmail}. Please verify the profile is registered in public.profiles.`);
    }

    return {
      id: profile.id,
      email: profile.email || userEmail,
      fullName: profile.full_name || userMetadata.full_name || '',
      role: profile.role, // Authoritative role strictly from database
      walletAddress: profile.wallet_address || userMetadata.wallet_address || '',
      createdAt: profile.created_at
    };
  }, []);

  // Initialize and listen to Supabase Auth state changes
  useEffect(() => {
    let isMounted = true;

    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    // 1. Get initial active session
    supabase.auth.getSession().then(async ({ data: { session: initialSession }, error: sessionErr }) => {
      if (!isMounted) return;

      if (sessionErr) {
        console.warn('Error reading active session:', sessionErr.message);
        setIsLoading(false);
        return;
      }

      if (initialSession && initialSession.user) {
        setSession(initialSession);
        setToken(initialSession.access_token);
        try {
          const profile = await fetchUserProfile(
            initialSession.user.id,
            initialSession.user.email,
            initialSession.user.user_metadata
          );
          if (isMounted) {
            setUser(profile);
            setRole(profile.role);
          }
        } catch (profErr) {
          console.error('Session profile verification failed:', profErr.message);
          if (isMounted) {
            setUser(null);
            setRole(null);
          }
        }
      }
      if (isMounted) setIsLoading(false);
    }).catch(err => {
      if (isMounted) {
        console.warn('Supabase getSession failed:', err.message);
        setIsLoading(false);
      }
    });

    // 2. Subscribe to auth changes (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (!isMounted) return;

        if (event === 'SIGNED_OUT' || !currentSession) {
          setSession(null);
          setUser(null);
          setToken(null);
          setRole(null);
          setIsLoading(false);
        } else if (currentSession && currentSession.user) {
          setSession(currentSession);
          setToken(currentSession.access_token);
          try {
            const profile = await fetchUserProfile(
              currentSession.user.id,
              currentSession.user.email,
              currentSession.user.user_metadata
            );
            if (isMounted) {
              setUser(profile);
              setRole(profile.role);
              setIsLoading(false);
            }
          } catch (profErr) {
            console.error('Auth state change profile verification failed:', profErr.message);
            if (isMounted) {
              setUser(null);
              setRole(null);
              setIsLoading(false);
            }
          }
        }
      }
    );

    return () => {
      isMounted = false;
      if (subscription) subscription.unsubscribe();
    };
  }, [fetchUserProfile]);

  // Login handler using Supabase Auth
  const login = async (email, password) => {
    if (!isSupabaseConfigured) {
      const err = new Error(supabaseConfigError || 'Supabase is not configured.');
      setError(err.message);
      throw err;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: signInErr } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password
      });

      if (signInErr) {
        if (signInErr.message?.toLowerCase().includes('email not confirmed') || signInErr.code === 'email_not_confirmed') {
          throw new Error('Email address is not confirmed. Please check your inbox or confirm the email address in Supabase.');
        }
        if (signInErr.message?.toLowerCase().includes('invalid login credentials') || signInErr.code === 'invalid_credentials') {
          throw new Error('Invalid email or password.');
        }
        throw new Error(signInErr.message || 'Invalid email or password.');
      }

      if (!data.user) {
        throw new Error('Authentication succeeded but user profile was not returned.');
      }

      // Load profile to verify role and user details from database
      const profile = await fetchUserProfile(
        data.user.id,
        data.user.email,
        data.user.user_metadata
      );

      setSession(data.session);
      setToken(data.session ? data.session.access_token : null);
      setUser(profile);
      setRole(profile.role);

      return profile;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Register user account via Supabase Auth (always USER role)
  const register = async (email, password, fullName, walletAddress) => {
    if (!isSupabaseConfigured) {
      const err = new Error(supabaseConfigError || 'Supabase is not configured.');
      setError(err.message);
      throw err;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: signUpErr } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            wallet_address: walletAddress ? walletAddress.trim() : null
          }
        }
      });

      if (signUpErr) {
        throw new Error(signUpErr.message || 'Registration failed.');
      }

      if (!data.user) {
        throw new Error('Registration failed: no user returned.');
      }

      // Build initial user object
      const safeUser = {
        id: data.user.id,
        email: data.user.email,
        fullName: fullName.trim(),
        role: 'USER', // Always USER
        walletAddress: walletAddress ? walletAddress.trim() : null
      };

      if (data.session) {
        setSession(data.session);
        setToken(data.session.access_token);
        setUser(safeUser);
        setRole('USER');
      }

      return safeUser;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Logout handler
  const logout = async () => {
    setIsLoading(true);
    try {
      if (isSupabaseConfigured) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.warn('Error during Supabase signOut:', err.message);
    } finally {
      setSession(null);
      setUser(null);
      setToken(null);
      setRole(null);
      setIsLoading(false);
    }
  };

  const isAuthenticated = Boolean(user && (token || session));
  const isAdmin = role === 'ADMIN';

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        token,
        role,
        isAuthenticated,
        isAdmin,
        isLoading,
        error,
        isConfigured: isSupabaseConfigured,
        configError: supabaseConfigError,
        login,
        register,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

export default AuthContext;
