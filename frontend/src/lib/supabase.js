import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseKey &&
  supabaseKey !== 'PASTE_MY_SUPABASE_PUBLISHABLE_KEY_HERE' &&
  !supabaseKey.includes('PASTE_')
);

export const supabaseConfigError = !isSupabaseConfigured
  ? 'Supabase publishable key is not configured. Please add your key to frontend/.env.local (VITE_SUPABASE_PUBLISHABLE_KEY).'
  : null;

// Create client if configured, otherwise provide safe fallback client to prevent instant crash on mount
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    })
  : createClient(
      supabaseUrl || 'https://ofdzzynjlyigoliqfgbl.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false
        }
      }
    );

export default supabase;
