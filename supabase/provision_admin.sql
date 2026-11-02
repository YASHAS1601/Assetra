-- ==============================================================================
-- Assetra Protocol: Administrator Provisioning, Confirmation & Role Authorization
-- Target Project: https://ofdzzynjlyigoliqfgbl.supabase.co
-- Execute this script in: Supabase Dashboard -> SQL Editor -> New Query
-- ==============================================================================

-- Step 1: Ensure the pgcrypto extension is active for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Step 2: Confirm the administrator email and (optionally) reset/set password
-- If the account already exists in auth.users, this sets email_confirmed_at to now()
-- and optionally hashes the desired administrator password using Blowfish bcrypt.
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
    -- Uncomment the line below if you wish to reset the password directly via SQL:
    -- , encrypted_password = crypt('YourAdminPassword123!', gen_salt('bf'))
WHERE LOWER(email) = 'admin@assetra.io';

-- Step 3: Authorize the account with the authoritative 'ADMIN' role in public.profiles
-- We temporarily disable the on_profile_role_update trigger since auth.uid() is null in SQL editor
ALTER TABLE public.profiles DISABLE TRIGGER on_profile_role_update;

INSERT INTO public.profiles (id, email, full_name, role)
SELECT 
    id, 
    email, 
    COALESCE(raw_user_meta_data->>'full_name', 'Assetra System Admin'), 
    'ADMIN'
FROM auth.users
WHERE LOWER(email) = 'admin@assetra.io'
ON CONFLICT (id) DO UPDATE
SET role = 'ADMIN',
    email = EXCLUDED.email,
    updated_at = now();

ALTER TABLE public.profiles ENABLE TRIGGER on_profile_role_update;

-- Step 4: Verification query - run this to verify the account is confirmed and authorized
SELECT 
    u.id AS auth_user_id,
    u.email AS auth_email,
    u.email_confirmed_at,
    p.id AS profile_id,
    p.role AS profile_role,
    p.full_name
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE LOWER(u.email) = 'admin@assetra.io';
