require('dotenv').config();
const supabase = require('../config/supabase');
const authService = require('../services/authService');

async function main() {
  const email = (process.env.ADMIN_EMAIL || process.argv[2] || process.env.ADMIN_BOOTSTRAP_EMAIL || 'admin@assetra.io').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || process.argv[3] || process.env.ADMIN_BOOTSTRAP_PASSWORD;
  const fullName = process.env.ADMIN_NAME || process.argv[4] || 'Assetra System Admin';

  console.log(`=======================================================`);
  console.log(`[Assetra Admin Setup] Provisioning administrator account`);
  console.log(`Target Email: ${email}`);
  console.log(`Target Name:  ${fullName}`);
  console.log(`=======================================================`);

  const adminClient = supabase.getSupabaseAdmin();

  if (adminClient) {
    if (!password) {
      console.error(`[Error] Password is required. Set ADMIN_PASSWORD environment variable or pass as argument: node src/scripts/createAdmin.js <email> <password> [fullName]`);
      process.exit(1);
    }

    try {
      console.log(`Provisioning administrator in Supabase Auth & public.profiles...`);
      let userId = null;

      const { data: authUser, error: authErr } = await adminClient.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
        user_metadata: { full_name: fullName, role: 'ADMIN' }
      });

      if (authUser?.user?.id) {
        userId = authUser.user.id;
      } else if (authErr && authErr.message.includes('already registered')) {
        console.log(`User already registered in Supabase Auth. Retrieving user profile...`);
        const { data: profile } = await adminClient
          .from('profiles')
          .select('id')
          .eq('email', email)
          .maybeSingle();

        if (profile?.id) {
          userId = profile.id;
        } else {
          // Fallback to user list
          const { data: listData } = await adminClient.auth.admin.listUsers();
          const found = listData?.users?.find(u => u.email.toLowerCase() === email);
          if (found) userId = found.id;
        }

        if (userId) {
          // Update password and ensure email_confirm
          await adminClient.auth.admin.updateUserById(userId, {
            password: password,
            email_confirm: true,
            user_metadata: { full_name: fullName, role: 'ADMIN' }
          });
        }
      } else if (authErr) {
        throw authErr;
      }

      if (userId) {
        // Authorize with role = 'ADMIN' in profiles table
        const { error: profileErr } = await adminClient
          .from('profiles')
          .upsert({
            id: userId,
            email: email,
            full_name: fullName,
            role: 'ADMIN'
          });

        if (profileErr) throw profileErr;
        console.log(`[Success] Supabase administrator account successfully created and authorized!`);
        console.log(`User ID: ${userId}`);
        console.log(`Role: ADMIN`);
        return;
      }
    } catch (sbErr) {
      console.warn(`[Supabase Admin API Notice]: ${sbErr.message}`);
    }
  }

  // If Supabase Secret Key is not configured on server yet, print exact SQL instruction
  console.log(`
[Supabase SQL Provisioning & Email Confirmation Instructions]
If you do not have SUPABASE_SECRET_KEY configured in backend/.env,
execute the following SQL in the Supabase Dashboard SQL Editor
(Project: ${supabase.supabaseUrl} -> SQL Editor -> New Query):

-- 1. Ensure user account in auth.users is confirmed (and set password if desired)
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
    ${password ? `, encrypted_password = crypt('${password}', gen_salt('bf'))` : ''}
WHERE LOWER(email) = '${email}';

-- 2. Authorize administrator in public.profiles with role = 'ADMIN'
INSERT INTO public.profiles (id, email, full_name, role)
SELECT id, email, COALESCE(raw_user_meta_data->>'full_name', '${fullName}'), 'ADMIN'
FROM auth.users
WHERE LOWER(email) = '${email}'
ON CONFLICT (id) DO UPDATE
SET role = 'ADMIN',
    email = EXCLUDED.email;
`);

  // Local fallback
  if (password) {
    try {
      const localAdmin = await authService.createAdminUser({ email, password, fullName });
      console.log(`[Local Fallback] In-memory/Local Admin account initialized: ${localAdmin.email} (Role: ADMIN)`);
    } catch (err) {
      console.info(`Local auth: ${err.message}`);
    }
  }
}

main().catch(err => {
  console.error('[Fatal Error]', err.message);
  process.exit(1);
});
