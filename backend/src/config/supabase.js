const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://ofdzzynjlyigoliqfgbl.supabase.co';
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const isConfigured = Boolean(
  supabaseUrl &&
  (supabaseSecretKey || supabasePublishableKey) &&
  !String(supabaseSecretKey || '').includes('PASTE_')
);

let adminClient = null;
let publicClient = null;

if (supabaseUrl && supabaseSecretKey && !supabaseSecretKey.includes('PASTE_')) {
  adminClient = createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

if (supabaseUrl && supabasePublishableKey && !supabasePublishableKey.includes('PASTE_')) {
  publicClient = createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

module.exports = {
  supabaseUrl,
  isConfigured,
  adminClient,
  publicClient,
  getSupabaseAdmin: () => adminClient,
  getSupabasePublic: () => publicClient || adminClient,
  getStatus: () => ({
    configured: isConfigured,
    url: supabaseUrl,
    hasSecretKey: Boolean(supabaseSecretKey && !supabaseSecretKey.includes('PASTE_')),
    hasPublishableKey: Boolean(supabasePublishableKey && !supabasePublishableKey.includes('PASTE_'))
  })
};
