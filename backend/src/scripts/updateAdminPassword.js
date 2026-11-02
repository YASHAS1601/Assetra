require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function updateAdminPassword() {
  const supabaseUrl = process.env.SUPABASE_URL || 'https://ofdzzynjlyigoliqfgbl.supabase.co';
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  const targetUserId = process.argv[2];
  const newPassword = process.argv[3];

  if (!targetUserId || !newPassword) {
    console.error(JSON.stringify({
      success: false,
      error: 'MISSING_ARGUMENTS',
      message: 'Usage: node src/scripts/updateAdminPassword.js <userId> <newPassword>'
    }));
    process.exit(1);
  }

  if (!serviceRoleKey || serviceRoleKey.trim().length === 0 || serviceRoleKey.includes('PASTE_')) {
    console.error(JSON.stringify({
      success: false,
      error: 'MISSING_SECRET_KEY',
      message: 'SUPABASE_SECRET_KEY (service_role secret) is not configured in backend/.env.'
    }));
    process.exit(1);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey.trim(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  try {
    // 1. Update password and confirm email via Supabase Admin Auth API
    const { data: updatedUser, error: authError } = await adminClient.auth.admin.updateUserById(
      targetUserId,
      {
        password: newPassword,
        email_confirm: true
      }
    );

    if (authError) {
      console.error(JSON.stringify({
        success: false,
        error: authError.code || 'AUTH_UPDATE_FAILED',
        message: authError.message
      }));
      process.exit(1);
    }

    // 2. Ensure role in public.profiles is ADMIN
    const { error: profileError } = await adminClient
      .from('profiles')
      .upsert({
        id: targetUserId,
        email: updatedUser.user.email || 'admin@assetra.io',
        role: 'ADMIN'
      });

    console.log(JSON.stringify({
      success: true,
      userId: targetUserId,
      email: updatedUser.user.email,
      emailConfirmed: Boolean(updatedUser.user.email_confirmed_at || updatedUser.user.confirmed_at),
      role: 'ADMIN',
      profileUpdated: !profileError
    }));
  } catch (err) {
    console.error(JSON.stringify({
      success: false,
      error: 'UNEXPECTED_ERROR',
      message: err.message
    }));
    process.exit(1);
  }
}

updateAdminPassword();
